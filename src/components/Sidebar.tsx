import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  MessageSquare,
  ListTodo,
  Users,
  Wrench,
  Terminal,
  Settings,
  User,
  Info,
  X
} from 'lucide-react'
import { version as appVersion } from '../../package.json'

type ViewType = 'chat' | 'expert' | 'task' | 'tools' | 'settings'

const APP_VERSION = appVersion
const APP_NAME = 'CanAI'

interface SidebarProps {
  activeView: ViewType
  setActiveView: (view: ViewType) => void
  projectFolder?: string
}

function NavButton({ active, onClick, icon: Icon, title }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 relative group ${
        active
          ? 'bg-blue-500 text-white'
          : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'
      }`}
      title={title}
    >
      <Icon className="w-5 h-5" />
      {active && (
        <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r" />
      )}
    </button>
  )
}

export default function Sidebar({ activeView, setActiveView, projectFolder }: SidebarProps) {
  const [showVersion, setShowVersion] = useState(false)

  const openTerminalWindow = useCallback(async () => {
    const cwd = projectFolder && projectFolder !== '选择项目...' ? encodeURIComponent(projectFolder) : ''
    const url = cwd ? `/terminal.html?cwd=${cwd}` : '/terminal.html'

    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      const existing = await WebviewWindow.getByLabel('terminal')
      if (existing) {
        existing.setFocus()
        return
      }
      const terminalWindow = new WebviewWindow('terminal', {
        url,
        width: 1000,
        height: 700,
        title: 'CanAI - 终端',
        center: true,
        resizable: true,
        minimizable: true,
        maximizable: true,
        closable: true,
      })
      terminalWindow.once('tauri://created', () => {})
      terminalWindow.once('tauri://error', () => {
        window.open(url, '_blank', 'width=1000,height=700')
      })
    } catch {
      window.open(url, '_blank', 'width=1000,height=700')
    }
  }, [projectFolder])

  return (
    <div className="w-16 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-4">
      <div className="flex-1 flex flex-col items-center gap-2">
        <NavButton active={activeView === 'chat'} onClick={() => setActiveView('chat')} icon={MessageSquare} title="对话" />
        <NavButton active={activeView === 'task'} onClick={() => setActiveView('task')} icon={ListTodo} title="任务" />
        <NavButton active={activeView === 'expert'} onClick={() => setActiveView('expert')} icon={Users} title="专家" />
        <NavButton active={activeView === 'tools'} onClick={() => setActiveView('tools')} icon={Wrench} title="工具" />
        <NavButton active={false} onClick={openTerminalWindow} icon={Terminal} title="终端" />
        <NavButton active={activeView === 'settings'} onClick={() => setActiveView('settings')} icon={Settings} title="设置" />
      </div>

      <button
        onClick={() => setShowVersion(true)}
        className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        title="版本信息"
      >
        <Info className="w-5 h-5" />
      </button>

      {showVersion && createPortal(
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
          onClick={() => setShowVersion(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-6 min-w-[320px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">版本信息</h3>
              <button
                onClick={() => setShowVersion(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">应用名称</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{APP_NAME}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">版本号</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">v{APP_VERSION}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">构建类型</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Desktop</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">平台</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Windows</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
