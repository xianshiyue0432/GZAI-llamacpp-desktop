import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { SetStateAction } from 'react'
import type { ChatMessage, ChatConfig, Attachment } from '../api/chat'
import { streamChat } from '../api/chat'
import type { ProviderConfig, ActiveModel, ModelDefinition, ModelStatus } from '../api/modelManager'
import {
  loadProviders,
  saveProviders,
  loadActiveModel,
  saveActiveModel,
  getAllModels,
  getActiveModel,
  getDefaultModel,
  loadDefaultModelId,
  saveDefaultModelId,
  loadModelStatuses,
  saveModelStatuses,
  getModelParams,
  calculateCost,
} from '../api/modelManager'
import { getCurrentWindow } from '@tauri-apps/api/window'

interface SessionMessages {
  [sessionId: string]: ChatMessage[]
}

// 消息持久化存储 - localStorage（快速缓存）+ 文件（可靠持久化）
const STORAGE_KEY_MESSAGES = 'canai-session-messages'
const DATA_FILE_NAME = 'canai-conversations.json'
let dataFilePath: string | null = null

async function getDataFilePath(): Promise<string> {
  if (dataFilePath) return dataFilePath
  const { appDataDir } = await import('@tauri-apps/api/path')
  dataFilePath = `${await appDataDir()}${DATA_FILE_NAME}`
  return dataFilePath
}

function loadMessages(): SessionMessages {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MESSAGES)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch {}
  return {}
}

function saveMessages(messages: SessionMessages) {
  try {
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages))
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('localStorage 空间不足（可能因对话历史中图片数据过大），消息记录无法保存', e)
    } else {
      console.error('保存消息记录失败', e)
    }
  }
}

// 文件持久化（Tauri FS，进程退出时数据不丢失）
async function saveMessagesToFile(messages: SessionMessages): Promise<void> {
  try {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await getDataFilePath()
    await writeTextFile(path, JSON.stringify(messages))
  } catch (e) {
    console.error('保存消息记录到文件失败', e)
  }
}

async function loadMessagesFromFile(): Promise<SessionMessages | null> {
  try {
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await getDataFilePath()
    const content = await readTextFile(path)
    return JSON.parse(content)
  } catch {
    return null
  }
}

interface RollbackState {
  sessionId: string
  originalMessages: ChatMessage[]
  rolledBackMessages: ChatMessage[]
  rollbackIndex: number
  hasNewActivity: boolean
}

interface MessageHistorySnapshot {
  sessionId: string
  messages: ChatMessage[]
  timestamp: number
}

export interface QueuedMessage {
  id: string
  content: string
  enqueuedAt: number
}

export interface SessionModel {
  sessionId: string
  modelId: string
}

interface ChatContextValue {
  messages: SessionMessages
  streamingSessions: { [sessionId: string]: boolean }
  messageQueue: Record<string, QueuedMessage[]>
  providers: ProviderConfig[]
  activeModelId: string | null
  activeProviderId: string | null
  activeModel: ActiveModel | null
  availableModels: ModelDefinition[]
  defaultModelId: string | null
  setDefaultModelId: (modelId: string | null) => void
  modelStatuses: Record<string, ModelStatus>
  setModelStatus: (modelId: string, status: ModelStatus) => void
  setProviders: (providers: ProviderConfig[]) => void
  setActiveModelId: (modelId: string, providerId?: string) => void
  reloadProviders: () => void
  sendMessage: (sessionId: string, content: string, attachments?: Attachment[]) => Promise<void>
  clearSessionMessages: (sessionId: string) => void
  getSessionMessages: (sessionId: string) => ChatMessage[]
  stopStreaming: (sessionId: string) => void
  appConfig: { apiKey: string; baseUrl: string; model: string; apiFormat: 'openai' | 'anthropic'; temperature: number; maxTokens: number }
  setAppConfig: (config: { apiKey: string; baseUrl: string; model: string; apiFormat: 'openai' | 'anthropic'; temperature?: number; maxTokens?: number; providerId?: string }) => void
  syncProviderConfig: (providerId: string, apiKey: string, baseUrl: string) => void
  // 本地服务状态
  llamaServiceStatus: 'running' | 'stopped' | 'starting' | 'switching'
  setLlamaServiceStatus: (status: SetStateAction<'running' | 'stopped' | 'starting' | 'switching'>) => void
  // 消息操作功能
  toggleMessageMark: (sessionId: string, messageId: string) => void
  retryMessage: (sessionId: string, messageId: string) => Promise<void>
  deleteMessage: (sessionId: string, messageId: string) => void
  copyMessage: (message: ChatMessage) => void
  rollbackToMessage: (sessionId: string, messageIndex: number) => void
  undoRollback: (sessionId: string) => void
  rollbackState: RollbackState | null
  isRolledBack: (sessionId: string) => boolean
  // 消息队列功能
  enqueueMessage: (sessionId: string, content: string) => void
  removeQueuedMessage: (sessionId: string, queueItemId: string) => void
  sendQueuedMessage: (sessionId: string, queueItemId: string) => QueuedMessage | null
  moveQueuedMessageToFront: (sessionId: string, queueItemId: string) => void
  dequeueMessageToInput: (sessionId: string, queueItemId: string) => QueuedMessage | null
  getQueuedMessages: (sessionId: string) => QueuedMessage[]
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<SessionMessages>(() => loadMessages())
  const [streamingSessions, setStreamingSessions] = useState<{ [sessionId: string]: boolean }>({})
  const [messageQueue, setMessageQueue] = useState<Record<string, QueuedMessage[]>>({})
  const streamingRef = useRef<{ [sessionId: string]: boolean }>({})
  const messageQueueRef = useRef<Record<string, QueuedMessage[]>>({})
  const [rollbackState, setRollbackState] = useState<RollbackState | null>(null)
  const [providers, setProvidersState] = useState<ProviderConfig[]>(() => loadProviders())
  const [activeModelId, setActiveModelIdState] = useState<string | null>(() => {
    const saved = loadActiveModel()
    if (saved) return saved.modelId
    const defaultFromStore = loadDefaultModelId()
    if (defaultFromStore) return defaultFromStore
    const defaultModel = getDefaultModel(loadProviders())
    return defaultModel?.id || null
  })

  const [activeProviderId, setActiveProviderId] = useState<string | null>(() => {
    const saved = loadActiveModel()
    return saved?.providerId || null
  })

  const [defaultModelId, setDefaultModelIdState] = useState<string | null>(() => loadDefaultModelId())

  const setDefaultModelId = useCallback((modelId: string | null) => {
    setDefaultModelIdState(modelId)
    saveDefaultModelId(modelId)
  }, [])

  const [modelStatuses, setModelStatusesState] = useState<Record<string, ModelStatus>>(() => loadModelStatuses())

  const [llamaServiceStatus, setLlamaServiceStatusState] = useState<'running' | 'stopped' | 'starting' | 'switching'>('stopped')

  const setLlamaServiceStatus = useCallback((status: SetStateAction<'running' | 'stopped' | 'starting' | 'switching'>) => {
    setLlamaServiceStatusState(status)
  }, [])

  const setModelStatus = useCallback((modelId: string, status: ModelStatus) => {
    setModelStatusesState(prev => {
      const next = { ...prev, [modelId]: status }
      saveModelStatuses(next)
      return next
    })
  }, [])

  const abortControllers = useRef<{ [sessionId: string]: AbortController }>({})

  // 消息持久化：localStorage（快速） + 文件（可靠）
  const messagesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (messagesSaveTimerRef.current) {
      clearTimeout(messagesSaveTimerRef.current)
    }
    messagesSaveTimerRef.current = setTimeout(() => {
      saveMessages(messages)
      saveMessagesToFile(messages)
    }, 300)
  }, [messages])

  // 启动时从文件加载（文件是最终可靠数据源）
  useEffect(() => {
    loadMessagesFromFile().then(fileData => {
      if (fileData && Object.keys(fileData).length > 0) {
        setMessages(fileData)
      }
    })
  }, [])

  // Tauri 窗口关闭前强制刷写到文件（await 确保写入完成后再关闭）
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  useEffect(() => {
    let cleanup: (() => void) | null = null
    getCurrentWindow().onCloseRequested(async () => {
      if (messagesSaveTimerRef.current) {
        clearTimeout(messagesSaveTimerRef.current)
        messagesSaveTimerRef.current = null
      }
      saveMessages(messagesRef.current)          // localStorage 快速保存
      await saveMessagesToFile(messagesRef.current)  // 文件可靠保存（等待完成）
    }).then(fn => {
      cleanup = () => { fn() }
    }).catch(() => {
      const handleBeforeUnload = () => {
        saveMessages(messagesRef.current)
        saveMessagesToFile(messagesRef.current)
      }
      window.addEventListener('beforeunload', handleBeforeUnload)
      cleanup = () => window.removeEventListener('beforeunload', handleBeforeUnload)
    })
    return () => { cleanup?.() }
  }, [])

  const providersRef = useRef(providers)
  providersRef.current = providers
  const activeModelIdRef = useRef(activeModelId)
  activeModelIdRef.current = activeModelId
  const activeProviderIdRef = useRef(activeProviderId)
  activeProviderIdRef.current = activeProviderId

  const activeModel = useRef<ActiveModel | null>(null)
  activeModel.current = (() => {
    if (activeProviderId) {
      const p = providers.find(x => x.id === activeProviderId)
      if (p) {
        const m = p.models.find(x => x.id === activeModelId)
        if (m) {
          return {
            modelId: m.id, providerId: p.id, modelName: m.name,
            providerName: p.name, type: p.type, baseUrl: p.baseUrl,
            apiKey: p.apiKey, apiFormat: p.apiFormat,
            ...getModelParams(m.id),
          }
        }
      }
    }
    return getActiveModel(providers, activeModelId)
  })()

  const availableModels = useMemo(() => getAllModels(providers), [providers])

  const setProviders = useCallback((newProviders: ProviderConfig[]) => {
    setProvidersState(newProviders)
    saveProviders(newProviders)
  }, [])

  const reloadProviders = useCallback(() => {
    const fresh = loadProviders()
    setProvidersState(fresh)
    if (activeModelId) {
      const stillExists = getActiveModel(fresh, activeModelId)
      if (!stillExists) {
        const defaultModel = getDefaultModel(fresh)
        if (defaultModel) {
          setActiveModelIdState(defaultModel.id)
          activeModelIdRef.current = defaultModel.id
          saveActiveModel({
            modelId: defaultModel.id,
            providerId: defaultModel.providerId,
            modelName: defaultModel.name,
            providerName: '',
            type: fresh.find(p => p.id === defaultModel.providerId)?.type || 'cloud',
            baseUrl: '',
            apiKey: '',
            apiFormat: 'openai',
            ...getModelParams(defaultModel.id),
          })
        }
      }
    }
    saveProviders(fresh)
  }, [activeModelId])

  const setActiveModelId = useCallback((modelId: string, providerId?: string) => {
    setActiveModelIdState(modelId)
    activeModelIdRef.current = modelId
    if (providerId) {
      setActiveProviderId(providerId)
      activeProviderIdRef.current = providerId
    }

    const targetProvider = providerId ? providers.find(p => p.id === providerId) : null
    if (targetProvider) {
      const model = targetProvider.models.find(m => m.id === modelId)
      if (model) {
        saveActiveModel({
          modelId: model.id,
          providerId: targetProvider.id,
          modelName: model.name,
          providerName: targetProvider.name,
          type: targetProvider.type,
          baseUrl: targetProvider.baseUrl,
          apiKey: targetProvider.apiKey,
          apiFormat: targetProvider.apiFormat,
          ...getModelParams(model.id),
        })
        return
      }
    }

    const fallback = getActiveModel(providers, modelId)
    if (fallback) saveActiveModel(fallback)
  }, [providers])

  const buildChatConfig = useCallback((model: ActiveModel): ChatConfig => {
    return {
      baseUrl: model.baseUrl,
      apiKey: model.apiKey,
      model: model.modelId,
      apiFormat: model.apiFormat,
      temperature: model.temperature,
      maxTokens: model.maxTokens,
      providerId: model.providerId || undefined,
    }
  }, [])

  const sendMessageInternal = useCallback(async (sessionId: string, content: string, attachments?: Attachment[]) => {
    // 防止并发调用：如果已经在流式处理中，直接返回
    if (streamingRef.current[sessionId]) {
      return
    }
    streamingRef.current[sessionId] = true

    let currentModel: ActiveModel | null = null
    const pid = activeProviderIdRef.current
    const mid = activeModelIdRef.current
    const ps = providersRef.current
    if (pid) {
      const p = ps.find(x => x.id === pid)
      if (p) {
        const m = p.models.find(x => x.id === mid)
        if (m) {
          currentModel = {
            modelId: m.id, providerId: p.id, modelName: m.name,
            providerName: p.name, type: p.type, baseUrl: p.baseUrl,
            apiKey: p.apiKey, apiFormat: p.apiFormat,
            ...getModelParams(m.id),
          }
        }
      }
    }
    if (!currentModel) {
      currentModel = getActiveModel(ps, mid)
    }
    if (!currentModel) {
      streamingRef.current[sessionId] = false
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '请先在模型面板中选择一个可用模型。',
        timestamp: new Date().toLocaleString('zh-CN'),
      }
      setMessages(prev => ({
        ...prev,
        [sessionId]: [...(prev[sessionId] || []), errorMsg],
      }))
      return
    }

    if (currentModel.type === 'cloud' && !currentModel.apiKey) {
      streamingRef.current[sessionId] = false
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `请在设置中配置 ${currentModel.providerName} 的 API Key 以开始对话。`,
        timestamp: new Date().toLocaleString('zh-CN'),
      }
      setMessages(prev => ({
        ...prev,
        [sessionId]: [...(prev[sessionId] || []), errorMsg],
      }))
      return
    }

    setRollbackState(prev => {
      if (prev && prev.sessionId === sessionId) {
        return { ...prev, hasNewActivity: true }
      }
      return prev
    })

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toLocaleString('zh-CN'),
      sendTime: Date.now(),
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    }

    setMessages(prev => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), userMessage],
    }))

    setStreamingSessions(prev => ({ ...prev, [sessionId]: true }))

    const assistantId = `assistant-${Date.now()}`
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleString('zh-CN'),
    }

    setMessages(prev => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), assistantMessage],
    }))

    const abortController = new AbortController()
    abortControllers.current[sessionId] = abortController

    // 安全超时：防止请求无限挂起导致"思考..."状态永远不结束
    // 300秒（5分钟）适用于长文本生成和深思考模型
    const safetyTimeoutId = setTimeout(() => {
      const controller = abortControllers.current[sessionId]
      if (controller && controller === abortController) {
        controller.abort()
      }
    }, 300000)

    try {
      const systemPrompt = pid ? providersRef.current.find(x => x.id === pid)?.systemPrompt : ''
      const currentMessages = messages[sessionId] || []
      const historyMessages: ChatMessage[] = currentMessages.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }))
      if (systemPrompt && !historyMessages.some(m => m.role === 'system')) {
        historyMessages.unshift({ id: 'system-prompt', role: 'system', content: systemPrompt })
      }
      historyMessages.push({
        id: userMessage.id,
        role: 'user',
        content: userMessage.content,
        ...(userMessage.attachments && userMessage.attachments.length > 0 ? { attachments: userMessage.attachments } : {}),
      })

      const chatConfig: ChatConfig = {
        baseUrl: currentModel.baseUrl,
        apiKey: currentModel.apiKey,
        model: currentModel.modelId,
        apiFormat: currentModel.apiFormat,
        temperature: currentModel.temperature,
        maxTokens: currentModel.maxTokens,
        providerId: currentModel.providerId || undefined,
      }
      const generator = streamChat(historyMessages, chatConfig, abortController.signal)

      let responseStartTime: number | null = null
      let totalTokens = 0
      let accumulatedContent = ''
      let finalized = false

      for await (const chunk of generator) {
        // 记录首 token 时间
        if (chunk.content && !responseStartTime) {
          responseStartTime = Date.now()
        }

        if (chunk.tokens) {
          totalTokens = chunk.tokens
        }

        if (chunk.error) {
          const isAbort = chunk.error.toLowerCase().includes('abort') || chunk.error.toLowerCase().includes('signal')
          if (isAbort) {
            setMessages(prev => {
              const sessionMsgs = prev[sessionId] || []
              return {
                ...prev,
                [sessionId]: sessionMsgs.map(msg =>
                  msg.id === assistantId
                    ? { ...msg, content: msg.content ? msg.content + '\n\n[已停止]' : '[已停止]' }
                    : msg
                ),
              }
            })
          } else {
            const hasImages = userMessage.attachments?.some(a => a.type === 'image')
            const errorDisplay = hasImages
              ? `错误: ${chunk.error}\n\n提示：当前模型可能不支持图片输入，请尝试仅发送文字消息。`
              : `错误: ${chunk.error}`
            setMessages(prev => {
              const sessionMsgs = prev[sessionId] || []
              return {
                ...prev,
                [sessionId]: sessionMsgs.map(msg =>
                  msg.id === assistantId
                    ? { ...msg, content: errorDisplay }
                    : msg
                ),
              }
            })
          }
          break
        }

        if (chunk.content) {
          accumulatedContent += chunk.content
          setMessages(prev => {
            const sessionMsgs = prev[sessionId] || []
            return {
              ...prev,
              [sessionId]: sessionMsgs.map(msg =>
                msg.id === assistantId
                  ? { ...msg, content: msg.content + chunk.content }
                  : msg
              ),
            }
          })
        }

        if (chunk.done && !finalized) {
          finalized = true
          const endTime = Date.now()
          const duration = userMessage.sendTime ? Math.round((endTime - userMessage.sendTime) / 1000) : 0
          const modelName = currentModel?.modelName || currentModel?.modelId || ''

          let cjkCount = 0
          let otherWideCount = 0
          let asciiCount = 0
          for (const ch of accumulatedContent) {
            if (ch >= '\u4e00' && ch <= '\u9fff') { cjkCount++ }
            else if (ch >= '\u3000' && ch <= '\u303f') { otherWideCount++ }
            else if (ch >= '\uff00' && ch <= '\uffef') { otherWideCount++ }
            else if (ch.charCodeAt(0) > 127) { otherWideCount++ }
            else { asciiCount++ }
          }
          const estimatedTokens = Math.ceil(cjkCount * 1.0 + otherWideCount * 1.5 + asciiCount / 3.5)

          const serverPlausible = totalTokens > 0 && Math.abs(totalTokens - estimatedTokens) / estimatedTokens <= 0.3
          const finalTokens = serverPlausible ? totalTokens : estimatedTokens
          const cost = currentModel?.type === 'local' ? 0 : calculateCost(currentModel?.modelId || '', finalTokens)

          setMessages(prev => {
            const sessionMsgs = prev[sessionId] || []
            return {
              ...prev,
              [sessionId]: sessionMsgs.map(msg =>
                msg.id === assistantId
                  ? { ...msg, duration, tokens: finalTokens, modelName, cost, timestamp: new Date().toLocaleString('zh-CN') }
                  : msg
              ),
            }
          })
        }
      }
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error)
      if (error instanceof DOMException && error.name === 'AbortError') {
        setMessages(prev => {
          const sessionMsgs = prev[sessionId] || []
          return {
            ...prev,
            [sessionId]: sessionMsgs.map(msg =>
              msg.id === assistantId
                ? { ...msg, content: msg.content + '\n\n[已停止]' }
                : msg
            ),
          }
        })
      } else {
        setMessages(prev => {
          const sessionMsgs = prev[sessionId] || []
          return {
            ...prev,
            [sessionId]: sessionMsgs.map(msg =>
              msg.id === assistantId
                ? { ...msg, content: `错误: ${errorText}` }
                : msg
            ),
          }
        })
      }
    } finally {
      clearTimeout(safetyTimeoutId)
      setStreamingSessions(prev => ({ ...prev, [sessionId]: false }))
      streamingRef.current[sessionId] = false
      delete abortControllers.current[sessionId]

      // 兜底防护：如果助理消息内容为空，替换为提示信息
      setMessages(prev => {
        const sessionMsgs = prev[sessionId] || []
        const hasEmptyAssistant = sessionMsgs.some(
          msg => msg.id === assistantId && (!msg.content || msg.content.trim() === '')
        )
        if (hasEmptyAssistant) {
          return {
            ...prev,
            [sessionId]: sessionMsgs.map(msg =>
              msg.id === assistantId
                ? { ...msg, content: '（模型返回了空白响应，请重试或更换模型）' }
                : msg
            ),
          }
        }
        return prev
      })
      
      // 发送完成后，使用 ref 读取最新队列并自动发送下一条消息
      const queue = messageQueueRef.current[sessionId] || []
      if (queue.length > 0) {
        const nextMessage = queue[0]
        setMessageQueue(prev => {
          const updated = { ...prev }
          updated[sessionId] = (prev[sessionId] || []).slice(1)
          messageQueueRef.current = updated
          return updated
        })
        // 使用流式处理中的 sendMessageInternal, 但内部已有 streamingRef 并发保护
        sendMessageInternal(sessionId, nextMessage.content)
      }
    }
  }, [messages])

  const sendMessage = useCallback(async (sessionId: string, content: string, attachments?: Attachment[]) => {
    // 使用 ref 实时检查流式处理状态，避免闭包过期问题
    if (streamingRef.current[sessionId]) {
      const item: QueuedMessage = {
        id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content,
        enqueuedAt: Date.now(),
      }
      setMessageQueue(prev => {
        const updated = { ...prev, [sessionId]: [...(prev[sessionId] || []), item] }
        messageQueueRef.current = updated
        return updated
      })
      return
    }
    
    // 否则直接发送消息
    await sendMessageInternal(sessionId, content, attachments)
  }, [sendMessageInternal])

  const clearSessionMessages = useCallback((sessionId: string) => {
    setMessages(prev => {
      const next = { ...prev }
      delete next[sessionId]
      return next
    })
  }, [])

  const getSessionMessages = useCallback((sessionId: string): ChatMessage[] => {
    return messages[sessionId] || []
  }, [messages])

  const stopStreaming = useCallback((sessionId: string) => {
    const controller = abortControllers.current[sessionId]
    if (controller) {
      controller.abort()
    }
  }, [])

  const currentActiveModel = activeModel.current

  const appConfig = {
    apiKey: currentActiveModel?.apiKey || '',
    baseUrl: currentActiveModel?.baseUrl || '',
    model: currentActiveModel?.modelId || '',
    apiFormat: (currentActiveModel?.apiFormat || 'openai') as 'openai' | 'anthropic',
    temperature: currentActiveModel?.temperature || 0.7,
    maxTokens: currentActiveModel?.maxTokens || 4096,
  }

  const setAppConfig = useCallback((config: { apiKey: string; baseUrl: string; model: string; apiFormat: 'openai' | 'anthropic'; temperature?: number; maxTokens?: number; providerId?: string }) => {
    if (config.providerId) {
      setProvidersState(prev => {
        const updated = prev.map(p =>
          p.id === config.providerId
            ? { ...p, apiKey: config.apiKey, baseUrl: config.baseUrl, apiFormat: config.apiFormat as 'openai' | 'anthropic', enabled: true }
            : p
        )
        saveProviders(updated)
        return updated
      })
    }
    setActiveModelIdState(config.model)
    activeModelIdRef.current = config.model
    if (config.providerId) {
      setActiveProviderId(config.providerId)
      activeProviderIdRef.current = config.providerId
    }
    saveActiveModel({
      modelId: config.model,
      providerId: config.providerId || '',
      modelName: config.model,
      providerName: '',
      type: 'cloud',
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      apiFormat: config.apiFormat,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
    })
  }, [])

  const syncProviderConfig = useCallback((providerId: string, apiKey: string, baseUrl: string) => {
    setProvidersState(prev => {
      const updated = prev.map(p =>
        p.id === providerId
          ? { ...p, apiKey, baseUrl, enabled: true }
          : p
      )
      saveProviders(updated)
      return updated
    })
  }, [])

  const toggleMessageMark = useCallback((sessionId: string, messageId: string) => {
    setMessages(prev => ({
      ...prev,
      [sessionId]: (prev[sessionId] || []).map(msg =>
        msg.id === messageId ? { ...msg, isMarked: !msg.isMarked } : msg
      ),
    }))
  }, [])

  const retryMessage = useCallback(async (sessionId: string, messageId: string) => {
    const sessionMsgs = messages[sessionId] || []
    const message = sessionMsgs.find(msg => msg.id === messageId)
    if (!message || message.role !== 'user') return

    // 同时传递附件内容（图片、文件等），确保重试时完整还原原始消息
    await sendMessage(sessionId, message.content, message.attachments)
  }, [messages, sendMessage])

  const deleteMessage = useCallback((sessionId: string, messageId: string) => {
    setMessages(prev => ({
      ...prev,
      [sessionId]: (prev[sessionId] || []).filter(msg => msg.id !== messageId),
    }))
    if (rollbackState && rollbackState.sessionId === sessionId) {
      setRollbackState(prev => prev ? {
        ...prev,
        rolledBackMessages: prev.rolledBackMessages.filter(msg => msg.id !== messageId),
      } : null)
    }
  }, [rollbackState])

  const copyMessage = useCallback((message: ChatMessage) => {
    navigator.clipboard.writeText(message.content)
  }, [])

  const rollbackToMessage = useCallback((sessionId: string, messageIndex: number) => {
    const sessionMsgs = messages[sessionId] || []
    if (messageIndex < 0 || messageIndex >= sessionMsgs.length) return

    const rolledBackMessages = sessionMsgs.slice(0, messageIndex + 1)
    
    setRollbackState({
      sessionId,
      originalMessages: [...sessionMsgs],
      rolledBackMessages: [...rolledBackMessages],
      rollbackIndex: messageIndex,
      hasNewActivity: false,
    })

    setMessages(prev => ({
      ...prev,
      [sessionId]: rolledBackMessages,
    }))
  }, [messages])

  const undoRollback = useCallback((sessionId: string) => {
    if (!rollbackState || rollbackState.sessionId !== sessionId) return
    
    setMessages(prev => ({
      ...prev,
      [sessionId]: rollbackState.originalMessages,
    }))
    
    setRollbackState(null)
  }, [rollbackState])

  const isRolledBack = useCallback((sessionId: string) => {
    return rollbackState?.sessionId === sessionId && !rollbackState.hasNewActivity
  }, [rollbackState])

  // 消息队列操作函数
  const enqueueMessage = useCallback((sessionId: string, content: string) => {
    const item: QueuedMessage = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      enqueuedAt: Date.now(),
    }
    setMessageQueue(prev => {
      const updated = { ...prev, [sessionId]: [...(prev[sessionId] || []), item] }
      messageQueueRef.current = updated
      return updated
    })
  }, [])

  const removeQueuedMessage = useCallback((sessionId: string, queueItemId: string) => {
    setMessageQueue(prev => {
      const updated = { ...prev, [sessionId]: (prev[sessionId] || []).filter(item => item.id !== queueItemId) }
      messageQueueRef.current = updated
      return updated
    })
  }, [])

  const sendQueuedMessage = useCallback((sessionId: string, queueItemId: string): QueuedMessage | null => {
    const queue = messageQueueRef.current[sessionId] || []
    const item = queue.find(q => q.id === queueItemId)
    if (!item) return null

    // 从队列中移除
    setMessageQueue(prev => {
      const updated = { ...prev, [sessionId]: (prev[sessionId] || []).filter(q => q.id !== queueItemId) }
      messageQueueRef.current = updated
      return updated
    })

    // 如果正在流式处理，先中止当前请求，等待完成后立即发送
    if (streamingRef.current[sessionId]) {
      const controller = abortControllers.current[sessionId]
      if (controller) {
        controller.abort()
      }
      // 轮询等待 streamingRef 变为 false（当前流式处理的 finally 块执行完毕）
      const waitAndSend = () => {
        if (!streamingRef.current[sessionId]) {
          sendMessageInternal(sessionId, item.content)
        } else {
          setTimeout(waitAndSend, 50)
        }
      }
      setTimeout(waitAndSend, 0)
    } else {
      // 没有在流式处理，直接发送
      sendMessageInternal(sessionId, item.content)
    }

    return item
  }, [sendMessageInternal])

  const moveQueuedMessageToFront = useCallback((sessionId: string, queueItemId: string) => {
    setMessageQueue(prev => {
      const queue = prev[sessionId] || []
      const itemIndex = queue.findIndex(q => q.id === queueItemId)
      if (itemIndex <= 0) return prev

      const item = queue[itemIndex]
      const newQueue = queue.slice(0, itemIndex).concat(queue.slice(itemIndex + 1))
      newQueue.unshift(item)
      const updated = { ...prev, [sessionId]: newQueue }
      messageQueueRef.current = updated
      return updated
    })
  }, [])

  const dequeueMessageToInput = useCallback((sessionId: string, queueItemId: string): QueuedMessage | null => {
    const queue = messageQueueRef.current[sessionId] || []
    const item = queue.find(q => q.id === queueItemId)
    if (!item) return null

    // 从队列中移除
    setMessageQueue(prev => {
      const updated = { ...prev, [sessionId]: (prev[sessionId] || []).filter(q => q.id !== queueItemId) }
      messageQueueRef.current = updated
      return updated
    })

    return item
  }, [])

  const getQueuedMessages = useCallback((sessionId: string): QueuedMessage[] => {
    return messageQueue[sessionId] || []
  }, [messageQueue])

  return (
    <ChatContext.Provider value={{
      messages,
      streamingSessions,
      messageQueue,
      providers,
      activeModelId,
      activeProviderId,
      activeModel: currentActiveModel,
      availableModels,
       defaultModelId,
       setDefaultModelId,
       modelStatuses,
       setModelStatus,
       llamaServiceStatus,
       setLlamaServiceStatus,
      setProviders,
      setActiveModelId,
      reloadProviders,
      sendMessage,
      clearSessionMessages,
      getSessionMessages,
      stopStreaming,
      appConfig,
      setAppConfig,
      syncProviderConfig,
      toggleMessageMark,
      retryMessage,
      deleteMessage,
      copyMessage,
      rollbackToMessage,
      undoRollback,
      rollbackState,
      isRolledBack,
      enqueueMessage,
      removeQueuedMessage,
      sendQueuedMessage,
      moveQueuedMessageToFront,
      dequeueMessageToInput,
      getQueuedMessages,
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}
