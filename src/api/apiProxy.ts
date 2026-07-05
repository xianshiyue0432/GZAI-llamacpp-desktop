export interface ProxyRequest {
  url: string
  method: string
  headers: [string, string][]
  body?: string
}

export interface ProxyResponse {
  status: number
  status_text: string
  body: string
  headers: [string, string][]
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
}

export async function proxyRequest(req: ProxyRequest): Promise<ProxyResponse> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<ProxyResponse>('api_proxy', { request: req })
  }

  const fetchOptions: RequestInit = {
    method: req.method,
    headers: Object.fromEntries(req.headers),
  }
  if (req.body) {
    fetchOptions.body = req.body
  }

  const response = await fetch(req.url, fetchOptions)

  const respHeaders: [string, string][] = []
  response.headers.forEach((value, name) => {
    respHeaders.push([name, value])
  })

  return {
    status: response.status,
    status_text: response.statusText,
    body: await response.text(),
    headers: respHeaders,
  }
}

export async function proxyChatCompletions(
  url: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string | unknown[] }[],
  signal?: AbortSignal,
  authHeader?: string
): Promise<Response> {
  const isLocal = url.includes('127.0.0.1') || url.includes('localhost')
  const auth = authHeader || `Bearer ${apiKey}`

  if (isTauri()) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const headers: [string, string][] = [
      ['Content-Type', 'application/json'],
    ]
    if (!isLocal || (apiKey && authHeader)) {
      headers.push(['Authorization', auth])
    }

    const result = await proxyRequest({
      url,
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: 4096,
        temperature: 0.7,
      }),
    })

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        if (signal?.aborted) {
          controller.close()
          return
        }

        const lines = result.body.split('\n')
        let hasSsePrefix = false
        for (const line of lines) {
          if (line.trim().startsWith('data: ')) { hasSsePrefix = true; break }
        }
        
        let data = ''
        for (const line of lines) {
          if (line.trim() === '') continue
          if (hasSsePrefix) {
            data += `${line.trim()}\n\n`
          } else {
            data += `data: ${line}\n\n`
          }
        }
        if (!data.includes('[DONE]')) {
          data += 'data: [DONE]\n\n'
        }
        controller.enqueue(encoder.encode(data))
        controller.close()
      },
    })

    return new Response(stream, {
      status: result.status,
      statusText: result.status_text,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': auth,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 4096,
      temperature: 0.7,
    }),
    signal,
  })
}

export async function proxyChatCompletionsStream(
  url: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string | unknown[] }[],
  signal?: AbortSignal,
  authHeader?: string
): Promise<Response> {
  const isLocal = url.includes('127.0.0.1') || url.includes('localhost')
  const auth = authHeader || `Bearer ${apiKey}`

  if (isTauri()) {
    const headers: [string, string][] = [
      ['Content-Type', 'application/json'],
    ]
    if (!isLocal || (apiKey && authHeader)) {
      headers.push(['Authorization', auth])
    }

    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')

    const encoder = new TextEncoder()
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    let writerClosed = false

    const safeWrite = async (data: string) => {
      if (!writerClosed) {
        try { await writer.write(encoder.encode(data)) } catch { writerClosed = true }
      }
    }
    const safeClose = async () => {
      if (!writerClosed) {
        writerClosed = true
        try { await writer.close() } catch {}
      }
    }

    // 先注册事件监听器，再启动 Rust 命令
    const unlistenChunk = await listen<{ data: string; done: boolean; error?: string }>(
      'proxy-stream-chunk',
      (event) => {
        if (signal?.aborted || writerClosed) { safeClose(); return }
        if (event.payload.done) {
          safeWrite('data: [DONE]\n\n')
          safeClose()
          return
        }
        safeWrite(event.payload.data)
      }
    )

    const unlistenError = await listen<{ data: string; done: boolean; error?: string }>(
      'proxy-stream-error',
      (event) => {
        if (writerClosed) return
        const errTitle = event.payload.error || '服务器错误'
        const errBody = event.payload.data || ''
        const errDetail = errBody.length > 0 ? `: ${errBody.substring(0, 300)}` : ''
        const errMsg = `${errTitle}${errDetail}`
        safeWrite(`data: {"error":"${errMsg.replace(/"/g, '\\"')}"}\n\n`)
        safeWrite('data: [DONE]\n\n')
        safeClose()
      }
    )

    if (signal) {
      signal.addEventListener('abort', () => {
        safeClose()
        unlistenChunk()
        unlistenError()
      })
    }

    // 启动 Rust 流式请求
    invoke<number>('api_proxy_stream', {
      request: {
        url,
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          stream_options: { include_usage: true },
          max_tokens: 4096,
          temperature: 0.7,
        }),
      },
    }).then((code) => {
      if (code >= 400 && !writerClosed) {
        safeWrite(`data: {"error":"HTTP ${code}"}\n\n`)
        safeWrite('data: [DONE]\n\n')
        safeClose()
      }
    }).catch((err) => {
      if (!signal?.aborted && !writerClosed) {
        safeWrite(`data: {"error":"${String(err).replace(/"/g, '\\"')}"}\n\n`)
        safeWrite('data: [DONE]\n\n')
        safeClose()
      }
    })

    return new Response(readable, {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': auth,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 4096,
      temperature: 0.7,
    }),
    signal,
  })
}

export async function testConnection(
  baseUrl: string,
  apiKey: string,
  model: string,
  isXfyun?: boolean
): Promise<{ ok: boolean; detail: string }> {
  const cleanUrl = baseUrl.replace(/\/+$/, '')
  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 5,
    stream: false,
  })

  const authValue = isXfyun ? `Basic ${btoa(apiKey)}` : `Bearer ${apiKey}`

  const urls: string[] = [
    `${cleanUrl}/chat/completions`,
    `${cleanUrl}/v1/chat/completions`,
  ]
  if (!cleanUrl.endsWith('/models')) {
    urls.unshift(`${cleanUrl}/models`)
  }

  for (const url of urls) {
    try {
      const result = await proxyRequest({
        url,
        method: url.endsWith('/models') ? 'GET' : 'POST',
        headers: [
          ['Authorization', authValue],
          ['Content-Type', 'application/json'],
        ],
        ...(url.endsWith('/models') ? {} : { body }),
      })

      if (result.status < 500) {
        return { ok: true, detail: `连接成功 (${url})` }
      }
      return { ok: false, detail: `[${url}] HTTP ${result.status}: ${result.body.substring(0, 150)}` }
    } catch (err) {
      continue
    }
  }

  return { ok: false, detail: `所有端点均连接失败 (${urls.join(', ')})` }
}
