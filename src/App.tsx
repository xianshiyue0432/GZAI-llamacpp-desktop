import { useState, useEffect, useRef } from 'react'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { ChatProvider } from './contexts/ChatContext'
import Sidebar from './components/Sidebar'
import SessionList from './components/SessionList'
import ChatWindow from './components/ChatWindow'
import FileExplorer from './components/FileExplorer'
import Settings from './components/Settings'
import Tools from './components/Tools'
import Experts from './components/Experts'
import type { FileTreeItem } from './utils/selectFolder'
import type { Task, Session } from './components/SessionList'
import { getCurrentWindow } from '@tauri-apps/api/window'

type ViewType = 'chat' | 'expert' | 'task' | 'tools' | 'settings'

const STORAGE_KEY_TASKS = 'canai-tasks'
const STORAGE_KEY_SESSIONS = 'canai-sessions'
const TASKS_FILE_NAME = 'canai-tasks.json'
const SESSIONS_FILE_NAME = 'canai-sessions.json'
let appDataDirPath: string | null = null

async function getAppDataDir(): Promise<string> {
  if (appDataDirPath) return appDataDirPath
  const { appDataDir } = await import('@tauri-apps/api/path')
  appDataDirPath = await appDataDir()
  return appDataDirPath
}

async function saveToFile(filename: string, data: unknown): Promise<void> {
  try {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const dir = await getAppDataDir()
    await writeTextFile(`${dir}${filename}`, JSON.stringify(data))
  } catch (e) {
    console.error(`保存 ${filename} 到文件失败`, e)
  }
}

async function loadFromFile<T>(filename: string): Promise<T | null> {
  try {
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const dir = await getAppDataDir()
    const content = await readTextFile(`${dir}${filename}`)
    return JSON.parse(content)
  } catch {
    return null
  }
}

const defaultSessions: Session[] = [
  { id: '1', name: 'ClaudeGZ', type: 'chat', unread: 1, timestamp: '刚刚' },
  { id: '2', name: '会话 1', type: 'chat', timestamp: '今天' },
  { id: '3', name: 'warp', type: 'chat', timestamp: '昨天' },
  { id: '4', name: 'deepseek-tui-dm', type: 'chat', timestamp: '昨天' },
  { id: '5', name: 'CodeX', type: 'chat', timestamp: '2天前' },
]

const defaultTasks: Task[] = [
  {
    id: 't1',
    name: 'AI-Work',
    folderPath: '/workspace/ai-project',
    expanded: true,
    sessions: [
      { id: 's1', name: 'New Session', unread: 0, timestamp: '刚刚' },
      { id: 's2', name: 'New Session', unread: 0, timestamp: '今天' },
      { id: 's3', name: '帮我清理C盘文件，把缓...', unread: 0, timestamp: '昨天' },
    ]
  },
  {
    id: 't2',
    name: 'ClaudeGZ',
    folderPath: '/workspace/claude',
    expanded: false,
    sessions: [
      { id: 's4', name: '用户上传了一张图片，...', unread: 1, timestamp: '刚刚' },
      { id: 's5', name: '会话测试', unread: 0, timestamp: '昨天' },
    ]
  },
]

function loadTasks(): Task[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TASKS)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return defaultTasks
}

function loadSessions(): Session[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SESSIONS)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return defaultSessions
}

function saveTasks(tasks: Task[]) {
  try {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks))
  } catch (e) {
    console.error('保存任务列表失败', e)
  }
}

function saveSessions(sessions: Session[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions))
  } catch (e) {
    console.error('保存会话列表失败', e)
  }
}

function AppContent() {
  const { theme } = useTheme()

  // Apply theme class to root element (same approach as ClaudeGZ-Rust)
  useEffect(() => {
    const root = document.documentElement
    const themeClasses = ['theme-clean', 'theme-light', 'theme-dark', 'theme-vivid', 'theme-eye', 'light', 'dark']
    root.classList.remove(...themeClasses)
    root.classList.add(`theme-${theme}`)
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      root.classList.add('light')
      root.classList.remove('dark')
    }
  }, [theme])

  const [activeView, setActiveView] = useState<ViewType>('chat')
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<string>('选择项目...')
  const [currentTaskFolder, setCurrentTaskFolder] = useState<string>('选择项目...')
  const [selectedSession, setSelectedSession] = useState<{ id: string; name: string; taskId?: string } | null>(null)
  const [fileTree, setFileTree] = useState<FileTreeItem[] | null>(null)

  const [tasks, setTasks] = useState<Task[]>(() => loadTasks())
  const [sessions, setSessions] = useState<Session[]>(() => loadSessions())

  // 使用 ref 跟踪最新值
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions

  // localStorage 快速保存（同步）
  useEffect(() => {
    saveTasks(tasks)
  }, [tasks])

  useEffect(() => {
    saveSessions(sessions)
  }, [sessions])

  // 文件可靠保存（异步）
  useEffect(() => {
    saveToFile(TASKS_FILE_NAME, tasks)
  }, [tasks])

  useEffect(() => {
    saveToFile(SESSIONS_FILE_NAME, sessions)
  }, [sessions])

  // 启动时从文件加载（文件是最终可靠数据源）
  useEffect(() => {
    Promise.all([
      loadFromFile<Task[]>(TASKS_FILE_NAME),
      loadFromFile<Session[]>(SESSIONS_FILE_NAME),
    ]).then(([fileTasks, fileSessions]) => {
      if (fileTasks && fileTasks.length > 0) setTasks(fileTasks)
      if (fileSessions && fileSessions.length > 0) setSessions(fileSessions)
    })
  }, [])

  // 窗口关闭前强制刷写到文件（await 确保写入完成后再关闭）
  useEffect(() => {
    let cleanup: (() => void) | null = null
    getCurrentWindow().onCloseRequested(async () => {
      saveTasks(tasksRef.current)
      saveSessions(sessionsRef.current)
      await Promise.all([
        saveToFile(TASKS_FILE_NAME, tasksRef.current),
        saveToFile(SESSIONS_FILE_NAME, sessionsRef.current),
      ])
    }).then(fn => {
      cleanup = () => { fn() }
    }).catch(() => {
      const handleBeforeUnload = () => {
        saveTasks(tasksRef.current)
        saveSessions(sessionsRef.current)
        saveToFile(TASKS_FILE_NAME, tasksRef.current)
        saveToFile(SESSIONS_FILE_NAME, sessionsRef.current)
      }
      window.addEventListener('beforeunload', handleBeforeUnload)
      cleanup = () => window.removeEventListener('beforeunload', handleBeforeUnload)
    })
    return () => { cleanup?.() }
  }, [])

  const handleSessionSelect = (sessionId: string, sessionName: string, taskId?: string, folderPath?: string, tree?: FileTreeItem[]) => {
    console.log('Selected session:', sessionId, sessionName, taskId, folderPath)
    
    setSelectedSession({ id: sessionId, name: sessionName, taskId })
    
    if (folderPath) {
      setCurrentTaskFolder(folderPath)
      setSelectedFolder(folderPath)
    }
    if (tree) {
      setFileTree(tree)
    }
  }

  const handleFolderSelect = (folderPath: string) => {
    setSelectedFolder(folderPath)
  }

  const handleTaskSelect = (taskId: string, folderPath?: string, tree?: FileTreeItem[]) => {
    if (folderPath) {
      setCurrentTaskFolder(folderPath)
      setSelectedFolder(folderPath)
    }
    if (tree) {
      setFileTree(tree)
    }
  }

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
      <Sidebar activeView={activeView} setActiveView={setActiveView} projectFolder={currentTaskFolder} />
      
      {activeView !== 'settings' && activeView !== 'tools' && activeView !== 'expert' && (
        <>
          <div
            className={`flex-shrink-0 transition-all duration-300 border-r-2 border-gray-200 dark:border-gray-700 overflow-hidden ${
              leftPanelCollapsed ? 'w-0' : 'w-64'
            }`}
          >
            <SessionList 
              tasks={tasks}
              sessions={sessions}
              onTasksChange={setTasks}
              onSessionsChange={setSessions}
              onSessionClick={handleSessionSelect}
              selectedFolder={selectedFolder}
              onTaskSelect={handleTaskSelect}
            />
          </div>
          
          <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-800">
            <ChatWindow 
              leftPanelCollapsed={leftPanelCollapsed}
              rightPanelCollapsed={rightPanelCollapsed}
              onToggleLeftPanel={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
              onToggleRightPanel={() => setRightPanelCollapsed(!rightPanelCollapsed)}
              onSessionSelect={handleSessionSelect}
              selectedFolder={currentTaskFolder}
              onFolderSelect={handleFolderSelect}
              selectedSession={selectedSession}
            />
          </div>
          
          <div
            className={`flex-shrink-0 transition-all duration-300 border-l-2 border-gray-200 dark:border-gray-700 ${
              rightPanelCollapsed ? 'w-0 overflow-hidden' : 'w-64'
            }`}
          >
            <FileExplorer 
              selectedFolder={selectedFolder}
              fileTree={fileTree}
              onClose={() => setRightPanelCollapsed(true)} 
            />
          </div>
        </>
      )}
      
      {activeView === 'settings' && (
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          <Settings />
        </div>
      )}

      {activeView === 'tools' && (
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          <Tools projectFolder={currentTaskFolder} />
        </div>
      )}

      {activeView === 'expert' && (
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          <Experts />
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <ChatProvider>
        <AppContent />
      </ChatProvider>
    </ThemeProvider>
  )
}

export default App
