import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { invoke } from '@tauri-apps/api/core'
import { selectFolderWithTree } from '../utils/selectFolder'
import { useChat } from '../contexts/ChatContext'
import type { Attachment } from '../api/chat'
import { 
  Send, 
  Paperclip, 
  Mic, 
  RefreshCw,
  Share2,
  User,
  Bot,
  Tag,
  GitBranch,
  Settings2,
  Shield,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  X,
  Zap,
  StopCircle,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  MessageSquare,
  Compass,
  AlertTriangle,
  Check,
  Minus,
  Search,
  Brain,
  Plus,
  Terminal,
  Wifi,
  Star,
  Trash2,
  Copy,
  Undo2,
  ArrowUp,
  File,
  Image,
  ZoomIn,
  ExternalLink,
  FileText,
  Film,
  Music,
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  thinking?: boolean
}

const contextSizes = ['32KB', '64KB', '128KB', '200KB', '512KB', '1.0MB']

interface Tab {
  id: string
  name: string
  taskId?: string
}

interface ChatWindowProps {
  leftPanelCollapsed: boolean
  rightPanelCollapsed: boolean
  onToggleLeftPanel: () => void
  onToggleRightPanel: () => void
  onSessionSelect: (sessionId: string, sessionName: string, taskId?: string, folderPath?: string) => void
  selectedFolder: string
  onFolderSelect: (folderPath: string) => void
  selectedSession: { id: string; name: string; taskId?: string } | null
  deletedSessionKey?: number
}

export default function ChatWindow({
  leftPanelCollapsed,
  rightPanelCollapsed,
  onToggleLeftPanel,
  onToggleRightPanel,
  onSessionSelect,
  selectedFolder,
  onFolderSelect,
  selectedSession,
  deletedSessionKey,
}: ChatWindowProps) {
  const { messages, getSessionMessages, sendMessage: sendChatMessage, streamingSessions, activeModel, activeModelId, availableModels, providers, setActiveModelId, stopStreaming, clearSessionMessages, reloadProviders, defaultModelId, setDefaultModelId, setProviders, modelStatuses, setModelStatus, toggleMessageMark, retryMessage, deleteMessage, copyMessage, rollbackToMessage, undoRollback, isRolledBack, rollbackState, messageQueue, enqueueMessage, removeQueuedMessage, sendQueuedMessage, moveQueuedMessageToFront, dequeueMessageToInput, getQueuedMessages, llamaServiceStatus, setLlamaServiceStatus } = useChat()
  const [inputValue, setInputValue] = useState('')
  const [showContextModal, setShowContextModal] = useState(false)
  const [showFolderDropdown, setShowFolderDropdown] = useState(false)
  const folderDropdownRef = useRef<HTMLDivElement>(null)
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const permissionModalRef = useRef<HTMLDivElement>(null)
  
  const permissionOptions = [
    {
      id: 'ask',
      name: '权限',
      description: 'CLI 请求时确认文件编辑和高风险命令',
      icon: 'shield',
    },
    {
      id: 'auto',
      name: '自动接受编辑',
      description: '无需询问即可写入磁盘',
      icon: 'zap',
    },
    {
      id: 'plan',
      name: '计划模式',
      description: '仅架构和推理，不操作文件',
      icon: 'compass',
    },
    {
      id: 'bypass',
      name: '跳过权限',
      description: '对 Shell 和文件系统的完整工具访问',
      icon: 'alert-triangle',
    },
  ]
  
  const [selectedPermission, setSelectedPermission] = useState('auto')
  
  const [showModelModal, setShowModelModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [reasoningEffort, setReasoningEffort] = useState<'low' | 'medium' | 'high' | 'maximum'>('medium')
  const modelModalRef = useRef<HTMLDivElement>(null)

  const [showGitModal, setShowGitModal] = useState(false)
  const gitModalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkLlama = async () => {
      try {
        const sconfig = JSON.parse(localStorage.getItem('canai-local-server-config') || '{}')
        if (sconfig.serverUrl) {
          const ok: boolean = await invoke('llama_cpp_check_health', { url: sconfig.serverUrl })
          setLlamaServiceStatus(ok ? 'running' : 'stopped')
        } else {
          setLlamaServiceStatus('stopped')
        }
      } catch { setLlamaServiceStatus('stopped') }
    }
    checkLlama()
    const interval = setInterval(checkLlama, 15000)
    return () => clearInterval(interval)
  }, [])

  interface SkillItem {
    id: string
    name: string
    selected: boolean
  }

  const [showSkillModal, setShowSkillModal] = useState(false)
  const [skillSearchQuery, setSkillSearchQuery] = useState('')
  const skillModalRef = useRef<HTMLDivElement>(null)
  const [skills, setSkills] = useState<SkillItem[]>([
    { id: 'code-review', name: '代码审查', selected: false },
    { id: 'refactor', name: '代码重构', selected: false },
    { id: 'debug', name: '调试助手', selected: true },
    { id: 'test', name: '测试编写', selected: false },
    { id: 'doc', name: '文档生成', selected: false },
    { id: 'translate', name: '翻译', selected: false },
    { id: 'explain', name: '代码解释', selected: true },
    { id: 'optimize', name: '性能优化', selected: false },
  ])

  interface ToolItem {
    id: string
    name: string
    category: 'MCP' | '插件'
    selected: boolean
  }

  const [showToolModal, setShowToolModal] = useState(false)
  const [toolSearchQuery, setToolSearchQuery] = useState('')
  const toolModalRef = useRef<HTMLDivElement>(null)
  const [tools, setTools] = useState<ToolItem[]>([
    { id: 'filesystem', name: '文件系统', category: 'MCP', selected: true },
    { id: 'shell', name: 'Shell 命令', category: 'MCP', selected: true },
    { id: 'github', name: 'GitHub', category: 'MCP', selected: false },
    { id: 'search', name: '搜索', category: 'MCP', selected: false },
    { id: 'web-fetch', name: '网页抓取', category: 'MCP', selected: true },
    { id: 'browser', name: '浏览器控制', category: '插件', selected: false },
    { id: 'vscode', name: 'VSCode 集成', category: '插件', selected: true },
    { id: 'terminal', name: '终端插件', category: '插件', selected: false },
  ])

  const skillAllSelected = skills.every(s => s.selected)
  const selectedSkillCount = skills.filter(s => s.selected).length

  const toolAllSelected = tools.every(t => t.selected)
  const selectedToolCount = tools.filter(t => t.selected).length

  interface ExpertItem {
    id: string
    name: string
    description: string
    selected: boolean
  }

  interface ExpertConfig {
    systemPrompt: string
    temperature: number
    maxTokens: number
    enableMemory: boolean
    enableKnowledge: boolean
    skillIds: string[]
    toolIds: string[]
  }

  const [showExpertModal, setShowExpertModal] = useState(false)
  const [expertSearchQuery, setExpertSearchQuery] = useState('')
  const expertModalRef = useRef<HTMLDivElement>(null)
  const [experts, setExperts] = useState<ExpertItem[]>([
    { id: 'code-architect', name: '代码架构师', description: '负责系统架构设计和代码结构优化', selected: false },
    { id: 'debug-specialist', name: '调试专家', description: '精通代码调试和错误排查', selected: true },
    { id: 'ui-designer', name: 'UI 设计师', description: '专注用户界面设计和交互体验', selected: false },
    { id: 'data-analyst', name: '数据分析师', description: '擅长数据处理和统计分析', selected: false },
    { id: 'security-expert', name: '安全专家', description: '负责代码安全审计和漏洞修复', selected: false },
    { id: 'performance-engineer', name: '性能优化师', description: '专注于系统性能分析和优化', selected: true },
  ])
  const [configuringExpert, setConfiguringExpert] = useState<string | null>(null)
  const [expertConfigs, setExpertConfigs] = useState<Record<string, ExpertConfig>>({
    'code-architect': { systemPrompt: '你是一位经验丰富的代码架构师，擅长系统设计和代码结构优化。', temperature: 0.3, maxTokens: 4096, enableMemory: true, enableKnowledge: true, skillIds: ['code-review', 'refactor', 'explain'], toolIds: ['filesystem', 'search'] },
    'debug-specialist': { systemPrompt: '你是一位专业的调试专家，精通各种编程语言的调试技巧。', temperature: 0.2, maxTokens: 8192, enableMemory: true, enableKnowledge: false, skillIds: ['debug', 'explain'], toolIds: ['shell', 'filesystem', 'search'] },
    'ui-designer': { systemPrompt: '你是一位优秀的 UI 设计师，擅长用户界面设计和交互体验优化。', temperature: 0.7, maxTokens: 4096, enableMemory: false, enableKnowledge: true, skillIds: ['code-review', 'optimize'], toolIds: ['browser', 'web-fetch'] },
    'data-analyst': { systemPrompt: '你是一位专业的数据分析师，擅长数据处理、统计分析和可视化。', temperature: 0.4, maxTokens: 8192, enableMemory: true, enableKnowledge: true, skillIds: ['doc', 'translate', 'explain'], toolIds: ['search', 'web-fetch', 'filesystem'] },
    'security-expert': { systemPrompt: '你是一位资深的安全专家，负责代码安全审计和漏洞修复。', temperature: 0.3, maxTokens: 4096, enableMemory: false, enableKnowledge: true, skillIds: ['code-review', 'debug'], toolIds: ['filesystem', 'shell', 'search'] },
    'performance-engineer': { systemPrompt: '你是一位性能优化专家，专注于系统性能分析和代码优化。', temperature: 0.4, maxTokens: 8192, enableMemory: true, enableKnowledge: true, skillIds: ['optimize', 'refactor', 'debug'], toolIds: ['shell', 'search', 'github'] },
  })

  const expertAllSelected = experts.every(e => e.selected)
  const selectedExpertCount = experts.filter(e => e.selected).length

  const [addingToolCategory, setAddingToolCategory] = useState<'MCP' | '插件' | null>(null)
  const [pendingToolIds, setPendingToolIds] = useState<string[]>([])
  const [addingSkill, setAddingSkill] = useState(false)
  const [pendingSkillIds, setPendingSkillIds] = useState<string[]>([])
  
  // 消息队列状态
  const [queueExpanded, setQueueExpanded] = useState(true)
  const [copiedQueueId, setCopiedQueueId] = useState<string | null>(null)
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)
  const [copyErrorMsg, setCopyErrorMsg] = useState<string | null>(null)

  // 自动滚动
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // 打开独立窗口查看图片
  const openImageViewerWindow = useCallback(async () => {
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      const existing = await WebviewWindow.getByLabel('image-viewer')
      if (existing) {
        existing.setFocus()
        return
      }
      const win = new WebviewWindow('image-viewer', {
        url: '/image-viewer.html',
        title: '图片查看器',
        width: 900,
        height: 700,
        center: true,
        resizable: true,
        decorations: true,
        minimizable: false,
        maximizable: true,
      })
      win.once('tauri://error', () => {
        window.open('/image-viewer.html', '_blank', 'width=900,height=700')
      })
    } catch {
      window.open('/image-viewer.html', '_blank', 'width=900,height=700')
    }
  }, [])

  // 输入框附件预览
  const [inputAttachments, setInputAttachments] = useState<Attachment[]>([])

  // 文件选择隐藏input
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const recentFolders = [
    'E:\\Workspace\\AI-Work',
    'E:\\Workspace\\ClaudeGZ',
    'E:\\Workspace\\Project-X',
    'E:\\Documents\\Code',
  ]
  const [contextMaxSize, setContextMaxSize] = useState('128KB')
  const [customSize, setCustomSize] = useState('')

  // 估算文本token数（中英文混合估算）
  const estimateTokens = (text: string): number => {
    let weight = 0
    for (const ch of text) {
      weight += ch.charCodeAt(0) > 127 ? 1.5 : 3.5
    }
    return Math.ceil(weight)
  }

  const calcTotalTokens = (size: string): number => {
    const sizeVal = parseFloat(size)
    if (size.endsWith('MB')) return Math.floor(sizeVal * 1024 * 256)
    return Math.floor(sizeVal * 256)
  }

  const [tabs, setTabs] = useState<Tab[]>([{ id: 'default', name: 'ClaudeGZ', taskId: undefined }])
  const [activeTabId, setActiveTabId] = useState('default')
  
  const sessionMessages = activeTabId ? getSessionMessages(activeTabId) : []

  const totalTokens = useMemo(() => calcTotalTokens(contextMaxSize), [contextMaxSize])

  const tokenStats = useMemo(() => {
    let usedTokens = 0, inputTokens = 0, outputTokens = 0
    const IMAGE_TOKENS = 258
    for (const msg of sessionMessages) {
      const textTokens = estimateTokens(msg.content)
      const imageTokens = (msg.attachments || []).filter(a => a.type === 'image').length * IMAGE_TOKENS
      const total = textTokens + imageTokens
      usedTokens += total
      if (msg.role === 'user') inputTokens += total
      else outputTokens += total
    }
    return { usedTokens, inputTokens, outputTokens }
  }, [activeTabId, sessionMessages.length])

  const usagePercent = ((tokenStats.usedTokens / Math.max(totalTokens, 1)) * 100).toFixed(1)
  
  // 获取当前会话的队列消息
  const queuedMessages = messageQueue[activeTabId] || []
  const modalRef = useRef<HTMLDivElement>(null)

  const [testingModels, setTestingModels] = useState<Record<string, 'testing' | 'ok' | null>>({})
  const [modelTestErrors, setModelTestErrors] = useState<Record<string, string>>({})

  const handleCopyMessage = useCallback(async (messageId: string, content: string, attachments?: Attachment[]) => {
    try {
      let textToCopy = content
      if (attachments && attachments.length > 0) {
        const attDescriptions = attachments.map(att => {
          if (att.type === 'image') return `[图片: ${att.name}]`
          return `[文件: ${att.name} (${(att.size / 1024).toFixed(1)}KB)]`
        })
        textToCopy = content ? `${content}\n\n${attDescriptions.join('\n')}` : attDescriptions.join('\n')
      }
      await navigator.clipboard.writeText(textToCopy)
      setCopiedMsgId(messageId)
      setTimeout(() => setCopiedMsgId(prev => prev === messageId ? null : prev), 2000)
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      setCopyErrorMsg(`复制失败：${reason}`)
      setTimeout(() => setCopyErrorMsg(null), 4000)
    }
  }, [])

  const handleTestModel = async (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const provider = providers.find(p => p.models.some(m => m.id === modelId))
    const model = provider?.models.find(m => m.id === modelId)
    if (!provider || !model) return
    setTestingModels(prev => ({ ...prev, [modelId]: 'testing' }))
    setModelTestErrors(prev => { const n = { ...prev }; delete n[modelId]; return n })
    try {
      const url = `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`
      const isXfyun = provider.id === 'xfyun' || provider.baseUrl.includes('xf-yun.com')

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (isXfyun) {
        headers['Authorization'] = `Basic ${btoa(provider.apiKey)}`
      } else {
        headers['Authorization'] = `Bearer ${provider.apiKey}`
      }

      let resp: Response | null = null
      try {
        resp = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 5,
            stream: false,
          }),
          signal: AbortSignal.timeout(10000),
        })
      } catch (fetchErr) {
        try {
          const { proxyRequest } = await import('../api/apiProxy')
          const result = await proxyRequest({
            url,
            method: 'POST',
            headers: Object.entries(headers) as [string, string][],
            body: JSON.stringify({
              model: modelId,
              messages: [{ role: 'user', content: 'hi' }],
              max_tokens: 5,
              stream: false,
            }),
          })
          if (result.status < 500) {
            setModelStatus(modelId, 'ok')
            setTestingModels(prev => ({ ...prev, [modelId]: 'ok' }))
            setTimeout(() => setTestingModels(prev => ({ ...prev, [modelId]: null })), 2000)
            return
          }
          setModelStatus(modelId, 'fail')
          setTestingModels(prev => ({ ...prev, [modelId]: null }))
          setModelTestErrors(prev => ({ ...prev, [modelId]: `代理: HTTP ${result.status}` }))
          setTimeout(() => setModelTestErrors(prev => { const n = { ...prev }; delete n[modelId]; return n }), 4000)
          return
        } catch {
          setModelStatus(modelId, 'fail')
          setTestingModels(prev => ({ ...prev, [modelId]: null }))
          setModelTestErrors(prev => ({ ...prev, [modelId]: `网络错误: ${fetchErr instanceof Error ? fetchErr.message : '未知错误'}` }))
          setTimeout(() => setModelTestErrors(prev => { const n = { ...prev }; delete n[modelId]; return n }), 4000)
          return
        }
      }

      if (!resp) return
      if (resp.ok || resp.status === 429) {
        setModelStatus(modelId, 'ok')
        setTestingModels(prev => ({ ...prev, [modelId]: 'ok' }))
        setTimeout(() => setTestingModels(prev => ({ ...prev, [modelId]: null })), 2000)
      } else {
        setModelStatus(modelId, 'fail')
        setTestingModels(prev => ({ ...prev, [modelId]: null }))
        let errDetail = `HTTP ${resp.status}`
        try { const text = await resp.text(); if (text) { try { const j = JSON.parse(text); errDetail += `: ${j.error?.message || j.error?.code || text.substring(0, 150)}` } catch { errDetail += `: ${text.substring(0, 150)}` } } } catch {}
        setModelTestErrors(prev => ({ ...prev, [modelId]: errDetail }))
        setTimeout(() => setModelTestErrors(prev => { const n = { ...prev }; delete n[modelId]; return n }), 4000)
      }
    } catch (err) {
      setModelStatus(modelId, 'fail')
      setTestingModels(prev => ({ ...prev, [modelId]: null }))
      setModelTestErrors(prev => ({ ...prev, [modelId]: `网络错误: ${err instanceof Error ? err.message : '未知错误'}` }))
      setTimeout(() => setModelTestErrors(prev => { const n = { ...prev }; delete n[modelId]; return n }), 4000)
    }
  }

  const handleToggleDefault = (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (defaultModelId === modelId) {
      setDefaultModelId(null)
    } else {
      setDefaultModelId(modelId)
      const provider = providers.find(p => p.models.some(m => m.id === modelId))
      setActiveModelId(modelId, provider?.id)
    }
  }

  const handleDeleteModelFromList = (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const provider = providers.find(p => p.models.some(m => m.id === modelId))
    if (!provider) return
    const updated = provider.models.filter(m => m.id !== modelId)
    setProviders(providers.map(p =>
      p.id === provider.id ? { ...p, models: updated } : p
    ))
    if (defaultModelId === modelId) {
      setDefaultModelId(null)
    }
    if (activeModelId === modelId && updated.length > 0) {
      setActiveModelId(updated[0].id)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(event.target as Node)) {
        setShowFolderDropdown(false)
      }
      if (permissionModalRef.current && !permissionModalRef.current.contains(event.target as Node)) {
        setShowPermissionModal(false)
      }
      if (modelModalRef.current && !modelModalRef.current.contains(event.target as Node)) {
        setShowModelModal(false)
      }
      if (gitModalRef.current && !gitModalRef.current.contains(event.target as Node)) {
        setShowGitModal(false)
      }
      if (skillModalRef.current && !skillModalRef.current.contains(event.target as Node)) {
        setShowSkillModal(false)
      }
      if (toolModalRef.current && !toolModalRef.current.contains(event.target as Node)) {
        setShowToolModal(false)
      }
      if (expertModalRef.current && !expertModalRef.current.contains(event.target as Node)) {
        setShowExpertModal(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    const handleConfigClickOutside = (event: MouseEvent) => {
      const configPanel = document.getElementById('expert-config-panel')
      if (configPanel && !configPanel.contains(event.target as Node)) {
        setConfiguringExpert(null)
      }
    }

    document.addEventListener('mousedown', handleConfigClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleConfigClickOutside)
    }
  }, [])

  // 自动滚动到底部（智能：用户手动滚动时不自动滚动）
  const isNearBottomRef = useRef(true)
  
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const threshold = 100
    isNearBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < threshold
  }, [])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || !isNearBottomRef.current) return
    container.scrollTop = container.scrollHeight
  }, [messages, streamingSessions])

  // 粘贴事件处理
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageItems: DataTransferItem[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        imageItems.push(item)
      }
    }

    if (imageItems.length === 0) return

    e.preventDefault()

    const newAttachments: Attachment[] = []
    for (const item of imageItems) {
      const file = item.getAsFile()
      if (!file) continue

      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      newAttachments.push({
        id: `attach-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'image',
        name: file.name || `粘贴图片_${Date.now()}.png`,
        data,
        mimeType: file.type,
        size: file.size,
      })
    }

    if (newAttachments.length > 0) {
      setInputAttachments(prev => [...prev, ...newAttachments])
    }
  }, [])

  // 监听外部删除会话事件，关闭对应标签
  const prevDeletedSessionKeyRef = useRef(deletedSessionKey)
  useEffect(() => {
    if (deletedSessionKey !== undefined && deletedSessionKey !== prevDeletedSessionKeyRef.current && selectedSession) {
      prevDeletedSessionKeyRef.current = deletedSessionKey
      const tabToClose = tabs.find(tab => tab.id === selectedSession.id)
      if (tabToClose) {
        closedTabIdsRef.current.add(selectedSession.id)
        const newTabs = tabs.filter(tab => tab.id !== selectedSession.id)
        setTabs(newTabs)
        if (newTabs.length > 0) {
          setActiveTabId(newTabs[0].id)
        } else {
          setActiveTabId('')
        }
      }
    }
  }, [deletedSessionKey])

  const closedTabIdsRef = useRef<Set<string>>(new Set())

  // 根据对话内容自动生成标签显示名称（手动重命名的会话不覆盖）
  const getTabDisplayName = (tabId: string, storedName: string): string => {
    try {
      const renamedIds: string[] = JSON.parse(localStorage.getItem('canai-renamed-sessions') || '[]')
      if (renamedIds.includes(tabId)) return storedName
    } catch {}
    const msgs = getSessionMessages(tabId)
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

  useEffect(() => {
    if (selectedSession) {
      closedTabIdsRef.current.delete(selectedSession.id)
      const existingTab = tabs.find(tab => tab.id === selectedSession.id)
      if (existingTab) {
        setActiveTabId(selectedSession.id)
      } else if (tabs.length > 0 || !closedTabIdsRef.current.has(selectedSession.id)) {
        const newTab: Tab = { id: selectedSession.id, name: selectedSession.name, taskId: selectedSession.taskId }
        setTabs(prev => [...prev, newTab])
        setActiveTabId(selectedSession.id)
      }
    }
  }, [selectedSession])

  const handleSessionClick = (sessionId: string, sessionName: string, taskId?: string, folderPath?: string) => {
    onSessionSelect(sessionId, sessionName, taskId, folderPath)
    
    closedTabIdsRef.current.delete(sessionId)
    const existingTab = tabs.find(tab => tab.id === sessionId)
    if (existingTab) {
      setActiveTabId(sessionId)
    } else {
      const newTab: Tab = { id: sessionId, name: sessionName, taskId }
      setTabs(prev => [...prev, newTab])
      setActiveTabId(sessionId)
    }
  }

  const closeTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (tabs.length === 1) {
      closedTabIdsRef.current.add(tabId)
      setTabs([])
      setActiveTabId('')
      return
    }
    
    const newTabs = tabs.filter(tab => tab.id !== tabId)
    setTabs(newTabs)
    
    if (activeTabId === tabId) {
      const newActiveTab = newTabs[0]
      setActiveTabId(newActiveTab.id)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowContextModal(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSend = () => {
    if ((!inputValue.trim() && inputAttachments.length === 0) || !activeTabId) return
    
    const content = inputValue
    const attachments = [...inputAttachments]
    setInputValue('')
    setInputAttachments([])
    
    // 通过attachments参数传递附件，不将data URL嵌入文本内容
    if (attachments.length > 0) {
      sendChatMessage(activeTabId, content, attachments)
    } else {
      sendChatMessage(activeTabId, content)
    }
  }

  // 文件图标映射
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
      return <Image className="w-5 h-5 text-blue-500" />
    }
    if (['mp4', 'avi', 'mkv', 'mov', 'wmv'].includes(ext)) {
      return <Film className="w-5 h-5 text-purple-500" />
    }
    if (['mp3', 'wav', 'flac', 'ogg', 'aac'].includes(ext)) {
      return <Music className="w-5 h-5 text-green-500" />
    }
    if (['pdf'].includes(ext)) {
      return <FileText className="w-5 h-5 text-red-500" />
    }
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
      return <FileText className="w-5 h-5 text-blue-700" />
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return <File className="w-5 h-5 text-yellow-600" />
    }
    return <File className="w-5 h-5 text-gray-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // 文件附件点击打开
  const handleFileOpen = useCallback(async (filePath: string) => {
    try {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(filePath)
    } catch {
      window.open(filePath, '_blank')
    }
  }, [])

  const handleContextSizeChange = (size: string) => {
    setContextMaxSize(size)
    setCustomSize('')
  }

  const handleCustomSizeSubmit = () => {
    if (!customSize.trim()) return
    
    const trimmed = customSize.trim()
    let size: string
    
    if (trimmed.endsWith('KB') || trimmed.endsWith('MB')) {
      size = trimmed
    } else {
      const num = parseFloat(trimmed)
      if (num >= 1024) {
        size = `${(num / 1024).toFixed(1)}MB`
      } else {
        size = `${num}KB`
      }
    }
    
    handleContextSizeChange(size)
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 relative">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1">
          {/* 左侧折叠展开按钮 */}
          <button 
            onClick={onToggleLeftPanel}
            className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" 
            title={leftPanelCollapsed ? '展开左侧面板' : '折叠左侧面板'}
          >
            {leftPanelCollapsed ? (
              <PanelLeft className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftClose className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        
        <div className="flex items-center gap-1">
          {activeTabId && streamingSessions[activeTabId] ? (
            <button
              onClick={() => stopStreaming(activeTabId)}
              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors flex items-center gap-1"
              title="停止生成"
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span className="text-xs">停止</span>
            </button>
          ) : (
            <button
              onClick={() => {
                if (activeTabId) {
                  clearSessionMessages(activeTabId)
                }
              }}
              className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="清空会话"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <button className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="分享">
            <Share2 className="w-3.5 h-3.5" />
          </button>
          {/* 右侧折叠展开按钮 */}
          <button 
            onClick={onToggleRightPanel}
            className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" 
            title={rightPanelCollapsed ? '展开右侧面板' : '折叠右侧面板'}
          >
            {rightPanelCollapsed ? (
              <PanelRight className="w-3.5 h-3.5" />
            ) : (
              <PanelRightClose className="w-3.5 h-3.5" />
            )}
          </button>

        </div>
      </div>
      
      {/* 会话标签栏 */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto flex-nowrap scrollbar-thin">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => {
              setActiveTabId(tab.id)
              onSessionSelect(tab.id, tab.name, tab.taskId)
            }}
            className={`flex items-center gap-1 px-2 py-2 cursor-pointer transition-colors flex-shrink min-w-[28px] max-w-[200px] ${
              activeTabId === tab.id
                ? 'bg-white dark:bg-gray-800 border-b-2 border-blue-500 text-gray-900 dark:text-white'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span className="text-sm truncate flex-1" title={tab.name}>{getTabDisplayName(tab.id, tab.name)}</span>
            <button
              onClick={(e) => closeTab(tab.id, e)}
              className="p-0.5 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 flex-shrink-0"
              title="关闭标签"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      
      <div className="flex-1 overflow-y-auto" ref={messagesContainerRef} onScroll={handleScroll}>
        {tabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full bg-yellow-50">
            <div className="text-center">
              <div className="w-40 h-40 rounded-full bg-gradient-to-br from-yellow-300 to-orange-400 flex items-center justify-center mb-4 shadow-lg mx-auto overflow-hidden">
              <img src="/CanAI.png" alt="CanAI" className="w-full h-full object-cover" />
            </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">新建会话</h1>
              <p className="text-gray-500 text-sm">开始一个新的AI会话，请告诉我希望我帮你做什么？</p>
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-4">
            {(() => {
              const sessionMessages = activeTabId ? getSessionMessages(activeTabId) : []
              const isStreaming = activeTabId ? streamingSessions[activeTabId] : false
              return (
                <>
                  {sessionMessages.map((message, idx) => {
                    const isLast = idx === sessionMessages.length - 1
                    if (isLast && isStreaming && !message.content) return null
                    return (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                          message.role === 'user' 
                            ? 'bg-blue-500' 
                            : 'bg-gradient-to-br from-orange-400 to-red-500'
                        }`}>
                          {message.role === 'user' ? (
                            <User className="w-4 h-4 text-white" />
                          ) : (
                            <Bot className="w-4 h-4 text-white" />
                          )}
                        </div>
                        
                        <div className={`max-w-[70%] ${message.role === 'user' ? 'text-right' : ''}`}>
                          <div className={`inline-block px-4 py-2 rounded-2xl ${
                            message.role === 'user'
                              ? 'bg-blue-500 text-white rounded-br-md'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-md'
                          }`}>
                            {message.content && (
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            )}
                            {/* 附件渲染 */}
                            {message.attachments && message.attachments.length > 0 && (
                              <div className={`mt-2 space-y-2 ${message.role === 'user' ? 'text-left' : ''}`}>
                                {message.attachments.map((att) => (
                                  <div key={att.id}>
                                    {att.type === 'image' ? (
                                      <div className="relative group">
                                        <img
                                          src={att.data}
                                          alt={att.name}
                                          className="max-w-[200px] max-h-[200px] rounded-lg cursor-pointer object-cover border border-white/20 hover:opacity-90 transition-opacity"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            // 保存图片数据到 localStorage，然后打开独立窗口
                                            try {
                                              localStorage.setItem('canai-image-viewer-data', JSON.stringify({ src: att.data, name: att.name }))
                                            } catch {}
                                            openImageViewerWindow()
                                          }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                          <div className="bg-black/40 rounded-full p-2 backdrop-blur-sm">
                                            <ZoomIn className="w-5 h-5 text-white" />
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div
                                        className="flex items-center gap-2 px-3 py-2 bg-black/10 dark:bg-white/10 rounded-lg cursor-pointer hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
                                        onClick={() => handleFileOpen(att.data)}
                                      >
                                        {getFileIcon(att.name)}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium truncate">{att.name}</p>
                                          <p className="text-[10px] opacity-60">{formatFileSize(att.size)}</p>
                                        </div>
                                        <ExternalLink className="w-4 h-4 opacity-60 flex-shrink-0" />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {message.role === 'user' && message.timestamp && (
                            <span className="text-xs text-gray-400 mt-1 block">
                              {message.timestamp}
                            </span>
                          )}
                          {message.role === 'assistant' && message.duration !== undefined ? (
                            <div className="text-[10px] text-gray-400 mt-1 space-x-2">
                              <span>{message.timestamp}</span>
                              <span>|</span>
                              <span>{message.duration}s</span>
                              <span>|</span>
                              <span>{message.modelName || '本地模型'}</span>
                              {message.tokens !== undefined && (
                                <>
                                  <span>|</span>
                                  <span>{message.tokens.toLocaleString()} tokens</span>
                                </>
                              )}
                              {message.cost !== undefined && message.cost > 0 && (
                                <>
                                  <span>|</span>
                                  <span>¥{message.cost.toFixed(4)}</span>
                                </>
                              )}
                              {message.cost !== undefined && message.cost === 0 && message.tokens !== undefined && (
                                <>
                                  <span>|</span>
                                  <span>免费</span>
                                </>
                              )}
                            </div>
                          ) : message.role === 'assistant' && message.timestamp ? (
                            <span className="text-xs text-gray-400 mt-1 block">
                              {message.timestamp}
                            </span>
                          ) : null}
                          {/* 操作按钮 */}
                          <div className={`flex items-center gap-1 mt-1 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <button
                              onClick={() => toggleMessageMark(activeTabId!, message.id)}
                              className={`p-1 rounded transition-colors ${message.isMarked ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/30' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                              title={message.isMarked ? '取消标记' : '标记'}
                            >
                              <Star className={`w-3 h-3 ${message.isMarked ? 'fill-current' : ''}`} />
                            </button>
                            {message.role === 'user' && (
                              <button
                                onClick={() => retryMessage(activeTabId!, message.id)}
                                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title="重试"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => rollbackToMessage(activeTabId!, idx)}
                              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="回滚到此消息"
                            >
                              <Undo2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleCopyMessage(message.id, message.content, message.attachments)}
                              className={`p-1 rounded transition-colors ${
                                copiedMsgId === message.id
                                  ? 'text-green-500 bg-green-50 dark:bg-green-900/30'
                                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              title="复制"
                            >
                              {copiedMsgId === message.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                            <button
                              onClick={() => deleteMessage(activeTabId!, message.id)}
                              className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  
                  {isStreaming && sessionMessages.length > 0 && !sessionMessages[sessionMessages.length - 1]?.content && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex-shrink-0 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-md">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* 回滚状态提示和撤销回滚按钮 */}
                  {isRolledBack(activeTabId!) && (
                    <div className="flex items-center justify-center gap-2 py-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="text-sm text-amber-700 dark:text-amber-300">已回滚到历史状态</span>
                      <button
                        onClick={() => undoRollback(activeTabId!)}
                        className="px-3 py-1 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
                        title="撤销回滚"
                      >
                        撤销回滚
                      </button>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}
      </div>
      
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        {/* 消息队列 */}
        {queuedMessages.length > 0 && (
          <div className="mb-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div 
              className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={() => setQueueExpanded(!queueExpanded)}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">消息队列</span>
                <span className="text-xs text-gray-400">({queuedMessages.length}条)</span>
              </div>
              {queuedMessages.length >= 2 && (
                <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors">
                  {queueExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
              )}
            </div>
            <div className={`overflow-hidden transition-all duration-200 ${queueExpanded || queuedMessages.length < 2 ? 'max-h-[300px]' : 'max-h-[44px]'}`}>
              {queueExpanded || queuedMessages.length < 2 ? (
                queuedMessages.map((q, i) => (
                  <div
                    key={q.id}
                    className="group flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors last:border-b-0"
                  >
                    <span className="text-[10px] text-gray-400 w-4 flex-shrink-0">#{i + 1}</span>
                    <span
                      className="flex-1 truncate whitespace-nowrap text-sm text-gray-700 dark:text-gray-300"
                      title={q.content}
                    >
                      {q.content}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          sendQueuedMessage(activeTabId!, q.id)
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                        title="立即发送"
                      >
                        <Send size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const dequeued = dequeueMessageToInput(activeTabId!, q.id)
                          if (dequeued) {
                            setInputValue(dequeued.content)
                          }
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors"
                        title="撤回"
                      >
                        <Undo2 size={12} />
                      </button>
                      {i > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            moveQueuedMessageToFront(activeTabId!, q.id)
                          }}
                          className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                          title="插队"
                        >
                          <ArrowUp size={12} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(q.content)
                          setCopiedQueueId(q.id)
                          setTimeout(() => setCopiedQueueId(null), 2000)
                        }}
                        className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
                          copiedQueueId === q.id
                            ? 'text-green-500'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                        title="复制"
                      >
                        {copiedQueueId === q.id ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeQueuedMessage(activeTabId!, q.id)
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        title="删除"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div
                  key={queuedMessages[queuedMessages.length - 1].id}
                  className="group flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <span className="text-[10px] text-gray-400 w-4 flex-shrink-0">#{queuedMessages.length}</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 mr-1">条消息等待发送:</span>
                  <span
                    className="flex-1 truncate whitespace-nowrap text-sm text-gray-700 dark:text-gray-300"
                    title={queuedMessages[queuedMessages.length - 1].content}
                  >
                    {queuedMessages[queuedMessages.length - 1].content}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        sendQueuedMessage(activeTabId!, queuedMessages[queuedMessages.length - 1].id)
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                      title="立即发送"
                    >
                      <Send size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const dequeued = dequeueMessageToInput(activeTabId!, queuedMessages[queuedMessages.length - 1].id)
                        if (dequeued) {
                          setInputValue(dequeued.content)
                        }
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors"
                      title="撤回"
                    >
                      <Undo2 size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigator.clipboard.writeText(queuedMessages[queuedMessages.length - 1].content)
                        setCopiedQueueId(queuedMessages[queuedMessages.length - 1].id)
                        setTimeout(() => setCopiedQueueId(null), 2000)
                      }}
                      className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
                        copiedQueueId === queuedMessages[queuedMessages.length - 1].id
                          ? 'text-green-500'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                      title="复制"
                    >
                      {copiedQueueId === queuedMessages[queuedMessages.length - 1].id ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeQueuedMessage(activeTabId!, queuedMessages[queuedMessages.length - 1].id)
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      title="删除"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="flex items-end gap-3 relative">
          <div className="flex-1 relative">
            {/* 输入框中的附件预览 */}
            {inputAttachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {inputAttachments.map((att) => (
                  <div key={att.id} className="group relative">
                    {att.type === 'image' ? (
                      <div className="relative">
                        <img
                          src={att.data}
                          alt={att.name}
                          className="w-16 h-16 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                        />
                        <button
                          onClick={() => setInputAttachments(prev => prev.filter(a => a.id !== att.id))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                        {getFileIcon(att.name)}
                        <span className="text-xs truncate max-w-[60px]">{att.name}</span>
                        <button
                          onClick={() => setInputAttachments(prev => prev.filter(a => a.id !== att.id))}
                          className="ml-1 text-gray-400 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto'
                  textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 192) + 'px'
                }
              }}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="输入消息... (可粘贴图片)"
              rows={2}
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent overflow-y-auto"
              style={{ resize: 'none', minHeight: '64px', maxHeight: '192px' }}
            />
          </div>
          
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = e.target.files
                if (!files || files.length === 0) return
                
                const newAttachments: Attachment[] = []
                for (let i = 0; i < files.length; i++) {
                  const file = files[i]
                  
                  if (file.type.startsWith('image/')) {
                    const data = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader()
                      reader.onload = () => resolve(reader.result as string)
                      reader.onerror = reject
                      reader.readAsDataURL(file)
                    })
                    newAttachments.push({
                      id: `attach-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                      type: 'image',
                      name: file.name,
                      data,
                      mimeType: file.type,
                      size: file.size,
                    })
                  } else {
                    // 对于非图片文件，在Tauri环境中读取文件路径并复制到本地存储
                    try {
                      const { readFile } = await import('@tauri-apps/plugin-fs')
                      const arrayBuffer = await readFile(file.name as unknown as string)
                      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
                      const dataUrl = `data:${file.type || 'application/octet-stream'};base64,${base64}`
                      newAttachments.push({
                        id: `attach-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        type: 'file',
                        name: file.name,
                        data: dataUrl,
                        mimeType: file.type || 'application/octet-stream',
                        size: file.size,
                      })
                    } catch {
                      // 非Tauri环境或读取失败，只存储文件名
                      newAttachments.push({
                        id: `attach-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        type: 'file',
                        name: file.name,
                        data: file.name,
                        mimeType: file.type || 'application/octet-stream',
                        size: file.size,
                      })
                    }
                  }
                }
                
                setInputAttachments(prev => [...prev, ...newAttachments])
                // 重置input以允许重新选择相同文件
                e.target.value = ''
              }}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" 
              title="附件"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="语音">
              <Mic className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                if (inputValue.trim() || inputAttachments.length > 0) {
                  handleSend()
                } else if (streamingSessions[activeTabId!]) {
                  stopStreaming(activeTabId!)
                } else {
                  handleSend()
                }
              }}
              disabled={!inputValue.trim() && inputAttachments.length === 0 && !streamingSessions[activeTabId!]}
              className={`p-2 rounded-lg transition-colors ${
                inputValue.trim() || inputAttachments.length > 0
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : streamingSessions[activeTabId!]
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              title={inputValue.trim() || inputAttachments.length > 0 ? '发送' : streamingSessions[activeTabId!] ? '停止' : '请输入消息'}
            >
              {inputValue.trim() || inputAttachments.length > 0 ? <Send className="w-5 h-5" /> : streamingSessions[activeTabId!] ? <StopCircle className="w-5 h-5" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
        
        {activeModel && (
          <div className="flex items-center gap-2 mt-1 mb-1 text-[10px] text-gray-400">
            <div ref={modelModalRef} className="relative">
              <button
                onClick={() => setShowModelModal(!showModelModal)}
                className="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
                title="选择模型"
              >
                <Bot className="w-3 h-3" />
                模型
              </button>
              {showModelModal && (
                <div className="absolute left-0 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50" style={{ bottom: '100%', top: 'auto', marginBottom: '4px' }}>
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">选择模型</h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setRefreshing(true)
                        reloadProviders()
                        setTimeout(() => setRefreshing(false), 800)
                      }}
                      className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                      title="刷新模型列表"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-500' : ''}`} />
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar">
                    <div className="p-2">
                      <div className="flex items-center gap-1.5 px-3 py-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">云模型</p>
                      </div>
                      {providers.filter(p => p.type === 'cloud' && p.enabled).length === 0 ? (
                        <div className="px-3 py-3 text-xs text-gray-400 text-center">（暂无可用模型，请配置）</div>
                      ) : (
                        providers.filter(p => p.type === 'cloud' && p.enabled).map((provider) => (
                          <div key={provider.id}>
                            <p className="px-3 py-1 text-xs text-gray-400">{provider.name}</p>
                            {provider.models.map((model) => (
                              <div
                                key={model.id}
                                className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
                                  activeModelId === model.id
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                                onClick={() => {
                                  setActiveModelId(model.id, provider.id)
                                  setDefaultModelId(model.id)
                                  setShowModelModal(false)
                                }}
                              >
                                {activeModelId === model.id ? (
                                  <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                ) : (
                                  <span className="w-3.5 h-3.5 flex-shrink-0" />
                                )}
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  modelStatuses[model.id] === 'ok' ? 'bg-green-500' :
                                  modelStatuses[model.id] === 'fail' ? 'bg-red-500' :
                                  'bg-gray-300 dark:bg-gray-500'
                                }`} />
                                <span className="truncate flex-1" title={model.name}>{model.name}</span>
                                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-60 group-hover:opacity-100">
                                  <div className="relative">
                                    <button
                                      onClick={(e) => handleTestModel(model.id, e)}
                                      title="测试可用性"
                                      className={`p-1 rounded transition-colors ${
                                        testingModels[model.id] === 'testing' || testingModels[model.id] === 'ok'
                                          ? 'bg-green-500 text-white'
                                          : 'text-gray-400 hover:text-green-500'
                                      }`}
                                    >
                                      {testingModels[model.id] === 'testing' ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                      ) : testingModels[model.id] === 'ok' ? (
                                        <span className="text-[9px] font-bold px-0.5">可用</span>
                                      ) : (
                                        <Wifi className="w-3 h-3" />
                                      )}
                                    </button>
                                    {modelTestErrors[model.id] && (
                                      <div className="absolute right-full top-1/2 -translate-y-1/2 mr-1.5 px-2 py-1 bg-red-600 text-white text-[9px] rounded shadow-lg z-20 max-w-[220px] text-left leading-tight whitespace-normal">
                                        {modelTestErrors[model.id]}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => handleToggleDefault(model.id, e)}
                                    title={defaultModelId === model.id ? '取消默认' : '设为默认'}
                                    className={`p-1 rounded transition-colors ${
                                      defaultModelId === model.id
                                        ? 'text-yellow-500'
                                        : 'text-gray-400 hover:text-yellow-500'
                                    }`}
                                  >
                                    <Star className={`w-3 h-3 ${defaultModelId === model.id ? 'fill-yellow-500' : ''}`} />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteModelFromList(model.id, e)}
                                    title="删除"
                                    className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                    <div className="p-2">
                      <div className="flex items-center gap-1.5 px-3 py-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">本地模型</p>
                      </div>
                      {providers.filter(p => p.type === 'local' && p.enabled).length === 0 ? (
                        <div className="px-3 py-3 text-xs text-gray-400 text-center">（暂无可用本地模型，请下载）</div>
                      ) : (
                        providers.filter(p => p.type === 'local' && p.enabled).map((provider) => (
                          <div key={provider.id}>
                            <p className="px-3 py-1 text-xs text-gray-400">{provider.name}</p>
                            {provider.models.map((model) => (
                              <div
                                key={model.id}
                                className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
                                  activeModelId === model.id
                                    ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                                onClick={() => {
                                  setActiveModelId(model.id, provider.id)
                                  setDefaultModelId(model.id)
                                  try { localStorage.setItem('canai-local-selected-model', model.id) } catch {}
                                  setShowModelModal(false)
                                  const filePath = model.filePath || (() => {
                                    try {
                                      const paths = JSON.parse(localStorage.getItem('canai-local-model-paths') || '{}')
                                      return paths[model.id]
                                    } catch { return undefined }
                                  })()
                                  const sconfig = (() => {
                                    try { return JSON.parse(localStorage.getItem('canai-local-server-config') || '{}') }
                                    catch { return {} }
                                  })()
                                  if (filePath && sconfig.port) {
                                    let mmprojPath = model.mmprojPath
                                    let audioInputPath = model.audioInputPath
                                    let audioOutputPath = model.modelVocoder
                                    if (!mmprojPath && !audioInputPath && !audioOutputPath) {
                                      try {
                                        const companionConfigs = JSON.parse(localStorage.getItem('canai-local-companion-configs') || '{}')
                                        const companion = companionConfigs[model.id]
                                        if (companion) {
                                          if (companion.image_video?.length > 0) mmprojPath = companion.image_video[0].file_path
                                          if (companion.audio_input?.length > 0) audioInputPath = companion.audio_input[0].file_path
                                          if (companion.audio_output?.length > 0) audioOutputPath = companion.audio_output[0].file_path
                                        }
                                      } catch {}
                                    }
                                    setLlamaServiceStatus('switching')
                                    invoke('llama_cpp_switch_model', {
                                      config: {
                                        model_path: filePath,
                                        port: sconfig.port,
                                        host: sconfig.host || '127.0.0.1',
                                        n_gpu_layers: sconfig.n_gpu_layers ?? -1,
                                        n_ctx: sconfig.n_ctx || 4096,
                                        threads: sconfig.threads || 8,
                                        batch_size: sconfig.batch_size || 512,
                                        api_key: sconfig.apiKey || undefined,
                                        mtp_tokens: sconfig.mtp_tokens || 0,
                                        mmproj_path: mmprojPath,
                                        audio_input_path: audioInputPath,
                                        model_vocoder: audioOutputPath,
                                      }
                                    }).then(() => {
                                      setLlamaServiceStatus('running')
                                    }).catch((e) => {
                                      console.error('切换本地模型失败:', e)
                                      setLlamaServiceStatus('stopped')
                                    })
                                  }
                                }}
                              >
                                {activeModelId === model.id ? (
                                  <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                ) : (
                                  <span className="w-3.5 h-3.5 flex-shrink-0" />
                                )}
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  modelStatuses[model.id] === 'ok' ? 'bg-green-500' :
                                  modelStatuses[model.id] === 'fail' ? 'bg-red-500' :
                                  'bg-gray-300 dark:bg-gray-500'
                                }`} />
                                <span className="truncate flex-1" title={model.name}>{model.name}</span>
                                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-60 group-hover:opacity-100">
                                  <div className="relative">
                                    <button
                                      onClick={(e) => handleTestModel(model.id, e)}
                                      title="测试可用性"
                                      className={`p-1 rounded transition-colors ${
                                        testingModels[model.id] === 'testing' || testingModels[model.id] === 'ok'
                                          ? 'bg-green-500 text-white'
                                          : 'text-gray-400 hover:text-green-500'
                                      }`}
                                    >
                                      {testingModels[model.id] === 'testing' ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                      ) : testingModels[model.id] === 'ok' ? (
                                        <span className="text-[9px] font-bold px-0.5">可用</span>
                                      ) : (
                                        <Wifi className="w-3 h-3" />
                                      )}
                                    </button>
                                    {modelTestErrors[model.id] && (
                                      <div className="absolute right-full top-1/2 -translate-y-1/2 mr-1.5 px-2 py-1 bg-red-600 text-white text-[9px] rounded shadow-lg z-20 max-w-[220px] text-left leading-tight whitespace-normal">
                                        {modelTestErrors[model.id]}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => handleToggleDefault(model.id, e)}
                                    title={defaultModelId === model.id ? '取消默认' : '设为默认'}
                                    className={`p-1 rounded transition-colors ${
                                      defaultModelId === model.id
                                        ? 'text-yellow-500'
                                        : 'text-gray-400 hover:text-yellow-500'
                                    }`}
                                  >
                                    <Star className={`w-3 h-3 ${defaultModelId === model.id ? 'fill-yellow-500' : ''}`} />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteModelFromList(model.id, e)}
                                    title="删除"
                                    className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700 mx-3" />
                    <div className="p-2">
                      <div className="flex items-center gap-1.5 px-3 py-1.5">
                        <Brain className="w-3.5 h-3.5 text-purple-400" />
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">推理等级</p>
                      </div>
                      <div className="flex gap-1 px-3 py-1">
                        {(['low', 'medium', 'high', 'maximum'] as const).map((level) => (
                          <button
                            key={level}
                            onClick={() => setReasoningEffort(level)}
                            className={`flex-1 px-2 py-1.5 text-xs rounded-lg transition-colors ${
                              reasoningEffort === level
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-700'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {level === 'low' ? '低' : level === 'medium' ? '中' : level === 'high' ? '高' : '最大'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <span className={`px-1 rounded ${activeModel.type === 'local' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'}`}>
              {activeModel.type === 'local' ? '本地' : '云端'}
            </span>
            <span>{activeModel.modelName}</span>
            <span className="text-gray-300">|</span>
            <span className="truncate max-w-[150px]">{activeModel.providerName}</span>
            <span className="text-gray-300">|</span>
            <button
              onClick={async () => {
                if (llamaServiceStatus === 'running' || llamaServiceStatus === 'switching' || llamaServiceStatus === 'starting') {
                  try {
                    await invoke('llama_cpp_stop')
                    setLlamaServiceStatus('stopped')
                  } catch (e) {
                    setLlamaServiceStatus('stopped')
                  }
                } else {
                  setLlamaServiceStatus('starting')
                  try {
                    const sconfig = JSON.parse(localStorage.getItem('canai-local-server-config') || '{}')
                    // 从 providers 中获取本地模型信息
                    const localProvider = providers.find(p => p.type === 'local' && p.enabled)
                    let modelPath = ''
                    let mmprojPath: string | undefined
                    let audioInputPath: string | undefined
                    let audioOutputPath: string | undefined

                    if (localProvider && localProvider.models.length > 0) {
                      const savedModelId = localStorage.getItem('canai-local-selected-model')
                      let targetModel = localProvider.models.find(m => m.id === savedModelId)
                      if (!targetModel) targetModel = localProvider.models[0]
                      if (targetModel) {
                        modelPath = targetModel.filePath || targetModel.id
                        mmprojPath = targetModel.mmprojPath
                        audioInputPath = targetModel.audioInputPath
                        audioOutputPath = targetModel.modelVocoder
                        // 如果 provider 中没有 mmproj 信息，从 localStorage 的 companion 配置中读取
                        if (!mmprojPath && !audioInputPath && !audioOutputPath) {
                          try {
                            const companionConfigs = JSON.parse(localStorage.getItem('canai-local-companion-configs') || '{}')
                            const companion = companionConfigs[targetModel.id]
                            if (companion) {
                              if (companion.image_video?.length > 0) mmprojPath = companion.image_video[0].file_path
                              if (companion.audio_input?.length > 0) audioInputPath = companion.audio_input[0].file_path
                              if (companion.audio_output?.length > 0) audioOutputPath = companion.audio_output[0].file_path
                            }
                          } catch {}
                        }
                      }
                    }

                    if (!modelPath || !sconfig.port) {
                      setLlamaServiceStatus('stopped')
                      setShowModelModal(true)
                      return
                    }

                    const status: { running: boolean } = await invoke('llama_cpp_start', {
                      config: {
                        model_path: modelPath,
                        port: sconfig.port,
                        host: sconfig.host || '127.0.0.1',
                        n_gpu_layers: sconfig.n_gpu_layers ?? -1,
                        n_ctx: sconfig.n_ctx || 4096,
                        threads: sconfig.threads || 8,
                        batch_size: sconfig.batch_size || 512,
                        api_key: sconfig.apiKey || undefined,
                        mtp_tokens: sconfig.mtp_tokens || 0,
                        mmproj_path: mmprojPath,
                        audio_input_path: audioInputPath,
                        model_vocoder: audioOutputPath,
                      }
                    })
                    setLlamaServiceStatus(status.running ? 'running' : 'stopped')
                  } catch (e) {
                    setLlamaServiceStatus('stopped')
                  }
                }
              }}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                llamaServiceStatus === 'running'
                  ? 'text-green-500 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-800/40 cursor-pointer'
                  : llamaServiceStatus === 'switching'
                    ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30 cursor-pointer'
                    : llamaServiceStatus === 'starting'
                      ? 'text-red-500 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-800/40 cursor-pointer'
                      : 'text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer'
              }`}
              title={
                llamaServiceStatus === 'starting' ? '点击中止启动' :
                llamaServiceStatus === 'running' ? '点击停止服务' :
                '点击启动本地服务'
              }
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                llamaServiceStatus === 'running' ? 'bg-green-500 animate-pulse' :
                llamaServiceStatus === 'starting' || llamaServiceStatus === 'switching' ? 'bg-yellow-500 animate-pulse' :
                'bg-gray-400'
              }`} />
              {llamaServiceStatus === 'running' ? '停止本地服务' : llamaServiceStatus === 'starting' ? '点击中止启动' : llamaServiceStatus === 'switching' ? '切换模型中...' : '启动本地服务'}
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 relative">
          <div ref={gitModalRef} className="relative">
            <button
              onClick={() => setShowGitModal(!showGitModal)}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
              title="git分支仓库"
            >
              <GitBranch className="w-3 h-3" />
              git
            </button>
            {showGitModal && (
              <div className="absolute left-0 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50" style={{ bottom: '100%', top: 'auto', marginBottom: '4px' }}>
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Git 分支仓库</h4>
                </div>
                <div className="p-2">
                  <div className="px-3 py-2 text-xs text-gray-500">
                    <p>当前分支: <span className="text-gray-700 dark:text-gray-300 font-medium">master</span></p>
                    <p className="mt-1">提交: <span className="text-gray-700 dark:text-gray-300">a1b2c3d</span></p>
                    <p className="mt-1">状态: <span className="text-green-500">✓ 干净</span></p>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
                  <div className="space-y-1">
                    <button className="w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-left flex items-center gap-2">
                      <GitBranch className="w-3 h-3" />
                      切换分支
                    </button>
                    <button className="w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-left flex items-center gap-2">
                      <RefreshCw className="w-3 h-3" />
                      拉取更新
                    </button>
                    <button className="w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-left flex items-center gap-2">
                      <Share2 className="w-3 h-3" />
                      推送提交
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={skillModalRef} className="relative ml-2">
            <button
              onClick={() => setShowSkillModal(!showSkillModal)}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
              title="技能选择"
            >
              <Tag className="w-3 h-3" />
              技能
              {selectedSkillCount > 0 && (
                <span className="ml-0.5 text-blue-500 font-medium">({selectedSkillCount})</span>
              )}
            </button>
            {showSkillModal && (
              <div className="absolute left-0 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50" style={{ bottom: '100%', top: 'auto', marginBottom: '4px' }}>
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">技能选择</h4>
                </div>
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="搜索技能..."
                        value={skillSearchQuery}
                        onChange={(e) => setSkillSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSkills(prev => prev.map(s => ({ ...s, selected: !skillAllSelected })))
                      }}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                    >
                      {skillAllSelected ? (
                        <Minus className="w-3.5 h-3.5" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      全选
                    </button>
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto custom-scrollbar p-1">
                  {skills.filter(s => s.name.includes(skillSearchQuery) || skillSearchQuery === '').map((skill) => (
                    <button
                      key={skill.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSkills(prev => prev.map(s => s.id === skill.id ? { ...s, selected: !s.selected } : s))
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-left transition-colors ${
                        skill.selected
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        skill.selected
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-300 dark:border-gray-500'
                      }`}>
                        {skill.selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span>{skill.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div ref={toolModalRef} className="relative ml-2">
            <button
              onClick={() => setShowToolModal(!showToolModal)}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
              title="工具选择"
            >
              <Settings2 className="w-3 h-3" />
              工具({selectedToolCount})
            </button>
            {showToolModal && (
              <div className="absolute left-0 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50" style={{ bottom: '100%', top: 'auto', marginBottom: '4px' }}>
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">工具选择</h4>
                </div>
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="搜索工具..."
                        value={toolSearchQuery}
                        onChange={(e) => setToolSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setTools(prev => prev.map(t => ({ ...t, selected: !toolAllSelected })))
                      }}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                    >
                      {toolAllSelected ? (
                        <Minus className="w-3.5 h-3.5" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      全选
                    </button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
                  {(['MCP', '插件'] as const).map((category) => {
                    const categoryTools = tools.filter(
                      t => t.category === category && (t.name.includes(toolSearchQuery) || toolSearchQuery === '')
                    )
                    if (categoryTools.length === 0) return null
                    return (
                      <div key={category}>
                        <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">{category}</p>
                        {categoryTools.map((tool) => (
                          <button
                            key={tool.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setTools(prev => prev.map(t => t.id === tool.id ? { ...t, selected: !t.selected } : t))
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-left transition-colors ${
                              tool.selected
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              tool.selected
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-gray-300 dark:border-gray-500'
                            }`}>
                              {tool.selected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span>{tool.name}</span>
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          <div ref={expertModalRef} className="relative ml-2">
            <button
              onClick={() => setShowExpertModal(!showExpertModal)}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
              title="专家选择"
            >
              <Brain className="w-3 h-3" />
              专家
              {selectedExpertCount > 0 && (
                <span className="ml-0.5 text-blue-500 font-medium">({selectedExpertCount})</span>
              )}
            </button>
            {showExpertModal && (
              <div className="absolute left-0 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50" style={{ bottom: '100%', top: 'auto', marginBottom: '4px' }}>
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">专家选择</h4>
                </div>
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="搜索专家..."
                        value={expertSearchQuery}
                        onChange={(e) => setExpertSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setExperts(prev => prev.map(ex => ({ ...ex, selected: !expertAllSelected })))
                      }}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                    >
                      {expertAllSelected ? (
                        <Minus className="w-3.5 h-3.5" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      全选
                    </button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
                  {experts.filter(ex => ex.name.includes(expertSearchQuery) || expertSearchQuery === '').map((expert) => (
                    <div
                      key={expert.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors group hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setExperts(prev => prev.map(ex => ex.id === expert.id ? { ...ex, selected: !ex.selected } : ex))
                        }}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                          expert.selected
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-300 dark:border-gray-500'
                        }`}>
                          {expert.selected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${expert.selected ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>{expert.name}</p>
                          <p className="text-xs text-gray-400 truncate">{expert.description}</p>
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfiguringExpert(expert.id)
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                        title="能力配置"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 专家 Agent 配置面板 */}
          {configuringExpert && expertConfigs[configuringExpert] && <div
              id="expert-config-panel"
              className="absolute left-0 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-[60] flex flex-col max-h-[70vh]"
              style={{ bottom: '100%', top: 'auto', marginBottom: '4px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  能力配置 - {experts.find(e => e.id === configuringExpert)?.name}
                </h4>
                <button
                  onClick={() => setConfiguringExpert(null)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-4 space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">系统提示词</label>
                  <textarea
                    value={expertConfigs[configuringExpert].systemPrompt}
                    onChange={(e) => setExpertConfigs(prev => ({ ...prev, [configuringExpert]: { ...prev[configuringExpert], systemPrompt: e.target.value } }))}
                    onClick={(e) => e.stopPropagation()}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">温度 (Temperature)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={expertConfigs[configuringExpert].temperature}
                      onChange={(e) => setExpertConfigs(prev => ({ ...prev, [configuringExpert]: { ...prev[configuringExpert], temperature: parseFloat(e.target.value) } }))}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-xs text-gray-500 w-8 text-right">{expertConfigs[configuringExpert].temperature.toFixed(1)}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">值越低越严谨，越高越有创意</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">最大 Token 数</label>
                  <select
                    value={expertConfigs[configuringExpert].maxTokens}
                    onChange={(e) => setExpertConfigs(prev => ({ ...prev, [configuringExpert]: { ...prev[configuringExpert], maxTokens: parseInt(e.target.value) } }))}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={2048}>2,048</option>
                    <option value={4096}>4,096</option>
                    <option value={8192}>8,192</option>
                    <option value={16384}>16,384</option>
                    <option value={32768}>32,768</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-medium text-gray-500 block">记忆能力</label>
                    <p className="text-[10px] text-gray-400">记录对话历史供后续参考</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpertConfigs(prev => ({ ...prev, [configuringExpert]: { ...prev[configuringExpert], enableMemory: !prev[configuringExpert].enableMemory } }))
                    }}
                    className={`relative w-9 h-5 rounded-full transition-colors ${expertConfigs[configuringExpert].enableMemory ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${expertConfigs[configuringExpert].enableMemory ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-medium text-gray-500 block">知识库访问</label>
                    <p className="text-[10px] text-gray-400">允许检索知识库内容</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpertConfigs(prev => ({ ...prev, [configuringExpert]: { ...prev[configuringExpert], enableKnowledge: !prev[configuringExpert].enableKnowledge } }))
                    }}
                    className={`relative w-9 h-5 rounded-full transition-colors ${expertConfigs[configuringExpert].enableKnowledge ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${expertConfigs[configuringExpert].enableKnowledge ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-500">关联技能</label>
                    <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const alreadySelected = expertConfigs[configuringExpert].skillIds
                          setPendingSkillIds(alreadySelected)
                          setAddingSkill(true)
                        }}
                        className="p-0.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                        title="添加技能"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((skill) => {
                      const selected = expertConfigs[configuringExpert].skillIds.includes(skill.id)
                      return (
                        <button
                          key={skill.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpertConfigs(prev => ({
                              ...prev,
                              [configuringExpert]: {
                                ...prev[configuringExpert],
                                skillIds: selected
                                  ? prev[configuringExpert].skillIds.filter(id => id !== skill.id)
                                  : [...prev[configuringExpert].skillIds, skill.id]
                              }
                            }))
                          }}
                          className={`px-2 py-1 text-xs rounded-md transition-colors ${
                            selected
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {skill.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <label className="text-xs font-medium text-gray-500 block mb-2">关联工具</label>
                  {(['MCP', '插件'] as const).map((category) => {
                    const categoryTools = tools.filter(t => t.category === category)
                    return (
                      <div key={category} className="mb-2 last:mb-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] text-gray-400">{category}</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const alreadySelected = expertConfigs[configuringExpert].toolIds
                              const categoryToolIds = categoryTools.map(t => t.id)
                              setPendingToolIds(alreadySelected.filter(id => categoryToolIds.includes(id)))
                              setAddingToolCategory(category)
                            }}
                            className="p-0.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title={`添加${category}工具`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {categoryTools.map((tool) => {
                            const selected = expertConfigs[configuringExpert].toolIds.includes(tool.id)
                            return (
                              <button
                                key={tool.id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setExpertConfigs(prev => ({
                                    ...prev,
                                    [configuringExpert]: {
                                      ...prev[configuringExpert],
                                      toolIds: selected
                                        ? prev[configuringExpert].toolIds.filter(id => id !== tool.id)
                                        : [...prev[configuringExpert].toolIds, tool.id]
                                    }
                                  }))
                                }}
                                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                                  selected
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                              >
                                {tool.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
          }

          {/* 技能批量选择弹窗 */}
          {addingSkill && createPortal(
            <div className="fixed inset-0 z-[70]" onClick={() => { setAddingSkill(false) }}>
              <div
                id="expert-add-skill-panel"
                className="absolute bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl"
                style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '16rem' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">选择技能</h4>
                  <button
                    onClick={() => setAddingSkill(false)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <X className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </div>
                <div className="p-3 max-h-48 overflow-y-auto custom-scrollbar">
                  {skills.map((skill) => {
                    const selected = pendingSkillIds.includes(skill.id)
                    return (
                      <button
                        key={skill.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          setPendingSkillIds(prev =>
                            selected
                              ? prev.filter(id => id !== skill.id)
                              : [...prev, skill.id]
                          )
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-left transition-colors ${
                          selected
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                          selected
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-300 dark:border-gray-500'
                        }`}>
                          {selected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span>{skill.name}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const allSkillIds = skills.map(s => s.id)
                      const allSelected = allSkillIds.every(id => pendingSkillIds.includes(id))
                      if (allSelected) {
                        setPendingSkillIds(prev => prev.filter(id => !allSkillIds.includes(id)))
                      } else {
                        setPendingSkillIds([...allSkillIds])
                      }
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    {skills.every(s => pendingSkillIds.includes(s.id)) ? '取消全选' : '全选'}
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAddingSkill(false)}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpertConfigs(prev => ({
                          ...prev,
                          [configuringExpert]: {
                            ...prev[configuringExpert],
                            skillIds: pendingSkillIds
                          }
                        }))
                        setAddingSkill(false)
                      }}
                      className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                      确认添加
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
          {/* 工具批量选择弹窗 */}
          {addingToolCategory && createPortal(
            <div className="fixed inset-0 z-[70]" onClick={() => setAddingToolCategory(null)}>
              <div
                id="expert-add-tool-panel"
                className="absolute bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl"
                style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '16rem' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    选择{addingToolCategory}工具
                  </h4>
                  <button
                    onClick={() => setAddingToolCategory(null)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <X className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </div>
                <div className="p-3 max-h-48 overflow-y-auto custom-scrollbar">
                  {tools.filter(t => t.category === addingToolCategory).length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">暂无可用工具</p>
                  ) : (
                    tools.filter(t => t.category === addingToolCategory).map((tool) => {
                      const selected = pendingToolIds.includes(tool.id)
                      return (
                        <button
                          key={tool.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            setPendingToolIds(prev =>
                              selected
                                ? prev.filter(id => id !== tool.id)
                                : [...prev, tool.id]
                            )
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-left transition-colors ${
                            selected
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                            selected
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-300 dark:border-gray-500'
                          }`}>
                            {selected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span>{tool.name}</span>
                        </button>
                      )
                    })
                  )}
                </div>
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const allInCategory = tools.filter(t => t.category === addingToolCategory).map(t => t.id)
                      const allSelected = allInCategory.every(id => pendingToolIds.includes(id))
                      if (allSelected) {
                        setPendingToolIds(prev => prev.filter(id => !allInCategory.includes(id)))
                      } else {
                        setPendingToolIds(prev => [...new Set([...prev, ...allInCategory])])
                      }
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    {tools.filter(t => t.category === addingToolCategory).every(t => pendingToolIds.includes(t.id))
                      ? '取消全选'
                      : '全选'
                    }
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAddingToolCategory(null)}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpertConfigs(prev => {
                          const currentToolIds = prev[configuringExpert].toolIds
                          const otherCategoryIds = currentToolIds.filter(
                            id => !tools.filter(t => t.category === addingToolCategory).map(t => t.id).includes(id)
                          )
                          return {
                            ...prev,
                            [configuringExpert]: {
                              ...prev[configuringExpert],
                              toolIds: [...otherCategoryIds, ...pendingToolIds]
                            }
                          }
                        })
                        setAddingToolCategory(null)
                      }}
                      className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                      确认添加
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

          <div ref={permissionModalRef} className="relative ml-2">
            <button 
              onClick={() => setShowPermissionModal(!showPermissionModal)}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
              title="执行权限设置"
            >
              <Shield className="w-3 h-3" />
              权限
            </button>
            
            {/* 权限设置弹窗 */}
            {showPermissionModal && (
              <div className="absolute right-0 mt-1 w-72 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50" style={{ bottom: '100%', top: 'auto' }}>
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">执行权限</h4>
                </div>
                <div className="p-2">
                  {permissionOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setSelectedPermission(option.id)
                        setShowPermissionModal(false)
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        selectedPermission === option.id
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {option.icon === 'shield' && (
                        <div className="w-6 h-6 flex items-center justify-center">
                          <Shield className="w-4 h-4 text-green-500" />
                        </div>
                      )}
                      {option.icon === 'zap' && (
                        <div className="w-6 h-6 flex items-center justify-center">
                          <Zap className="w-4 h-4 text-yellow-500" />
                        </div>
                      )}
                      {option.icon === 'compass' && (
                        <div className="w-6 h-6 flex items-center justify-center">
                          <Compass className="w-4 h-4 text-blue-500" />
                        </div>
                      )}
                      {option.icon === 'alert-triangle' && (
                        <div className="w-6 h-6 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${selectedPermission === option.id ? 'text-yellow-800 dark:text-yellow-300' : 'text-gray-700 dark:text-gray-300'}`}>
                          {option.name}
                        </p>
                        <p className="text-xs text-gray-500">{option.description}</p>
                      </div>
                      {selectedPermission === option.id && (
                        <Check className="w-5 h-5 text-yellow-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={async () => {
              try {
                const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
                const existing = await WebviewWindow.getByLabel('terminal-popout')
                if (existing) {
                  await existing.setFocus()
                  return
                }
                const url = selectedFolder !== '选择项目...' && selectedFolder
                  ? `/terminal-popout.html?cwd=${encodeURIComponent(selectedFolder)}`
                  : '/terminal-popout.html'
                const popout = new WebviewWindow('terminal-popout', {
                  url,
                  title: 'GZAIStudio',
                  width: 1200,
                  height: 800,
                  decorations: true,
                  center: true,
                  resizable: true,
                })
                popout.once('tauri://error', () => {
                  window.open(url, '_blank', 'width=1200,height=800')
                })
              } catch {
                const url = '/terminal-popout.html'
                window.open(url, '_blank', 'width=1200,height=800')
              }
            }}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
            title="代码编辑终端"
          >
            <Terminal className="w-3.5 h-3.5" />
            终端
          </button>

        </div>

        {/* 工作区文件夹选择和上下文信息 */}
        <div className="flex items-center justify-between mt-2">
          {/* 工作区文件夹选择 */}
          <div className="relative">
            <button 
              onClick={() => setShowFolderDropdown(!showFolderDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="max-w-40 truncate">{selectedFolder}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showFolderDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {/* 文件夹选择下拉菜单 */}
            {showFolderDropdown && (
              <div ref={folderDropdownRef} className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50">
                <div className="p-2">
                  <button 
                    onClick={() => {
                      onFolderSelect('选择项目...')
                      setShowFolderDropdown(false)
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    清除选择
                  </button>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
                  <p className="px-3 py-1 text-xs text-gray-400">最近项目</p>
                  {recentFolders.map((folder, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        onFolderSelect(folder)
                        setShowFolderDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-2"
                    >
                      <FolderOpen className="w-3 h-3 text-gray-400" />
                      <span className="truncate">{folder}</span>
                    </button>
                  ))}
                  <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
                  <button
                    onClick={async () => {
                       try {
                         const result = await selectFolderWithTree('选择项目文件夹')
                         if (result) {
                           onFolderSelect(result.folderPath)
                           setShowFolderDropdown(false)
                         }
                       } catch (e) {
                         console.error('选择文件夹失败:', e)
                       }
                     }}
                    className="w-full px-3 py-2 text-left text-xs text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center gap-2"
                  >
                    <FolderOpen className="w-3 h-3" />
                    浏览文件夹...
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 上下文信息和设置 */}
          <button 
            onClick={() => setShowContextModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs transition-colors hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-gray-600 dark:text-gray-300">{tokenStats.usedTokens.toLocaleString()}</span>
            </div>
            {/* 进度条 */}
            <div className="w-20 h-2 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(parseFloat(usagePercent), 100)}%` }}
              />
            </div>
            <span className="text-orange-500 font-medium">{usagePercent}%</span>
          </button>
        </div>
      </div>

      {/* 上下文窗口设置弹出框 */}
      {showContextModal && (
        <div ref={modalRef} className="absolute bottom-36 right-4 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50">
          {/* 弹出框箭头 */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
            <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-200 dark:border-t-gray-700" />
          </div>
          
          {/* 弹出框内容 */}
          <div className="p-4">
            {/* 标题和关闭按钮 */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">上下文窗口</h3>
              <button 
                onClick={() => setShowContextModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* 占用百分比条 */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>占用百分比</span>
                <span className="text-orange-500 font-medium">{usagePercent}%</span>
              </div>
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(parseFloat(usagePercent), 100)}%` }}
                />
              </div>
            </div>

            {/* 上下文长度信息 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <span className="text-xs text-gray-500 block">上下文长度</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{contextMaxSize}</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <span className="text-xs text-gray-500 block">已使用</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{tokenStats.usedTokens.toLocaleString()}</span>
              </div>
            </div>

            {/* Token信息 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <span className="text-xs text-gray-500 block">TOKEN 总量</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{(totalTokens / 1000).toFixed(1)}k</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <span className="text-xs text-gray-500 block">已用 TOKEN</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{tokenStats.usedTokens.toLocaleString()}</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <span className="text-xs text-gray-500 block">输入 TOKEN</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{tokenStats.inputTokens.toLocaleString()}</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <span className="text-xs text-gray-500 block">输出 TOKEN</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{tokenStats.outputTokens.toLocaleString()}</span>
              </div>
            </div>

            {/* 上下文长度设置 */}
            <div className="mb-3">
              <span className="text-xs text-gray-500 block mb-2">上下文长度设置</span>
              <div className="flex flex-wrap gap-2">
                {contextSizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => handleContextSizeChange(size)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      contextMaxSize === size
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* 自定义上下文长度 */}
            <div className="mb-3">
              <span className="text-xs text-gray-500 block mb-2">自定义大小</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCustomSizeSubmit()
                    }
                  }}
                  placeholder="输入自定义大小 (如: 256KB, 1.5MB)"
                  className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  onClick={handleCustomSizeSubmit}
                  className="px-3 py-2 bg-orange-500 text-white text-xs rounded-lg hover:bg-orange-600 transition-colors"
                >
                  设置
                </button>
              </div>
            </div>

            {/* 当前设置提示 */}
            <div className="text-xs text-gray-500 text-center">
              当前设置: {contextMaxSize} ({(totalTokens / 1000).toFixed(1)} tokens)
            </div>
          </div>
        </div>
      )}

      {/* 复制失败浮动提示 */}
      {copyErrorMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-600 text-white text-sm rounded-lg shadow-lg animate-fade-in">
          {copyErrorMsg}
        </div>
      )}

    </div>
  )
}
