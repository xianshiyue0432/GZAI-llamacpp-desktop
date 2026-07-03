import { useState, useEffect, useCallback } from 'react'
import { createRoot } from 'react-dom/client'

declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string
      types?: Array<{
        description: string
        accept: Record<string, string[]>
      }>
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: Blob) => Promise<void>
        close: () => Promise<void>
      }>
    }>
  }
}

const STORAGE_KEY = 'canai-image-viewer-data'
const ZOOM_STEP = 0.1
const MIN_ZOOM = 0.1
const MAX_ZOOM = 5

function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null
  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.8)',
        color: '#fff',
        padding: '10px 24px',
        borderRadius: 8,
        fontSize: 14,
        zIndex: 9999,
        backdropFilter: 'blur(8px)',
        animation: 'toastIn 0.2s ease-out',
      }}
    >
      {message}
    </div>
  )
}

function ImageViewerPopup() {
  const [src, setSrc] = useState('')
  const [name, setName] = useState('')
  const [zoom, setZoom] = useState(1)
  const [toast, setToast] = useState({ message: '', visible: false })

  const showToast = useCallback((msg: string) => {
    setToast({ message: msg, visible: true })
    setTimeout(() => setToast({ message: '', visible: false }), 2000)
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data.src) setSrc(data.src)
        if (data.name) setName(data.name)
      }
    } catch {}
  }, [])

  const close = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    window.close()
  }, [])

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)))
  }, [])

  useEffect(() => {
    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [close])

  const handleCopy = useCallback(async () => {
    if (!src) return
    try {
      const resp = await fetch(src)
      const blob = await resp.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      showToast('图片复制成功')
    } catch {
      try {
        await navigator.clipboard.writeText(src)
        showToast('图片复制成功')
      } catch {}
    }
  }, [src, showToast])

  const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)

  const handleDownload = useCallback(async () => {
    if (!src) return

    try {
      const resp = await fetch(src)
      const blob = await resp.blob()

      if ('showSaveFilePicker' in window) {
        try {
          const ext = name.split('.').pop()?.toLowerCase() || 'png'
          const mimeTypes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' }
          const handle = await window.showSaveFilePicker({
            suggestedName: name || 'image.png',
            types: [{ description: '图片文件', accept: { [mimeTypes[ext] || 'image/png']: [`.${ext}`] } }],
          })
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()
          showToast('图片保存成功')
          return
        } catch {
          return
        }
      }

      if (isTauri) {
        try {
          const { save } = await import('@tauri-apps/plugin-dialog')
          const savePath = await save({
            defaultPath: name || 'image.png',
            filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
          })
          if (!savePath) return
          const buffer = await blob.arrayBuffer()
          const { writeFile } = await import('@tauri-apps/plugin-fs')
          await writeFile(savePath, new Uint8Array(buffer))
          showToast('图片保存成功')
          return
        } catch {}
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name || 'image.png'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('图片下载已开始')
    } catch {
      showToast('下载失败')
    }
  }, [src, name, showToast])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <Toast message={toast.message} visible={toast.visible} />
      {/* 图片 */}
      {src && (
        <img
          src={src}
          alt={name}
          style={{
            maxWidth: '95vw',
            maxHeight: '95vh',
            objectFit: 'contain',
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
          }}
          draggable={false}
        />
      )}

      {/* 顶栏 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
        }}
      >
        <span
          style={{
            color: '#fff',
            fontSize: 13,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 400,
          }}
        >
          {name}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleCopy}
            style={btnStyle}
            title="复制图片到剪贴板"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
          <button
            onClick={handleDownload}
            style={btnStyle}
            title="下载图片"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button
            onClick={close}
            style={btnStyle}
            title="关闭 (Esc)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {/* 底栏 - 缩放控制 */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(0,0,0,0.5)',
          borderRadius: 999,
          padding: '6px 16px',
          backdropFilter: 'blur(8px)',
        }}
      >
        <button
          onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
          style={zoomBtnStyle}
          title="缩小"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <span style={{ color: '#fff', fontSize: 13, minWidth: 50, textAlign: 'center', fontFamily: 'monospace' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
          style={zoomBtnStyle}
          title="放大"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <button
          onClick={() => setZoom(1)}
          style={{
            ...zoomBtnStyle,
            fontSize: 11,
            padding: '4px 8px',
          }}
          title="重置缩放"
        >
          重置
        </button>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  border: 'none',
  borderRadius: 8,
  padding: 8,
  color: '#fff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.15s',
}

const zoomBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderRadius: 6,
  padding: 6,
  color: '#fff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

// 注入 toast 动画样式
const styleEl = document.createElement('style')
styleEl.textContent = `@keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(-10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`
document.head.appendChild(styleEl)

const root = createRoot(document.getElementById('root')!)
root.render(<ImageViewerPopup />)
