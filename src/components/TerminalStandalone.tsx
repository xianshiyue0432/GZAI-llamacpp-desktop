import { useEffect, useRef, useCallback, useState } from 'react'
import '@xterm/xterm/css/xterm.css'
import { terminalApi } from '../api/terminal'
import { getCurrentWindow } from '@tauri-apps/api/window'

export default function TerminalStandalone() {
  const terminalRef = useRef<HTMLDivElement>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const cwdRef = useRef('C:\\')
  const unlistenRef = useRef<(() => void)[]>([])

  const params = new URLSearchParams(window.location.search)
  const cwdParam = params.get('cwd')
  const cwd = cwdParam || 'C:\\'

  useEffect(() => {
    const el = terminalRef.current
    if (!el) return

    let disposed = false

    const init = async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
      ])

      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        lineHeight: 1.25,
        fontFamily: "Consolas, 'Courier New', monospace",
        theme: {
          background: '#0e0e12',
          foreground: '#d7d2d0',
          cursor: '#ffb59f',
          selectionBackground: '#5f4a40',
          black: '#1f1f1f', red: '#ff6d67', green: '#7ef18a',
          yellow: '#f8c55f', blue: '#77a8ff', magenta: '#d699ff',
          cyan: '#61d6d6', white: '#d7d2d0',
          brightBlack: '#8f8683', brightRed: '#ff8a85',
          brightGreen: '#9ff7a7', brightYellow: '#ffdd7a',
          brightBlue: '#a6c5ff', brightMagenta: '#e3b8ff',
          brightCyan: '#8ceeee', brightWhite: '#ffffff',
        },
      })

      const fit = new FitAddon()
      terminal.loadAddon(fit)
      terminal.open(el)
      setTimeout(() => fit.fit(), 50)

      try {
        const result = await terminalApi.spawn({ cols: 80, rows: 24, cwd: cwd || undefined })
        setSessionId(result.session_id)
        cwdRef.current = result.cwd

        const unlistenOut = await terminalApi.onOutput((payload) => {
          if (!disposed && payload.session_id === result.session_id) {
            terminal.write(payload.data)
          }
        })
        const unlistenExit = await terminalApi.onExit((payload) => {
          if (!disposed && payload.session_id === result.session_id) {
            terminal.writeln('\r\n\x1b[33m[进程已退出，代码: ' + payload.code + ']\x1b[0m')
          }
        })
        unlistenRef.current = [unlistenOut, unlistenExit]

        terminal.onData((data) => {
          if (result.session_id) {
            terminalApi.write(result.session_id, data).catch(() => {})
          }
        })

        terminal.writeln(`\x1b[32m终端就绪 — 工作目录: ${result.cwd}\x1b[0m\r\n`)
        terminal.writeln(`\x1b[90mShell: ${result.shell}\x1b[0m\r\n`)
      } catch (err) {
        terminal.writeln(`\x1b[31m终端启动失败: ${err}\x1b[0m\r\n`)
        terminal.writeln('\x1b[33m尝试使用备用终端...\x1b[0m\r\n')
        try {
          const { Command } = await import('@tauri-apps/plugin-shell')
          const command = Command.create('powershell', [], { cwd: cwd || 'C:\\' })
          const child = await command.spawn()
          const fakeId = 0
          setSessionId(fakeId)
          command.stdout.on('data', (data: string) => { if (!disposed) terminal.write(data) })
          command.stderr.on('data', (data: string) => { if (!disposed) terminal.write(data) })
          command.on('close', () => { if (!disposed) terminal.writeln('\r\n[进程已退出]') })
          command.on('error', (errMsg: string) => { if (!disposed) terminal.writeln('\r\n\x1b[31m错误: ' + errMsg + '\x1b[0m') })
          terminal.onData((data) => { child.write(data).catch(() => {}) })
          terminal.writeln(`\x1b[32m备用终端就绪 — ${cwd}\x1b[0m\r\n`)
        } catch (fallbackErr) {
          terminal.writeln(`\x1b[31m备用终端也启动失败: ${fallbackErr}\x1b[0m\r\n`)
          terminal.writeln('\x1b[33m终端已就绪（演示模式）\x1b[0m\r\n')
          terminal.onData((data) => terminal.write(data))
        }
      }

      const ro = new ResizeObserver(() => { try { fit.fit() } catch {} })
      ro.observe(el)

      const handleResize = () => { try { fit.fit() } catch {} }
      window.addEventListener('resize', handleResize)

      ;(el as any).__cleanup = () => {
        window.removeEventListener('resize', handleResize)
        ro.disconnect()
      }
    }

    el.innerHTML = ''
    init()

    return () => {
      disposed = true
      if (sessionId) {
        terminalApi.kill(sessionId).catch(() => {})
      }
      unlistenRef.current.forEach(u => u())
    }
  }, [cwd])

  const handleClose = useCallback(() => {
    if (sessionId) {
      terminalApi.kill(sessionId).catch(() => {})
    }
    getCurrentWindow().close()
  }, [sessionId])

  const handleMinimize = useCallback(() => {
    getCurrentWindow().minimize()
  }, [])

  const handleMaximize = useCallback(() => {
    getCurrentWindow().toggleMaximize()
  }, [])

  return (
    <div className="h-screen flex flex-col bg-[#0d0d0d]">
      <div
        className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] cursor-move select-none flex-shrink-0 border-b border-gray-700"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 cursor-pointer transition-colors" onClick={handleClose} />
            <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 cursor-pointer transition-colors" onClick={handleMinimize} />
            <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 cursor-pointer transition-colors" onClick={handleMaximize} />
          </div>
          <span className="text-green-400 text-sm font-bold">终端</span>
          <span className="text-[10px] text-gray-500 ml-2 max-w-[400px] truncate" title={cwdRef.current}>{cwdRef.current}</span>
          {sessionId && <span className="text-[10px] text-green-600">●</span>}
        </div>
      </div>
      <div ref={terminalRef} className="flex-1 overflow-hidden" style={{ padding: '4px' }} />
    </div>
  )
}
