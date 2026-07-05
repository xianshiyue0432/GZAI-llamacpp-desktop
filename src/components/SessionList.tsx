import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { selectFolderWithTree } from '../utils/selectFolder'
import type { FileTreeItem } from '../utils/selectFolder'
import { useChat } from '../contexts/ChatContext'
import type { ChatMessage } from '../api/chat'
import {
  Plus,
  Clock,
  List,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Search,
  Sparkles as CanAIIcon,
  Folder,
  Pin,
  ExternalLink,
  GitBranch,
  Archive,
  Trash2,
  Edit3,
  AlertTriangle
} from 'lucide-react'

export interface TaskSession {
  id: string
  name: string
  unread?: number
  timestamp?: string
}

export interface Task {
  id: string
  name: string
  folderPath: string
  fileTree?: FileTreeItem[]
  sessions: TaskSession[]
  expanded: boolean
}

export interface Session {
  id: string
  name: string
  type: 'chat' | 'task'
  unread?: number
  timestamp?: string
}

type NewTaskMenuPosition = { x: number; y: number } | null
type TaskMenuPosition = { x: number; y: number; taskId: string } | null
type SessionMenuPosition = { x: number; y: number; taskId: string; sessionId: string } | null

interface SessionListProps {
  tasks: Task[]
  sessions: Session[]
  onTasksChange: (tasks: Task[]) => void
  onSessionsChange: (sessions: Session[]) => void
  onSessionClick: (sessionId: string, sessionName: string, taskId?: string, folderPath?: string, fileTree?: FileTreeItem[]) => void
  selectedFolder?: string
  onTaskSelect?: (taskId: string, folderPath?: string, fileTree?: FileTreeItem[]) => void
  activeSessionId?: string
  activeTaskId?: string
  onSessionDelete?: (sessionId: string, taskId?: string) => void
}

export default function SessionList({ tasks, sessions, onTasksChange, onSessionsChange, onSessionClick, onTaskSelect, activeSessionId, activeTaskId, onSessionDelete }: SessionListProps) {
  const { getSessionMessages } = useChat()
  const [expandedSections, setExpandedSections] = useState({
    chat: true,
    task: true,
  })
  const [selectedSession, setSelectedSession] = useState('1')
  const [searchQuery, setSearchQuery] = useState('')
  const [newTaskMenuPos, setNewTaskMenuPos] = useState<NewTaskMenuPosition>(null)
  const [taskMenuPos, setTaskMenuPos] = useState<TaskMenuPosition>(null)
  const [sessionMenuPos, setSessionMenuPos] = useState<SessionMenuPosition>(null)
  const [renameSession, setRenameSession] = useState<{ taskId: string; sessionId: string; name: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ taskId: string; sessionId: string } | null>(null)

  // 记录手动重命名的会话，持久化到 localStorage
  const [renamedSessions, setRenamedSessions] = useState<Set<string>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('canai-renamed-sessions') || '[]')
      return new Set<string>(saved)
    } catch { return new Set<string>() }
  })

  const markSessionRenamed = (sessionId: string) => {
    renamedSessions.add(sessionId)
    setRenamedSessions(new Set(renamedSessions))
    try {
      localStorage.setItem('canai-renamed-sessions', JSON.stringify([...renamedSessions]))
    } catch {}
  }

  // 根据对话内容自动生成显示名称（手动重命名的会话不覆盖）
  const getDisplayName = (sessionId: string, storedName: string): string => {
    if (renamedSessions.has(sessionId)) return storedName
    const msgs = getSessionMessages(sessionId)
    if (!msgs || msgs.length === 0 || msgs.every(m => !m.content?.trim())) return storedName
    const firstUserMsg = msgs.find(m => m.role === 'user')
    if (!firstUserMsg?.content?.trim()) return storedName
    const content = firstUserMsg.content.trim()
    const first6 = content.length > 6 ? content.substring(0, 6) + '…' : content
    const sendTime = firstUserMsg.sendTime
    if (sendTime) {
      const now = new Date()
      const msgDate = new Date(sendTime)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const msgDay = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate())
      const diffDays = Math.round((todayStart.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24))
      let timeStr: string
      if (diffDays === 0) {
        timeStr = `${msgDate.getHours().toString().padStart(2, '0')}:${msgDate.getMinutes().toString().padStart(2, '0')}`
      } else if (diffDays === 1) {
        timeStr = '昨天'
      } else {
        timeStr = `${msgDate.getDate()}/${msgDate.getMonth() + 1}`
      }
      return `【${timeStr}】${first6}`
    }
    return first6
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const toggleTaskExpanded = (taskId: string) => {
    onTasksChange(tasks.map(task =>
      task.id === taskId ? { ...task, expanded: !task.expanded } : task
    ))
  }

  const handleNewTaskClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setNewTaskMenuPos({ x: rect.left - 120, y: rect.bottom })
  }

  const handleTaskMenuClick = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setTaskMenuPos({ x: rect.left - 120, y: rect.bottom + 8, taskId })
  }

  const handleSessionMenuClick = (e: React.MouseEvent, taskId: string, sessionId: string) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setSessionMenuPos({ x: rect.left - 100, y: rect.bottom + 8, taskId, sessionId })
  }

  const closeAllMenus = () => {
    setNewTaskMenuPos(null)
    setTaskMenuPos(null)
    setSessionMenuPos(null)
    if (renameSession) {
      if (renameSession.taskId === 'mock') {
        onSessionsChange(sessions.map(s =>
          s.id === renameSession.sessionId
            ? { ...s, name: renameSession.name }
            : s
        ))
      } else {
        onTasksChange(tasks.map(task =>
          task.id === renameSession.taskId
            ? {
                ...task,
                sessions: task.sessions.map(s =>
                  s.id === renameSession.sessionId
                    ? { ...s, name: renameSession.name }
                    : s
                )
              }
            : task
        ))
      }
      setRenameSession(null)
    }
  }

  const closeAllMenusRef = useRef(closeAllMenus)
  closeAllMenusRef.current = closeAllMenus

  useEffect(() => {
    const handleDocumentClick = () => {
      closeAllMenusRef.current()
    }

    document.addEventListener('mousedown', handleDocumentClick)
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
    }
  }, [])

  const createTask = (useDefaultFolder: boolean, folderPath?: string, fileTree?: FileTreeItem[]) => {
    const newTask: Task = {
      id: `t${Date.now()}`,
      name: useDefaultFolder ? '新建任务' : (folderPath ? folderPath.split(/[\\/]/).pop() || '选择的文件夹' : '选择的文件夹'),
      folderPath: useDefaultFolder ? '/workspace/default' : (folderPath || '/selected/folder'),
      fileTree,
      expanded: true,
      sessions: []
    }
    onTasksChange([newTask, ...tasks])
    closeAllMenus()
  }

  const createSessionForTask = (taskId: string) => {
    const now = new Date()
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const newSession: TaskSession = {
      id: `s${Date.now()}`,
      name: `【${timestamp}】新会话`,
      unread: 0,
      timestamp: '刚刚'
    }
    onTasksChange(tasks.map(task =>
      task.id === taskId ? { ...task, sessions: [...task.sessions, newSession] } : task
    ))
    closeAllMenus()
  }

  const deleteTask = (taskId: string) => {
    onTasksChange(tasks.filter(task => task.id !== taskId))
    closeAllMenus()
  }

  const deleteSession = (taskId: string, sessionId: string) => {
    setDeleteConfirm({ taskId, sessionId })
    setSessionMenuPos(null)
  }

  const confirmDeleteSession = () => {
    if (!deleteConfirm) return

    onSessionDelete?.(deleteConfirm.sessionId, deleteConfirm.taskId === 'mock' ? undefined : deleteConfirm.taskId)
    if (deleteConfirm.taskId === 'mock') {
      onSessionsChange(sessions.filter(s => s.id !== deleteConfirm.sessionId))
    } else {
      onTasksChange(tasks.map(task =>
        task.id === deleteConfirm.taskId
          ? { ...task, sessions: task.sessions.filter(s => s.id !== deleteConfirm.sessionId) }
          : task
      ))
    }
    setDeleteConfirm(null)
  }

  const cancelDeleteSession = () => {
    setDeleteConfirm(null)
  }

  const handleRenameSession = (taskId: string, sessionId: string) => {
    if (taskId === 'mock') {
      const session = sessions.find(s => s.id === sessionId)
      if (session) {
        setRenameSession({ taskId, sessionId, name: session.name })
      }
    } else {
      const task = tasks.find(t => t.id === taskId)
      const session = task?.sessions.find(s => s.id === sessionId)
      if (session) {
        setRenameSession({ taskId, sessionId, name: session.name })
      }
    }
    setNewTaskMenuPos(null)
    setTaskMenuPos(null)
    setSessionMenuPos(null)
  }

  const saveRenameSession = () => {
    if (!renameSession) return

    markSessionRenamed(renameSession.sessionId)
    if (renameSession.taskId === 'mock') {
      onSessionsChange(sessions.map(s =>
        s.id === renameSession.sessionId
          ? { ...s, name: renameSession.name }
          : s
      ))
    } else {
      onTasksChange(tasks.map(task =>
        task.id === renameSession.taskId
          ? {
              ...task,
              sessions: task.sessions.map(s =>
                s.id === renameSession.sessionId
                  ? { ...s, name: renameSession.name }
                  : s
              )
            }
          : task
      ))
    }
    setRenameSession(null)
  }

  return (
    <div className="h-full bg-white dark:bg-gray-800 flex flex-col relative overflow-hidden" onClick={closeAllMenus}>
      {/* 标题：图标 CanAI */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center overflow-hidden">
            <img src="/CanAI.png" alt="CanAI" className="w-full h-full object-cover" />
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">CanAI</span>
        </div>
      </div>

      {/* +新建会话 */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <button 
          className="w-full flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          onClick={() => {
            const newSessionId = `session-${Date.now()}`
            const newSessionName = `会话 ${new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
            onSessionClick(newSessionId, newSessionName, undefined, undefined, undefined)
          }}
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">新建会话</span>
        </button>
      </div>

      {/* 定时任务 */}
      <div className="px-3 py-2">
        <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <Clock className="w-4 h-4" />
          <span>定时任务</span>
        </button>
      </div>

      {/* 任务列表 */}
      <div className="py-2">
        <div 
          className="w-full flex items-center justify-between px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          onClick={() => toggleSection('task')}
        >
          <div className="flex items-center gap-2">
            {expandedSections.task ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <List className="w-4 h-4" />
            <span>任务列表</span>
          </div>
          <span 
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded cursor-pointer" 
            onClick={handleNewTaskClick}
          >
            <Plus className="w-4 h-4" />
          </span>
        </div>
        
        {expandedSections.task && (
          <div className="ml-4 max-h-72 overflow-y-auto custom-scrollbar">
            {tasks.map((task) => (
              <div key={task.id} className="py-1">
                {/* 任务标题行 */}
                <div 
                  className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                  onClick={() => { toggleTaskExpanded(task.id); onTaskSelect?.(task.id, task.folderPath, task.fileTree); }}
                >
                  <div className="flex items-center gap-2">
                    {task.expanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <img src="/Folder.ico" alt="Folder" className="w-8 h-8" />
                    <span className="truncate">{task.name}</span>
                    <span className="text-gray-400 text-xs ml-1">({task.sessions.length})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                      onClick={(e) => { e.stopPropagation(); createSessionForTask(task.id); }}
                      title="新建会话"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button 
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                      onClick={(e) => handleTaskMenuClick(e, task.id)}
                      title="更多选项"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* 任务下的会话列表 */}
                {task.expanded && (
                  <div className="ml-6 max-h-[160px] overflow-y-auto custom-scrollbar">
                    {task.sessions.map((session) => (
                      <div 
                        key={session.id} 
                        className="flex items-center justify-between px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                        onClick={() => onSessionClick(session.id, session.name, task.id, task.folderPath, task.fileTree)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <img src="/chat.ico" alt="Chat" className="w-7 h-7" />
                          {renameSession?.taskId === task.id && renameSession?.sessionId === session.id ? (
                            <input
                              type="text"
                              value={renameSession.name}
                              onChange={(e) => setRenameSession({ ...renameSession, name: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveRenameSession()
                                if (e.key === 'Escape') setRenameSession(null)
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="flex-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                          ) : (
                            <span className="truncate" title={session.name}>{getDisplayName(session.id, session.name)}</span>
                          )}
                        </div>
                        <button 
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleSessionMenuClick(e, task.id, session.id); }}
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 会话列表 */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* 会话列表标题 */}
        <div className="py-2 px-1">
          <div 
            className="w-full flex items-center justify-between px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            onClick={() => toggleSection('chat')}
          >
            <div className="flex items-center gap-2">
              {expandedSections.chat ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <MessageSquare className="w-4 h-4" />
              <span>会话列表</span>
            </div>
            <span className="text-gray-400 text-xs">{sessions.length}</span>
          </div>
        </div>
        
        {expandedSections.chat && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* 搜索框 */}
            <div className="px-5 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索会话..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {/* 会话列表内容 */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="px-1 py-2">
              
              {/* 独立会话 */}
              {sessions.map((session) => (
                <div key={session.id} className="relative">
                  <button
                    onClick={() => { setSelectedSession(session.id); onSessionClick(session.id, session.name); }}
                    title={session.name}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      (activeSessionId !== undefined ? activeSessionId : selectedSession) === session.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img src="/chat.ico" alt="Chat" className="w-full h-full object-cover" />
                      </div>
                      {renameSession?.taskId === 'mock' && renameSession?.sessionId === session.id ? (
                        <input
                          type="text"
                          value={renameSession.name}
                          onChange={(e) => setRenameSession({ ...renameSession, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRenameSession()
                            if (e.key === 'Escape') setRenameSession(null)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="flex-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      ) : (
                        <span className="truncate" title={session.name}>{getDisplayName(session.id, session.name)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {session.unread && (
                        <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                          {session.unread}
                        </span>
                      )}
                      <span className="text-gray-400 text-xs flex-shrink-0">
                        {session.timestamp}
                      </span>
                      <button 
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleSessionMenuClick(e, 'mock', session.id); }}
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </button>
                </div>
              ))}
              
              {/* 任务下的会话 */}
              {tasks.map((task) => (
                task.sessions.map((session) => (
                  <div key={`${task.id}-${session.id}`} className="relative">
                    <button
                      onClick={() => {
                        setSelectedSession(`${task.id}-${session.id}`)
                        onSessionClick(session.id, session.name, task.id, task.folderPath, task.fileTree)
                      }}
                      title={`${task.name} / ${session.name}`}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeSessionId !== undefined
                          ? (activeSessionId === session.id && activeTaskId === task.id)
                          : selectedSession === `${task.id}-${session.id}`
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          <img src="/Folder-chat.ico" alt="Folder Chat" className="w-full h-full object-cover" />
                        </div>
                        {renameSession?.taskId === task.id && renameSession?.sessionId === session.id ? (
                          <input
                            type="text"
                            value={renameSession.name}
                            onChange={(e) => setRenameSession({ ...renameSession, name: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveRenameSession()
                              if (e.key === 'Escape') setRenameSession(null)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="flex-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                        ) : (
                          <span className="truncate" title={session.name}>{task.name} / {getDisplayName(session.id, session.name)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {session.unread && session.unread > 0 && (
                          <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                            {session.unread}
                          </span>
                        )}
                        <span className="text-gray-400 text-xs flex-shrink-0">
                          {session.timestamp}
                        </span>
                        <button 
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleSessionMenuClick(e, task.id, session.id); }}
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </button>
                  </div>
                ))
              ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 新建任务菜单 - 使用 Portal 避免被遮挡 */}
      {newTaskMenuPos && createPortal(
        <div 
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[160px]"
          style={{ left: newTaskMenuPos.x, top: newTaskMenuPos.y }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button 
            className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 whitespace-nowrap"
            onClick={async () => {
                try {
                    const result = await selectFolderWithTree('选择任务文件夹')
                    if (result) {
                      createTask(false, result.folderPath, result.tree)
                    }
                } catch (e) {
                  console.error('选择文件夹失败:', e)
                }
              }}
          >
            <Folder className="w-4 h-4" />
            选择任务文件夹
          </button>
          <button 
            className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 whitespace-nowrap"
            onClick={() => createTask(true)}
          >
            <Folder className="w-4 h-4" />
            使用默认文件夹
          </button>
        </div>,
        document.body
      )}

      {/* 任务操作菜单 - 使用 Portal 避免被遮挡 */}
      {taskMenuPos && createPortal(
        <div 
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[200px]"
          style={{ left: taskMenuPos.x, top: taskMenuPos.y }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 whitespace-nowrap">
            <Pin className="w-4 h-4" />
            固定项目
          </button>
          <button className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 whitespace-nowrap">
            <ExternalLink className="w-4 h-4" />
            在资源管理器中打开
          </button>
          <button className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 whitespace-nowrap">
            <GitBranch className="w-4 h-4" />
            创建永久工作树
          </button>
          <button className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 whitespace-nowrap">
            <Edit3 className="w-4 h-4" />
            重命名项目
          </button>
          <button className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 whitespace-nowrap">
            <MessageSquare className="w-4 h-4" />
            打开此项目所有会话
          </button>
          <button className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 whitespace-nowrap">
            <Archive className="w-4 h-4" />
            存档对话
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          <button 
            className="w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 whitespace-nowrap"
            onClick={() => deleteTask(taskMenuPos.taskId)}
          >
            <Trash2 className="w-4 h-4" />
            删除任务
          </button>
        </div>,
        document.body
      )}

      {/* 会话操作菜单 - 使用 Portal 避免被遮挡 */}
      {sessionMenuPos && createPortal(
        <div 
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[100px]"
          style={{ left: sessionMenuPos.x, top: sessionMenuPos.y }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button 
            className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 whitespace-nowrap"
            onClick={() => handleRenameSession(sessionMenuPos.taskId, sessionMenuPos.sessionId)}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Edit3 className="w-4 h-4" />
            重命名
          </button>
          <button 
            className="w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 whitespace-nowrap"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              deleteSession(sessionMenuPos.taskId, sessionMenuPos.sessionId)
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Trash2 className="w-4 h-4" />
            删除
          </button>
        </div>,
        document.body
      )}

      {/* 删除确认对话框 */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={cancelDeleteSession}>
          <div 
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-6 min-w-[300px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">确认删除</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">确定要删除这个会话吗？此操作无法撤销。</p>
              <div className="flex gap-3">
                <button 
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  onClick={cancelDeleteSession}
                >
                  取消
                </button>
                <button 
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  onClick={confirmDeleteSession}
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
