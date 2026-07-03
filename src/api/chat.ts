import { proxyChatCompletions } from './apiProxy'

export interface Attachment {
  id: string
  type: 'image' | 'file'
  name: string
  data: string
  mimeType: string
  size: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
  isMarked?: boolean
  version?: number
  attachments?: Attachment[]
  sendTime?: number
  duration?: number
  tokens?: number
  modelName?: string
  cost?: number
}

export interface StreamChunk {
  content: string
  done: boolean
  error?: string
  tokens?: number
}

export interface ChatConfig {
  baseUrl: string
  apiKey: string
  model: string
  apiFormat: 'openai' | 'anthropic'
  temperature?: number
  maxTokens?: number
  providerId?: string
}

async function buildXfyunSignedUrl(baseUrl: string, apiKey: string, method: string = 'POST'): Promise<string> {
  const parts = apiKey.split(':')
  if (parts.length !== 2) return baseUrl
  const apiKeyId = parts[0]
  const apiSecret = parts[1]
  try {
    const url = new URL(baseUrl)
    const host = url.host
    const path = url.pathname
    const date = new Date().toUTCString()
    const requestLine = `${method} ${path} HTTP/1.1`
    const signatureOrigin = `host: ${host}\ndate: ${date}\n${requestLine}`

    const encoder = new TextEncoder()
    const keyData = encoder.encode(apiSecret)
    const messageData = encoder.encode(signatureOrigin)

    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const signatureBytes = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))

    const authorizationOrigin = `api_key="${apiKeyId}",algorithm="hmac-sha256",headers="host date request-line",signature="${signature}"`
    url.searchParams.set('authorization', btoa(authorizationOrigin))
    url.searchParams.set('date', date)
    url.searchParams.set('host', host)
    return url.toString()
  } catch {
    return baseUrl
  }
}

function buildHeaders(config: ChatConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.apiFormat === 'anthropic') {
    headers['x-api-key'] = config.apiKey
    headers['anthropic-version'] = '2023-06-01'
  } else {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }
  return headers
}

function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return { mediaType: match[1], base64: match[2] }
}

function buildMessageContent(message: ChatMessage): string | unknown[] {
  if (!message.attachments || message.attachments.length === 0) {
    return message.content
  }
  const imageAtts = message.attachments.filter(a => a.type === 'image')
  if (imageAtts.length === 0) {
    return message.content
  }
  const content: unknown[] = []
  if (message.content) {
    content.push({ type: 'text', text: message.content })
  }
  for (const img of imageAtts) {
    content.push({
      type: 'image_url',
      image_url: { url: img.data, detail: 'auto' },
    })
  }
  return content
}

function buildOpenAIBody(messages: ChatMessage[], config: ChatConfig, stream: boolean): Record<string, unknown> {
  return {
    model: config.model,
    messages: messages.map(m => ({ role: m.role, content: buildMessageContent(m) })),
    stream,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 4096,
  }
}

function buildAnthropicBody(messages: ChatMessage[], config: ChatConfig, stream: boolean): Record<string, unknown> {
  const systemMessages = messages.filter(m => m.role === 'system')
  const nonSystemMessages = messages.filter(m => m.role !== 'system')

  return {
    model: config.model,
    system: systemMessages.map(m => m.content).join('\n'),
    messages: nonSystemMessages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: buildAnthropicContent(m),
    })),
    stream,
    max_tokens: config.maxTokens ?? 4096,
    temperature: config.temperature ?? 0.7,
  }
}

function buildAnthropicContent(message: ChatMessage): string | unknown[] {
  if (!message.attachments || message.attachments.length === 0) {
    return message.content
  }
  const imageAtts = message.attachments.filter(a => a.type === 'image')
  if (imageAtts.length === 0) {
    return message.content
  }
  const content: unknown[] = []
  if (message.content) {
    content.push({ type: 'text', text: message.content })
  }
  for (const img of imageAtts) {
    const parsed = parseDataUrl(img.data)
    if (parsed) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: parsed.mediaType, data: parsed.base64 },
      })
    } else {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: img.data },
      })
    }
  }
  return content
}

function getEndpointUrls(baseUrl: string, providerId?: string): string[] {
  const base = baseUrl.replace(/\/+$/, '')

  if (base.endsWith('/chat/completions')) return [base]
  if (base.endsWith('/v1/chat/completions')) return [base]
  if (base.endsWith('/v3/chat/completions')) return [base]
  if (base.endsWith('/messages')) return [base]

  const urls: string[] = []
  const isVolc = providerId === 'volcengine' || base.includes('volces.com')
  const isXfyun = providerId === 'xfyun' || base.includes('xf-yun.com')
  const isMinimax = providerId === 'minimax' || base.includes('minimaxi.com')
  const isMoonshot = providerId === 'moonshot' || base.includes('moonshot.cn')
  const isLocal = providerId === 'local-llama' || base.includes('127.0.0.1') || base.includes('localhost')

  if (isLocal) {
    // 本地模型优先用带 v1 前缀的 OpenAI 兼容端点
    urls.push(`${base}/v1/chat/completions`)
  } else if (isVolc) {
    urls.push(`${base}/chat/completions`)
  } else if (isXfyun) {
    urls.push(`${base}/chat/completions`)
  } else if (isMinimax) {
    urls.push(`${base}/chat/completions`)
    urls.push(`${base}/v1/chat/completions`)
  } else if (isMoonshot) {
    urls.push(`${base}/chat/completions`)
  } else {
    urls.push(`${base}/chat/completions`)
    urls.push(`${base}/v1/chat/completions`)
    urls.push(`${base}/v3/chat/completions`)
  }

  return urls
}

function parseOpenAIStreamLine(line: string): StreamChunk | null {
  if (!line.startsWith('data: ')) return null
  const data = line.slice(6).trim()
  if (data === '[DONE]') return { content: '', done: true }

  try {
    const json = JSON.parse(data)

    if (json.error) {
      const errMsg = typeof json.error === 'string'
        ? json.error
        : json.error.message || json.error.code || JSON.stringify(json.error)
      return {
        content: '',
        done: true,
        error: errMsg,
      }
    }

    const choice = json.choices?.[0]
    if (!choice) {
      if (json.usage?.completion_tokens) {
        return { content: '', done: true, tokens: json.usage.completion_tokens }
      }
      return null
    }

    const delta = choice.delta?.content || choice.message?.content || ''
    const tokens = json.usage?.completion_tokens
    return { content: delta, done: choice.finish_reason === 'stop', tokens }
  } catch {
    return null
  }
}

function parseAnthropicStreamLine(line: string): StreamChunk | null {
  if (!line.startsWith('data: ')) return null
  const data = line.slice(6).trim()
  if (data === '[DONE]') return { content: '', done: true }

  try {
    const json = JSON.parse(data)
    if (json.type === 'content_block_delta' && json.delta?.text) {
      return { content: json.delta.text, done: false }
    }
    if (json.type === 'message_stop') {
      return { content: '', done: true }
    }
    return null
  } catch {
    return null
  }
}

function parseStreamLine(line: string, config: ChatConfig): StreamChunk | null {
  if (config.apiFormat === 'anthropic') {
    return parseAnthropicStreamLine(line)
  }
  return parseOpenAIStreamLine(line)
}

export async function* streamChat(
  messages: ChatMessage[],
  config: ChatConfig,
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  const headers = buildHeaders(config)
  const body = config.apiFormat === 'anthropic'
    ? buildAnthropicBody(messages, config, true)
    : buildOpenAIBody(messages, config, true)

  const endpoints = getEndpointUrls(config.baseUrl, config.providerId)
  const isXfyun = config.providerId === 'xfyun' || config.baseUrl.includes('xf-yun.com')
  const isLocal = config.providerId === 'local-llama' || config.baseUrl.includes('127.0.0.1') || config.baseUrl.includes('localhost')
  let lastError = ''

  for (const rawUrl of endpoints) {
    let url = rawUrl
    if (isXfyun) {
      const signed = await buildXfyunSignedUrl(rawUrl, config.apiKey)
      if (signed !== rawUrl) url = signed
    }
    let response: Response | null = null

    if (isLocal) {
      // 本地模型走代理 + 真实 SSE 流式，token 逐字显示，支持停止
      // 连接失败时自动重试，最多 3 次，间隔 3 秒（应对服务启动中/切换模型中）
      const MAX_RETRIES = 3
      const RETRY_DELAY = 3000
      let retryCount = 0
      let localLastError = ''

      while (retryCount <= MAX_RETRIES) {
        if (retryCount > 0) {
          if (signal?.aborted) {
            yield { content: '', done: true }
            return
          }
          await new Promise(r => setTimeout(r, RETRY_DELAY))
        }
        retryCount++
        try {
          const { proxyChatCompletionsStream } = await import('./apiProxy')
          const res = await proxyChatCompletionsStream(
            url,
            config.apiKey,
            config.model,
            body.messages as { role: string; content: string | unknown[] }[],
            signal,
            config.apiKey ? `Bearer ${config.apiKey}` : undefined
          )

          if (!res.ok) {
            let errBody = ''
            try { errBody = await res.text() } catch {}
            localLastError = `[${url}] HTTP ${res.status}: ${errBody.substring(0, 200)}`
            if (retryCount <= MAX_RETRIES) continue
            break
          }

          const reader = res.body?.getReader()
          if (!reader) {
            yield { content: '', done: true, error: '无法读取响应流' }
            return
          }

          const decoder = new TextDecoder()
          let buffer = ''
          let gotContent = false
          let streamDone = false
          let streamTokens = 0

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              if (signal?.aborted) {
                yield { content: gotContent ? '\n\n**[输出被截断，响应不完整]**' : '', done: true }
                return
              }

              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                if (line.trim() === '') continue
                const chunk = parseOpenAIStreamLine(line)
                if (chunk) {
                  if (chunk.content) gotContent = true
                  if (chunk.tokens) streamTokens = chunk.tokens
                  yield chunk
                  if (chunk.error) return
                  if (chunk.done) {
                    streamDone = true
                  }
                }
              }
            }

            if (signal?.aborted) {
              yield { content: gotContent ? '\n\n**[输出被截断，响应不完整]**' : '', done: true }
              return
            }

            if (!gotContent) {
              yield { content: '', done: true, error: '模型返回了空白响应，请重试或更换模型' }
            } else {
              yield { content: '', done: true, tokens: streamTokens || undefined }
            }
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
              yield { content: gotContent ? '\n\n**[输出被截断，响应不完整]**' : '', done: true }
              return
            }
            yield { content: '', done: true, error: String(error) }
          }
          return
        } catch (e) {
          localLastError = `[${url}] 连接失败 (尝试 ${retryCount}/${MAX_RETRIES}): ${e instanceof Error ? e.message : String(e)}`
        }
      }

      lastError = localLastError
      yield { content: '', done: true, error: localLastError }
      return
    } else {
      try {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal,
        })
      } catch (fetchErr) {
        // 如果信号已中止，跳过代理调用（避免 Rust 代理因无超时支持而长时间挂起）
        if (signal?.aborted) {
          lastError = `[${url}] 请求已中止`
          continue
        }
        try {
          response = await proxyChatCompletions(
            url,
            config.apiKey,
            config.model,
            body.messages as { role: string; content: string | unknown[] }[],
            signal,
            headers['Authorization']
          )
        } catch {
          lastError = `[${url}] 网络错误: ${fetchErr instanceof Error ? fetchErr.message : '未知错误'}`
          continue
        }
      }
    }

    if (!response) {
      lastError = `[${url}] 无响应`
      continue
    }

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status}`
      try {
        const errorBody = await response.text()
        try {
          const parsed = JSON.parse(errorBody)
          errorDetail = parsed.error?.message || parsed.error?.code || errorBody.substring(0, 200)
        } catch {
          errorDetail = errorBody.substring(0, 200)
        }
      } catch {}
      lastError = `[${url}] ${errorDetail}`
      continue
    }

    if (response.ok) {
      const reader = response.body?.getReader()
      if (!reader) {
        yield { content: '', done: true, error: '无法读取响应流' }
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      let gotContent = false

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.trim() === '') continue
            const chunk = parseStreamLine(line, config)
            if (chunk) {
              if (chunk.content) gotContent = true
              // 模型返回空白响应：finish_reason=stop 但从未输出任何内容
              if (chunk.done && !gotContent && !chunk.error) {
                yield { content: '', done: true, error: '模型返回了空白响应，请重试或更换模型' }
                return
              }
              yield chunk
              if (chunk.done || chunk.error) return
            }
          }
        }

        if (buffer.trim()) {
          const chunk = parseStreamLine(buffer, config)
          if (chunk) {
            if (chunk.content) gotContent = true
            yield chunk
          }
        }

        if (!gotContent && buffer.trim()) {
          try {
            const trimmed = buffer.trim()
            const json = JSON.parse(trimmed)
            // 检查是否有错误信息
            if (json.error) {
              const errMsg = json.error.message || json.error.code || json.error || '未知错误'
              yield { content: '', done: true, error: `模型返回错误: ${errMsg}` }
              return
            }
            const content = json.choices?.[0]?.message?.content || json.choices?.[0]?.delta?.content || json.response || json.content || json.message?.content || ''
            if (content) {
              yield { content, done: true }
              return
            }
          } catch {}
          // 有 buffer 但无法解析为有效内容，输出异常信息
          yield { content: '', done: true, error: `模型返回了无法识别的响应: ${buffer.trim().substring(0, 200)}` }
          return
        }

        if (!gotContent) {
          yield { content: '', done: true, error: '模型未返回任何内容' }
        } else {
          yield { content: '', done: true }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          yield { content: gotContent ? '\n\n**[输出被截断，响应不完整]**' : '', done: true }
          return
        }
        yield { content: '', done: true, error: String(error) }
      }
      return
    }

    lastError = `[${url}] 未知错误`
  }

  yield { content: '', done: true, error: lastError || '所有端点连接均失败' }
}

export async function sendChatMessage(
  messages: ChatMessage[],
  config: ChatConfig
): Promise<ChatMessage> {
  const fullContent: string[] = []

  const generator = streamChat(messages, config)
  for await (const chunk of generator) {
    if (chunk.error) {
      throw new Error(chunk.error)
    }
    if (chunk.content) {
      fullContent.push(chunk.content)
    }
  }

  return {
    id: Date.now().toString(),
    role: 'assistant',
    content: fullContent.join(''),
    timestamp: new Date().toLocaleString('zh-CN'),
  }
}
