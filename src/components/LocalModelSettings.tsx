import { useState, useEffect, useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'
import { invoke } from '@tauri-apps/api/core'
import { useChat } from '../contexts/ChatContext'
import {
  loadLocalModelPath,
  saveLocalModelPath,
  loadLocalModelConfig,
  saveLocalModelConfig,
  checkLlamaCppHealth,
  formatFileSize,
  formatDate,
  createLocalProvider,
  type LocalModelInfo,
  type DetailedModelInfo,
  type CompanionFile,
  type ServerStatus,
} from '../api/modelManager'
import {
  Server,
  Key,
  FolderOpen,
  Cpu,
  Zap,
  HardDrive,
  Play,
  Copy,
  RefreshCw,
  X,
  Check,
  Download,
  Search,
  Save,
  AlertCircle,
  Power,
  Eye,
  EyeOff,
  Image,
  Mic,
  Volume2,
  Plus,
  Edit3,
  Trash2,
  Info,
  Monitor,
  Bot,
  FileSearch,
} from 'lucide-react'

interface Model {
  id: string
  name: string
  status: 'active' | 'available'
  provider: string
  size?: number
  modified?: number
  detailedInfo?: DetailedModelInfo
}

interface CompanionConfig {
  image_video: CompanionFile[]
  audio_input: CompanionFile[]
  audio_output: CompanionFile[]
}

const LOCAL_API_KEY = 'canai-local-api-key'
const LOCAL_SELECTED_MODEL_KEY = 'canai-local-selected-model'
const LOCAL_MODEL_PATHS_KEY = 'canai-local-model-paths'
const LOCAL_SERVER_CONFIG_KEY = 'canai-local-server-config'
const LOCAL_COMPANION_CONFIGS_KEY = 'canai-local-companion-configs'
const LOCAL_MODEL_TYPES_KEY = 'canai-local-model-types'

function loadCompanionConfigs(): Record<string, CompanionConfig> {
  try {
    const saved = localStorage.getItem(LOCAL_COMPANION_CONFIGS_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch { return {} }
}

function saveCompanionConfigs(configs: Record<string, CompanionConfig>): void {
  try {
    localStorage.setItem(LOCAL_COMPANION_CONFIGS_KEY, JSON.stringify(configs))
  } catch {}
}

function loadModelTypes(): Record<string, string> {
  try {
    const saved = localStorage.getItem(LOCAL_MODEL_TYPES_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch { return {} }
}

function saveModelTypes(types: Record<string, string>): void {
  try {
    localStorage.setItem(LOCAL_MODEL_TYPES_KEY, JSON.stringify(types))
  } catch {}
}

export default function LocalModelSettings() {
  const { setActiveModelId, setProviders, providers, activeModelId, llamaServiceStatus, setLlamaServiceStatus } = useChat()
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem(LOCAL_API_KEY) || '' } catch { return '' }
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [modelPath, setModelPath] = useState('')
  const [copied, setCopied] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({})
  const [serverUrl, setServerUrl] = useState('http://127.0.0.1:8080')
  const [serverConnected, setServerConnected] = useState(false)
  const [serverChecking, setServerChecking] = useState(false)
  const [serverError, setServerError] = useState('')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [initReady, setInitReady] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFormatModal, setShowFormatModal] = useState(false)
  const [showCompanionModal, setShowCompanionModal] = useState<string | null>(null)
  const [companionConfigs, setCompanionConfigs] = useState<Record<string, CompanionConfig>>(() => loadCompanionConfigs())
  const [modelTypes, setModelTypes] = useState<Record<string, string>>(() => loadModelTypes())
  const [companionEdits, setCompanionEdits] = useState<CompanionConfig>({ image_video: [], audio_input: [], audio_output: [] })
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editPathValue, setEditPathValue] = useState('')
  const formatBtnRef = useRef<HTMLButtonElement>(null)
  const formatModalRef = useRef<HTMLDivElement>(null)
  
  const DEFAULT_CONFIG = {
    port: 8080,
    host: '127.0.0.1',
    n_gpu_layers: -1,
    n_ctx: 4096,
    threads: 8,
    batch_size: 512,
    device: 'auto' as const,
    quantization: 'auto' as const,
    gpu_memory_limit: 8,
    mtp_tokens: 0,
  }

  const [config, setConfig] = useState(DEFAULT_CONFIG)

  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string; position: { top: number; left: number } } | null>(null)
  const hotSwitchCounter = useRef(0)
  const healthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoStartRef = useRef(false)
  const checkServerStatusRef = useRef<((url?: string) => Promise<void>) | null>(null)

  const getModelCompanionConfig = useCallback((modelId: string): CompanionConfig => {
    const baseConfig = companionConfigs[modelId]
    if (baseConfig) return baseConfig
    const model = models.find(m => m.id === modelId)
    const autoImageVideo = model?.detailedInfo?.auto_matched_mmproj || []
    return {
      image_video: autoImageVideo,
      audio_input: [],
      audio_output: [],
    }
  }, [companionConfigs, models])

  const getModelType = useCallback((modelId: string, detailedInfo?: DetailedModelInfo): string => {
    if (modelTypes[modelId]) return modelTypes[modelId]
    if (detailedInfo?.model_type) return detailedInfo.model_type
    return 'text'
  }, [modelTypes])

  const getIsMultimodal = useCallback((modelId: string, detailedInfo?: DetailedModelInfo): boolean => {
    if (modelTypes[modelId]) return modelTypes[modelId] === 'multimodal'
    if (detailedInfo?.is_multimodal) return true
    const config = getModelCompanionConfig(modelId)
    return config.image_video.length > 0 || config.audio_input.length > 0 || config.audio_output.length > 0
  }, [modelTypes, getModelCompanionConfig])

  useEffect(() => {
    const savedPath = loadLocalModelPath()
    if (savedPath) {
      setModelPath(savedPath)
      scanModelsInDir(savedPath)
    }
    
    const savedConfig = loadLocalModelConfig()
    setConfig(savedConfig)
    const url = `http://${savedConfig.host}:${savedConfig.port}`
    setServerUrl(url)
    
    ;(async () => {
      const isAlreadyRunning = await checkLlamaCppHealth(url)
      if (!isAlreadyRunning) {
        try { await invoke('llama_cpp_kill_stale') } catch {}
      }
      setLlamaServiceStatus(isAlreadyRunning ? 'running' : 'stopped')
      setServerConnected(isAlreadyRunning)
      setInitReady(true)
      if (!isAlreadyRunning) {
        checkServerStatus(url)
      }
    })()

    healthIntervalRef.current = setInterval(() => {
      checkServerStatusRef.current?.()
    }, 15000)

    return () => {
      if (healthIntervalRef.current) clearInterval(healthIntervalRef.current)
    }
  }, [])

  useEffect(() => {
    if (models.length > 0 && models[0].id !== 'placeholder') {
      try {
        const savedId = localStorage.getItem(LOCAL_SELECTED_MODEL_KEY)
        if (savedId && models.some(m => m.id === savedId)) {
          setSelectedModel(savedId)
        }
      } catch {}
      syncAllModelsToProviders()
      if (!activeModelId) {
        const firstModel = models.find(m => m.id !== 'placeholder')
        if (firstModel) {
          setSelectedModel(firstModel.id)
          setActiveModelId(firstModel.id, 'local-llama')
          try { localStorage.setItem(LOCAL_SELECTED_MODEL_KEY, firstModel.id) } catch {}
        }
      }
    }
  }, [models])

  useEffect(() => {
    if (selectedModel) {
      try { localStorage.setItem(LOCAL_SELECTED_MODEL_KEY, selectedModel) } catch {}
    }
  }, [selectedModel])

  useEffect(() => {
    if (models.length > 0 && models[0].id !== 'placeholder' && modelPath && initReady && selectedModel && !autoStartRef.current) {
      autoStartRef.current = true
      handleStartServer()
    }
  }, [models, selectedModel, modelPath, initReady])

  useEffect(() => {
    if (models.length > 0 && models[0].id !== 'placeholder') {
      const paths: Record<string, string> = {}
      for (const m of models) {
        paths[m.id] = m.provider
      }
      try { localStorage.setItem(LOCAL_MODEL_PATHS_KEY, JSON.stringify(paths)) } catch {}
    }
  }, [models])

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_SERVER_CONFIG_KEY, JSON.stringify({
        port: config.port,
        host: config.host,
        n_gpu_layers: config.n_gpu_layers,
        n_ctx: config.n_ctx,
        threads: config.threads,
        batch_size: config.batch_size,
        mtp_tokens: config.mtp_tokens,
        apiKey: apiKey,
        serverUrl: serverUrl,
      }))
    } catch {}
  }, [config, apiKey, serverUrl])

  useEffect(() => {
    saveCompanionConfigs(companionConfigs)
  }, [companionConfigs])

  useEffect(() => {
    saveModelTypes(modelTypes)
  }, [modelTypes])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (formatModalRef.current && !formatModalRef.current.contains(e.target as Node) &&
          formatBtnRef.current && !formatBtnRef.current.contains(e.target as Node)) {
        setShowFormatModal(false)
      }
    }
    if (showFormatModal) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showFormatModal])

  const doHotSwitch = useCallback(async (modelId: string) => {
    if (llamaServiceStatus !== 'running' && llamaServiceStatus !== 'switching') return
    const model = models.find(m => m.id === modelId)
    if (!model || !model.provider) return
    const companionConfig = getModelCompanionConfig(modelId)
    const isMultimodal = getModelType(modelId, model.detailedInfo) === 'multimodal'
    const mmprojPath = isMultimodal && companionConfig.image_video.length > 0 ? companionConfig.image_video[0].file_path : undefined
    const audioInputPath = isMultimodal && companionConfig.audio_input.length > 0 ? companionConfig.audio_input[0].file_path : undefined
    const modelVocoder = isMultimodal && companionConfig.audio_output.length > 0 ? companionConfig.audio_output[0].file_path : undefined
    setLlamaServiceStatus('switching')
    try {
      await invoke('llama_cpp_switch_model', {
        config: {
          model_path: model.provider,
          port: config.port,
          host: config.host,
          n_gpu_layers: config.n_gpu_layers,
          n_ctx: config.n_ctx,
          threads: config.threads,
          batch_size: config.batch_size,
          api_key: apiKey || undefined,
          mtp_tokens: config.mtp_tokens,
          mmproj_path: mmprojPath,
          audio_input_path: audioInputPath,
          model_vocoder: modelVocoder,
        }
      })
      setLlamaServiceStatus('running')
    } catch (e) {
      console.error('Hot-switch failed:', e)
      setLlamaServiceStatus('stopped')
    }
  }, [llamaServiceStatus, models, config, apiKey, getModelCompanionConfig, getModelType])

  const checkServerStatus = useCallback(async (customUrl?: string) => {
    const targetUrl = customUrl || serverUrl
    let running = false
    try {
      const ok = await checkLlamaCppHealth(targetUrl)
      running = ok
    } catch {}
    setLlamaServiceStatus(prev => {
      if (prev === 'starting' || prev === 'switching') return prev
      return running ? 'running' : 'stopped'
    })
    setServerConnected(running)
  }, [serverUrl])

  useEffect(() => {
    checkServerStatusRef.current = checkServerStatus
  }, [checkServerStatus])

  const handleCheckHealth = useCallback(async () => {
    setServerChecking(true)
    setServerError('')
    try {
      const ok = await checkLlamaCppHealth(serverUrl)
      setServerConnected(ok)
      if (!ok) setServerError('无法连接到 llama.cpp 服务')
      else setServerError('')
    } catch {
      setServerConnected(false)
      setServerError('连接超时或失败')
    } finally {
      setServerChecking(false)
    }
  }, [serverUrl])

  const scanModelsInDir = useCallback(async (dirPath: string) => {
    try {
      const detected: Model[] = []
      let detailedList: DetailedModelInfo[] = []
      try {
        detailedList = await invoke('llama_cpp_scan_detailed_models', { dirPath })
      } catch {
        const modelsInfo: LocalModelInfo[] = await invoke('llama_cpp_scan_models', { dirPath })
        for (const info of modelsInfo) {
          detected.push({
            id: `local-${info.name}`,
            name: info.name,
            status: 'available',
            provider: info.path,
            size: info.size,
            modified: info.modified,
          })
        }
      }

      if (detailedList.length > 0) {
        for (const detail of detailedList) {
          detected.push({
            id: `local-${detail.name}`,
            name: detail.name,
            status: 'available',
            provider: detail.path,
            size: detail.size,
            modified: detail.modified,
            detailedInfo: detail,
          })
        }
      }

      if (detected.length === 0) {
        detected.push({ id: 'placeholder', name: '（目录中未发现模型文件）', status: 'available', provider: '' })
      }
      setModels(detected)

      const newCompanionConfigs = { ...loadCompanionConfigs() }
      for (const detail of detailedList) {
        const modelId = `local-${detail.name}`
        if (!newCompanionConfigs[modelId] && detail.auto_matched_mmproj.length > 0) {
          newCompanionConfigs[modelId] = {
            image_video: detail.auto_matched_mmproj,
            audio_input: [],
            audio_output: [],
          }
        }
      }
      setCompanionConfigs(newCompanionConfigs)
    } catch (e) {
      setModels([{ id: 'placeholder', name: `（扫描目录失败: ${e}）`, status: 'available', provider: '' }])
    }
  }, [])

  const handleBrowseModelDir = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({ directory: true, multiple: false, title: '选择模型存放目录' })
      if (selected && typeof selected === 'string') {
        setModelPath(selected)
        saveLocalModelPath(selected)
        await scanModelsInDir(selected)
      }
    } catch {
      const path = prompt('请输入模型存放目录路径:', modelPath || '')
      if (path) {
        setModelPath(path)
        saveLocalModelPath(path)
        scanModelsInDir(path)
      }
    }
  }

  const handleRefreshModels = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const position = {
      top: rect.bottom + 8,
      left: rect.left
    }
    
    if (!modelPath) {
      setNotification({ type: 'error', message: '刷新失败（请先选择模型目录）', position })
      setTimeout(() => { setNotification(null) }, 3000)
      return
    }
    
    flushSync(() => setRefreshing(true))
    try {
      await scanModelsInDir(modelPath)
      setNotification({ type: 'success', message: '已刷新列表', position })
    } catch (error) {
      setNotification({ type: 'error', message: `刷新失败（${error instanceof Error ? error.message : '未知错误'}）`, position })
    } finally {
      setRefreshing(false)
      setTimeout(() => { setNotification(null) }, 3000)
    }
  }

  const handleDownloadModel = () => {
    window.open('https://huggingface.co/models', '_blank')
  }

  const handleResetToDefault = () => {
    setConfig(DEFAULT_CONFIG)
    setSaveSuccess(true)
    setSaveMessage('已恢复默认设置')
    setTimeout(() => { setSaveMessage(''); setSaveSuccess(false) }, 3000)
  }

  const handleGenerateApiKey = async () => {
    try {
      const newKey: string = await invoke('llama_cpp_generate_api_key')
      setApiKey(newKey)
      try { localStorage.setItem(LOCAL_API_KEY, newKey) } catch {}
    } catch {
      const key = 'canai-' + Math.random().toString(36).substring(2, 34)
      setApiKey(key)
      try { localStorage.setItem(LOCAL_API_KEY, key) } catch {}
    }
  }

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStartServer = async () => {
    if (!modelPath) {
      setServerError('请先设置模型目录')
      return
    }

    let modelToUse = models.find(m => m.id === selectedModel)
    if (!modelToUse || modelToUse.id === 'placeholder') {
      const availableModels = models.filter(m => m.id !== 'placeholder')
      if (availableModels.length > 0) {
        modelToUse = availableModels[0]
        setSelectedModel(modelToUse.id)
      } else {
        setServerError('模型目录中没有找到可用模型，请先添加 .gguf 模型文件然后点击刷新')
        return
      }
    }

    setLlamaServiceStatus('starting')
    setServerError('')

    try {
      const companionConfig = getModelCompanionConfig(modelToUse.id)
      const isMultimodal = getModelType(modelToUse.id, modelToUse.detailedInfo) === 'multimodal'
      const mmprojPath = isMultimodal && companionConfig.image_video.length > 0 ? companionConfig.image_video[0].file_path : undefined
      const audioInputPath = isMultimodal && companionConfig.audio_input.length > 0 ? companionConfig.audio_input[0].file_path : undefined
      const modelVocoder = isMultimodal && companionConfig.audio_output.length > 0 ? companionConfig.audio_output[0].file_path : undefined

      const llamaConfig = {
        model_path: modelToUse.provider,
        port: config.port,
        host: config.host,
        n_gpu_layers: config.n_gpu_layers,
        n_ctx: config.n_ctx,
        threads: config.threads,
        batch_size: config.batch_size,
        api_key: apiKey || undefined,
        mtp_tokens: config.mtp_tokens,
        mmproj_path: mmprojPath,
        audio_input_path: audioInputPath,
        model_vocoder: modelVocoder,
      }

      const status: ServerStatus = await invoke('llama_cpp_start', { config: llamaConfig })

      if (status.running) {
        setLlamaServiceStatus('running')
        setServerConnected(true)
        setServerError('')
        handleSyncModelsFromStart()
      } else {
        setLlamaServiceStatus('stopped')
        setServerError('启动失败：服务未运行')
      }
    } catch (e) {
      setLlamaServiceStatus('stopped')
      setServerError(`启动失败: ${e}`)
    }
  }

  const handleStopServer = async () => {
    try {
      await invoke('llama_cpp_stop')
      setLlamaServiceStatus('stopped')
      setServerConnected(false)
    } catch (e) {
      setLlamaServiceStatus('stopped')
      setServerConnected(false)
      setServerError(`停止失败: ${e}`)
    }
  }

  const syncAllModelsToProviders = useCallback((modelList?: Model[]) => {
    const allModels = (modelList || models).filter(m => m.id !== 'placeholder')
    if (allModels.length === 0) return

    const modelDefs = allModels.map(m => {
      const companion = companionConfigs[m.id] || {
        image_video: m.detailedInfo?.auto_matched_mmproj || [],
        audio_input: [],
        audio_output: [],
      }
      const modelType = modelTypes[m.id] || m.detailedInfo?.model_type || 'text'
      const isMultimodal = modelType === 'multimodal'
      return {
        id: m.id,
        name: m.name,
        providerId: 'local-llama',
        type: 'local' as const,
        filePath: m.provider,
        mmprojPath: isMultimodal && companion.image_video.length > 0 ? companion.image_video[0].file_path : undefined,
        audioInputPath: isMultimodal && companion.audio_input.length > 0 ? companion.audio_input[0].file_path : undefined,
        modelVocoder: isMultimodal && companion.audio_output.length > 0 ? companion.audio_output[0].file_path : undefined,
      }
    })

    if (llamaServiceStatus === 'running' && selectedModel) {
      const currentModel = (modelList || models).find(m => m.id === selectedModel)
      if (currentModel && !modelDefs.find(m => m.id === currentModel.id)) {
        const companion = companionConfigs[currentModel.id] || {
          image_video: currentModel.detailedInfo?.auto_matched_mmproj || [],
          audio_input: [],
          audio_output: [],
        }
        const modelType = modelTypes[currentModel.id] || currentModel.detailedInfo?.model_type || 'text'
        const isMultimodal = modelType === 'multimodal'
        modelDefs.push({
          id: currentModel.id,
          name: currentModel.name,
          providerId: 'local-llama',
          type: 'local' as const,
          filePath: currentModel.provider,
          mmprojPath: isMultimodal && companion.image_video.length > 0 ? companion.image_video[0].file_path : undefined,
          audioInputPath: isMultimodal && companion.audio_input.length > 0 ? companion.audio_input[0].file_path : undefined,
          modelVocoder: isMultimodal && companion.audio_output.length > 0 ? companion.audio_output[0].file_path : undefined,
        })
      }
    }

    const existingLocal = providers.filter(p => p.type === 'local' && p.id !== 'local-llama')
    const localProvider = createLocalProvider({
      id: 'local-llama',
      name: '本地模型 (llama.cpp)',
      baseUrl: serverUrl,
      apiKey: apiKey,
      models: modelDefs,
    })

    setProviders([...providers.filter(p => p.type !== 'local'), localProvider, ...existingLocal])
  }, [models, llamaServiceStatus, selectedModel, serverUrl, apiKey, providers, setProviders, companionConfigs, modelTypes])

  const handleSyncModels = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const position = {
      top: rect.bottom + 8,
      left: rect.left
    }

    setSyncing(true)
    try {
      syncAllModelsToProviders()
      setNotification({ type: 'success', message: '已成功同步到模型列表，可以使用', position })
    } catch (error) {
      setNotification({ type: 'error', message: `同步到模型列表失败（${error instanceof Error ? error.message : '未知错误'}）`, position })
    } finally {
      setTimeout(() => { setSyncing(false) }, 1000)
      setTimeout(() => { setNotification(null) }, 3000)
    }
  }

  const handleSyncModelsFromStart = useCallback(() => {
    syncAllModelsToProviders()
  }, [syncAllModelsToProviders])

  const handleSaveSettings = () => {
    setSaving(true)
    saveLocalModelConfig(config)
    setTimeout(() => {
      setSaving(false)
      setSaveSuccess(true)
      setSaveMessage('保存成功')
      setTimeout(() => { setSaveMessage(''); setSaveSuccess(false) }, 3000)
    }, 500)
  }

  const handleToggleModel = (id: string) => {
    let isCurrentlyActive = false
    setModels(prev => {
      const target = prev.find(m => m.id === id)
      if (!target) return prev
      isCurrentlyActive = target.status === 'active'
      return prev.map(m => {
        if (m.id === id) {
          return { ...m, status: isCurrentlyActive ? 'available' as const : 'active' as const }
        }
        return isCurrentlyActive ? m : { ...m, status: m.status === 'active' ? 'available' as const : m.status }
      })
    })
    if (isCurrentlyActive) {
      if (selectedModel === id) setSelectedModel('')
    } else {
      handleLoadModel(id)
    }
  }

  const handleDeleteModel = (id: string) => {
    setModels(prev => prev.filter(m => m.id !== id))
    if (selectedModel === id) {
      setSelectedModel('')
    }
    setCompanionConfigs(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleLoadModel = async (modelId: string) => {
    setModels(prev => prev.map(m => ({
      ...m,
      status: m.id === modelId ? 'active' as const : m.status === 'active' ? 'available' as const : m.status,
    })))
    setSelectedModel(modelId)
    setActiveModelId(modelId, 'local-llama')
    try { localStorage.setItem(LOCAL_SELECTED_MODEL_KEY, modelId) } catch {}
    if (llamaServiceStatus === 'running') {
      hotSwitchCounter.current += 1
      await doHotSwitch(modelId)
      return
    }
  }

  const handleAutoMatchMultimodal = async () => {
    if (!modelPath) return
    try {
      const detailedList: DetailedModelInfo[] = await invoke('llama_cpp_scan_detailed_models', { dirPath: modelPath })
      const newConfigs = { ...companionConfigs }
      for (const detail of detailedList) {
        const modelId = `local-${detail.name}`
        if (detail.auto_matched_mmproj.length > 0 || detail.auto_matched_audio_input.length > 0 || detail.auto_matched_audio_output.length > 0) {
          if (!newConfigs[modelId]) {
            newConfigs[modelId] = { image_video: [], audio_input: [], audio_output: [] }
          }
          for (const mmproj of detail.auto_matched_mmproj) {
            const exists = newConfigs[modelId].image_video.some(f => f.file_path === mmproj.file_path)
            if (!exists) {
              newConfigs[modelId].image_video.push(mmproj)
            }
          }
          for (const audioIn of detail.auto_matched_audio_input) {
            const exists = newConfigs[modelId].audio_input.some(f => f.file_path === audioIn.file_path)
            if (!exists) {
              newConfigs[modelId].audio_input.push(audioIn)
            }
          }
          for (const audioOut of detail.auto_matched_audio_output) {
            const exists = newConfigs[modelId].audio_output.some(f => f.file_path === audioOut.file_path)
            if (!exists) {
              newConfigs[modelId].audio_output.push(audioOut)
            }
          }
        }
      }
      setCompanionConfigs(newConfigs)
      setModels(prev => prev.map(m => {
        const detail = detailedList.find(d => `local-${d.name}` === m.id)
        if (detail) {
          return { ...m, detailedInfo: detail }
        }
        return m
      }))
      setNotification({
        type: 'success',
        message: '多模态自动匹配完成',
        position: { top: 100, left: window.innerWidth / 2 - 100 }
      })
      setTimeout(() => setNotification(null), 3000)
    } catch (e) {
      setNotification({
        type: 'error',
        message: `自动匹配失败: ${e}`,
        position: { top: 100, left: window.innerWidth / 2 - 100 }
      })
      setTimeout(() => setNotification(null), 3000)
    }
  }

  const handleToggleMultimodal = (modelId: string) => {
    const currentType = getModelType(modelId, models.find(m => m.id === modelId)?.detailedInfo)
    const newType = currentType === 'multimodal' ? 'text' : 'multimodal'
    setModelTypes(prev => ({ ...prev, [modelId]: newType }))
    if (newType === 'multimodal' && !companionConfigs[modelId]) {
      setCompanionConfigs(prev => ({
        ...prev,
        [modelId]: { image_video: [], audio_input: [], audio_output: [] }
      }))
    }

    if (llamaServiceStatus === 'running' && selectedModel === modelId) {
      hotSwitchCounter.current += 1
      const model = models.find(m => m.id === modelId)
      if (model?.provider) {
        const companionConfig = getModelCompanionConfig(modelId)
        const mmprojPath = newType === 'multimodal' && companionConfig.image_video.length > 0
          ? companionConfig.image_video[0].file_path
          : undefined
        const audioInputPath = newType === 'multimodal' && companionConfig.audio_input.length > 0
          ? companionConfig.audio_input[0].file_path
          : undefined
        const modelVocoder = newType === 'multimodal' && companionConfig.audio_output.length > 0
          ? companionConfig.audio_output[0].file_path
          : undefined
        setLlamaServiceStatus('switching')
        invoke('llama_cpp_switch_model', {
          config: {
            model_path: model.provider,
            port: config.port,
            host: config.host,
            n_gpu_layers: config.n_gpu_layers,
            n_ctx: config.n_ctx,
            threads: config.threads,
            batch_size: config.batch_size,
            api_key: apiKey || undefined,
            mtp_tokens: config.mtp_tokens,
            mmproj_path: mmprojPath,
            audio_input_path: audioInputPath,
            model_vocoder: modelVocoder,
          }
        }).then(() => {
          setLlamaServiceStatus('running')
        }).catch(() => {
          setLlamaServiceStatus('stopped')
        })
      }
    }
  }

  const handleOpenCompanionModal = (modelId: string) => {
    const config = getModelCompanionConfig(modelId)
    setCompanionEdits({ ...config })
    setShowCompanionModal(modelId)
  }

  const handleSaveCompanionConfig = () => {
    if (!showCompanionModal) return
    setCompanionConfigs(prev => ({
      ...prev,
      [showCompanionModal]: { ...companionEdits }
    }))
    setShowCompanionModal(null)
    setEditingCategory(null)
    setEditingIndex(null)
  }

  const handleAddCompanionFile = async (category: string) => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        multiple: false,
        title: '选择配套模型文件',
        filters: [{ name: '模型文件', extensions: ['gguf', 'mmproj', 'bin', 'ggml'] }]
      })
      if (selected && typeof selected === 'string') {
        const fileName = selected.split(/[/\\]/).pop() || selected
        const newFile: CompanionFile = {
          category,
          file_name: fileName,
          file_path: selected,
          file_size: 0,
        }
        setCompanionEdits(prev => ({
          ...prev,
          [category]: [...(prev as any)[category], newFile],
        }))
      }
    } catch {
      const path = prompt('请输入配套文件完整路径:')
      if (path) {
        const fileName = path.split(/[/\\]/).pop() || path
        const newFile: CompanionFile = {
          category,
          file_name: fileName,
          file_path: path,
          file_size: 0,
        }
        setCompanionEdits(prev => ({
          ...prev,
          [category]: [...(prev as any)[category], newFile],
        }))
      }
    }
  }

  const handleEditCompanionFile = (category: string, index: number) => {
    setEditingCategory(category)
    setEditingIndex(index)
    const file = (companionEdits as any)[category]?.[index]
    setEditPathValue(file?.file_path || '')
  }

  const handleSaveEditPath = () => {
    if (editingCategory === null || editingIndex === null) return
    setCompanionEdits(prev => {
      const newCat = [...(prev as any)[editingCategory]]
      if (newCat[editingIndex]) {
        const fileName = editPathValue.split(/[/\\]/).pop() || editPathValue
        newCat[editingIndex] = {
          ...newCat[editingIndex],
          file_path: editPathValue,
          file_name: fileName,
        }
      }
      return { ...prev, [editingCategory]: newCat }
    })
    setEditingCategory(null)
    setEditingIndex(null)
    setEditPathValue('')
  }

  const handleDeleteCompanionFile = (category: string, index: number) => {
    setCompanionEdits(prev => ({
      ...prev,
      [category]: (prev as any)[category].filter((_: any, i: number) => i !== index),
    }))
  }

  const getStatusBadge = (status: Model['status']) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" />已启用</span>
      case 'available':
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">可用</span>
    }
  }

  const getModelTypeLabel = (modelId: string, detailedInfo?: DetailedModelInfo): string => {
    const type = getModelType(modelId, detailedInfo)
    return type === 'multimodal' ? '多模态模型' : '文本模型'
  }

  const getCompanionSummary = (modelId: string): string => {
    const config = getModelCompanionConfig(modelId)
    const parts: string[] = []
    if (config.image_video.length > 0) parts.push(`图像:${config.image_video.map(f => f.file_name).join(',')}`)
    if (config.audio_input.length > 0) parts.push(`语音输入:${config.audio_input.map(f => f.file_name).join(',')}`)
    if (config.audio_output.length > 0) parts.push(`语音输出:${config.audio_output.map(f => f.file_name).join(',')}`)
    return parts.length > 0 ? parts.join('; ') : '无配套模型'
  }

  const hasAnyCompanion = (modelId: string): boolean => {
    const config = getModelCompanionConfig(modelId)
    return config.image_video.length > 0 || config.audio_input.length > 0 || config.audio_output.length > 0
  }

  const filteredModels = models.filter(m => {
    if (m.id === 'placeholder') return true
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return m.name.toLowerCase().includes(q) ||
      (m.detailedInfo?.base_name || '').toLowerCase().includes(q)
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">本地服务状态</h2>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              llamaServiceStatus === 'running'
                ? 'bg-green-100 text-green-700'
                : llamaServiceStatus === 'switching'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
            }`}>
              {llamaServiceStatus === 'running' ? '运行中' : llamaServiceStatus === 'switching' ? '切换中' : '已停止'}
            </span>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm min-w-[100px] justify-center ${
                saving
                  ? 'bg-blue-300 text-white cursor-not-allowed'
                  : saveSuccess
                    ? 'bg-green-500 text-white'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {saving ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" />保存中...</>
              ) : saveMessage ? (
                <><Check className="w-3.5 h-3.5" />{saveMessage}</>
              ) : (
                <><Save className="w-3.5 h-3.5" />保存</>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Server className="w-4 h-4" />
              本地模型服务
            </h3>
            <p className="text-xs text-gray-500 mb-4">使用 llama.cpp 在本地运行大语言模型</p>
            <button
              onClick={llamaServiceStatus === 'running' ? handleStopServer : handleStartServer}
              disabled={llamaServiceStatus === 'starting' || llamaServiceStatus === 'switching'}
              className={`w-full py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                llamaServiceStatus === 'running'
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : llamaServiceStatus === 'starting'
                    ? 'bg-blue-400 text-white cursor-wait'
                    : llamaServiceStatus === 'switching'
                      ? 'bg-yellow-500 text-white cursor-wait'
                      : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              <Play className="w-4 h-4" />
              {llamaServiceStatus === 'running' ? '停止服务' : llamaServiceStatus === 'starting' ? '启动中...' : llamaServiceStatus === 'switching' ? '切换模型中...' : '启动服务'}
            </button>
            {selectedModel && (
              <p className="text-xs text-gray-500 mt-2">
                当前选择: {models.find(m => m.id === selectedModel)?.name || '无'}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Server className="w-4 h-4" />
                服务地址
              </label>
              <button
                onClick={handleCheckHealth}
                disabled={serverChecking}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  serverConnected
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {serverChecking ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <span className={`w-1.5 h-1.5 rounded-full ${serverConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
                )}
                {serverChecking ? '检查中...' : serverConnected ? '已连接' : '测试连接'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={serverUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none"
              />
              <button 
                className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" 
                onClick={() => navigator.clipboard.writeText(serverUrl)}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">API 端点: {serverUrl}/v1/chat/completions</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Key className="w-4 h-4" />
              API Key
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey || ''}
                  readOnly
                  placeholder="点击生成按钮创建 API Key"
                  className="w-full px-3 py-2 pr-8 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none"
                />
                {apiKey && (
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title={showApiKey ? '隐藏' : '显示'}
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
              <button
                className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm flex items-center gap-1 whitespace-nowrap"
                onClick={handleGenerateApiKey}
              >
                <RefreshCw className="w-4 h-4" />
                生成
              </button>
              <button
                className={`p-2 rounded-lg transition-colors ${
                  apiKey
                    ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
                onClick={apiKey ? handleCopyApiKey : undefined}
                title="复制 API Key"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">调用本地服务时需要使用此 API Key</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              模型目录
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={modelPath || '选择模型存放目录...'}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none"
              />
              <button
                onClick={handleBrowseModelDir}
                className="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm">
                浏览
              </button>
            </div>
          </div>

          {llamaServiceStatus === 'switching' ? (
            <p className="text-xs text-yellow-500 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              正在切换模型，请稍候...
            </p>
          ) : llamaServiceStatus === 'running' && serverConnected ? (
            <p className="text-xs text-green-500 flex items-center gap-1">
              <Check className="w-3 h-3" />
              服务已启动，请在模型列表选择加载模型
            </p>
          ) : llamaServiceStatus === 'running' && !serverConnected ? (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              无法连接到 llama.cpp 服务（{serverError || '连接失败'}）
            </p>
          ) : serverError ? (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {serverError}
            </p>
          ) : llamaServiceStatus === 'stopped' ? (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              服务未启用，请先启动服务再选择加载模型
            </p>
          ) : null}

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">推理设置</h3>
              <button
                onClick={handleResetToDefault}
                className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              >
                恢复默认
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">推理设备</span>
                </div>
                <select
                  value={config.device}
                  onChange={(e) => setConfig({ ...config, device: e.target.value as 'auto' | 'cpu' | 'gpu' })}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="auto">Auto</option>
                  <option value="cpu">CPU</option>
                  <option value="gpu">GPU</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">量化类型</span>
                </div>
                <select
                  value={config.quantization}
                  onChange={(e) => setConfig({ ...config, quantization: e.target.value as 'auto' | 'q4_0' | 'q4_1' | 'q5_0' | 'q5_1' | 'q8_0' | 'f16' })}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="auto">Auto</option>
                  <option value="q4_0">Q4_0</option>
                  <option value="q4_1">Q4_1</option>
                  <option value="q5_0">Q5_0</option>
                  <option value="q5_1">Q5_1</option>
                  <option value="q8_0">Q8_0</option>
                  <option value="f16">F16</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">GPU内存限制</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.gpu_memory_limit}
                    onChange={(e) => setConfig({ ...config, gpu_memory_limit: Number(e.target.value) })}
                    min={1}
                    className="w-20 px-2 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">GB</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">端口</span>
                </div>
                <input
                  type="number"
                  value={config.port}
                  onChange={(e) => setConfig({ ...config, port: Number(e.target.value) })}
                  className="w-20 px-2 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">GPU 层数 (-1=全部)</span>
                </div>
                <input
                  type="number"
                  value={config.n_gpu_layers}
                  onChange={(e) => setConfig({ ...config, n_gpu_layers: Number(e.target.value) })}
                  className="w-20 px-2 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">上下文长度</span>
                </div>
                <select
                  value={config.n_ctx}
                  onChange={(e) => setConfig({ ...config, n_ctx: Number(e.target.value) })}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={2048}>2048</option>
                  <option value={4096}>4096</option>
                  <option value={8192}>8192</option>
                  <option value={16384}>16384</option>
                  <option value={32768}>32768</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">线程数</span>
                </div>
                <input
                  type="number"
                  value={config.threads}
                  onChange={(e) => setConfig({ ...config, threads: Number(e.target.value) })}
                  min={1}
                  max={16}
                  className="w-16 px-2 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">批处理大小</span>
                </div>
                <select
                  value={config.batch_size}
                  onChange={(e) => setConfig({ ...config, batch_size: Number(e.target.value) })}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={128}>128</option>
                  <option value={256}>256</option>
                  <option value={512}>512</option>
                  <option value={1024}>1024</option>
                  <option value={2048}>2048</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">MTP 加速</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={config.mtp_tokens}
                    onChange={(e) => setConfig({ ...config, mtp_tokens: Math.max(0, Math.min(8, Number(e.target.value))) })}
                    min={0}
                    max={8}
                    className="w-16 px-2 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-500">tokens</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-2">MTP (Multi-Token Prediction)：llama-server 会自动检测 MTP 模型。<br/>此项保留供后续 CUDA 版本使用，当前 Vulkan 版本暂不通过 CLI 控制</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">本地模型管理</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshModels}
              disabled={refreshing}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              刷新
            </button>
            <button
              onClick={handleSyncModels}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
                syncing ? 'bg-green-500 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}>
              <Power className="w-4 h-4" />
              同步到列表
            </button>
            <button
              onClick={handleDownloadModel}
              className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1">
              <Download className="w-4 h-4" />
              下载模型
            </button>
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索模型..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button
            onClick={() => {
              setModels(prev => prev.map(m => m.id !== 'placeholder' ? { ...m, status: 'available' as const } : m))
              setSelectedModel('')
            }}
            className="px-3 py-1.5 bg-red-100 text-red-700 text-xs rounded-lg hover:bg-red-200 transition-colors flex items-center gap-1"
          >
            全部停用
          </button>
          <button
            onClick={handleAutoMatchMultimodal}
            className="px-3 py-1.5 bg-purple-100 text-purple-700 text-xs rounded-lg hover:bg-purple-200 transition-colors flex items-center gap-1"
          >
            <FileSearch className="w-3.5 h-3.5" />
            多模态自动匹配
          </button>
          <div className="relative">
            <button
              ref={formatBtnRef}
              onClick={() => setShowFormatModal(!showFormatModal)}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
            >
              <Info className="w-3.5 h-3.5" />
              格式
            </button>
            {showFormatModal && (
              <div
                ref={formatModalRef}
                className="absolute left-0 top-full mt-1 w-[520px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 p-4 max-h-[80vh] overflow-y-auto"
              >
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">多模态自动匹配文件格式</h4>
                <div className="space-y-3 text-xs text-gray-700 dark:text-gray-300">
                  <div>
                    <p className="font-medium text-blue-600 dark:text-blue-400">一、主模型文件名格式：</p>
                    <p className="mt-1"><strong>【主体部分】+【量化参数部分】+【.后缀名】</strong></p>
                    <p className="text-gray-500 mt-0.5">主体部分包括：模型品牌型号-版本-参数量</p>
                    <p className="text-gray-500">量化参数部分包括：量化规格大小、精度等参数</p>
                    <p className="mt-1 text-gray-600">示例解析：<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Qwen3.6-27B-UD-Q4_K_XL.gguf</code></p>
                    <p className="text-gray-500 ml-2">→ 主体部分：<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Qwen3.6-27B</code></p>
                    <p className="text-gray-500 ml-2">→ 量化参数部分：<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">UD-Q4_K_XL</code></p>
                    <p className="text-gray-500 ml-2">→ 后缀名：<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.gguf</code></p>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                    <p className="font-medium text-green-600 dark:text-green-400">二、量化参数识别规则（从右向左扫描 - 分隔的段落）：</p>
                    <p className="text-gray-500 mt-0.5">以下任一段落匹配即判定为量化参数段：</p>
                    <div className="ml-2 mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                      <span><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">IQ1_S, IQ2_XXS, IQ2_XS, IQ3_XXS, IQ3_S, IQ4_XS, IQ4_NL</code> 等</span>
                      <span><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Q2_K, Q2_K_L, Q2_K_XL</code> 等</span>
                      <span><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Q3_K_S, Q3_K_M, Q3_K_L, Q3_K_XL</code> 等</span>
                      <span><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Q4_K_S, Q4_K_M, Q4_K_XL</code> 等</span>
                      <span><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Q5_K_S, Q5_K_M, Q5_K_XL</code> 等</span>
                      <span><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Q6_K, Q6_K_L, Q6_K_XL</code> 等</span>
                      <span><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Q8_0, Q8_0_L, Q8_0_XL</code> 等</span>
                      <span><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">UD-IQ4_XS, UD-Q4_K_XL</code> 等</span>
                      <span><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">F16, F32</code> (全精度)</span>
                      <span><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">B16, B32</code> 等</span>
                    </div>
                    <p className="text-gray-500 mt-1">分段示例：<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Qwen3.6-27B-UD-Q4_K_XL.gguf</code></p>
                    <p className="text-gray-400 ml-2">段落1: Qwen3.6（❌ 非量化段） → 段落2: 27B（❌ 非量化段） → 段落3: UD-Q4_K_XL（✅ 量化段）</p>
                    <p className="text-gray-400 ml-2">段落4: Q4_K_XL（✅ 量化段，取第一个匹配位分割）</p>
                    <p className="text-gray-500">解析结果：主体=<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Qwen3.6-27B</code>，量化=<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">UD-Q4_K_XL</code></p>
                    <p className="text-gray-500">另一个示例：<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">DeepSeek-14B-IQ4_XS.gguf</code> → 主体=<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">DeepSeek-14B</code>，量化=<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">IQ4_XS</code></p>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                    <p className="font-medium text-purple-600 dark:text-purple-400">三、投影文件名格式：</p>
                    <p className="mt-1"><strong>【mmproj-】+【主模型文件名主体部分】+【.后缀名】</strong></p>
                    <p className="text-gray-500 mt-0.5">支持两种格式：</p>
                    <p className="text-gray-500 ml-2">① <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">mmproj-{'{主体部分}'}.gguf</code>（推荐）</p>
                    <p className="text-gray-500 ml-2">② <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{主体部分}'}.mmproj</code></p>
                    <p className="mt-1 text-gray-600">标准示例：主模型 <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Qwen3.6-27B-UD-Q4_K_XL.gguf</code></p>
                    <p className="text-gray-500 ml-2">→ 投影文件名：<code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">mmproj-Qwen3.6-27B.gguf</code></p>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                    <p className="font-medium text-orange-600 dark:text-orange-400">四、自动匹配规则：</p>
                    <p className="text-gray-500 mt-0.5">扫描同目录下所有文件，提取主体名后按以下规则匹配：</p>
                    <p className="text-gray-500 ml-2 mt-0.5">1. 文件名以 <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">mmproj-</code> 开头且扩展名为 <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.gguf</code> 或 <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.ggml</code></p>
                    <p className="text-gray-500 ml-2">2. 去除 <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">mmproj-</code> 前缀后的名称与主模型主体名匹配（相等/包含关系）</p>
                    <p className="text-gray-500 ml-2">3. 扩展名为 <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.mmproj</code> 的文件，取文件名的stem部分与主体名匹配</p>
                    <p className="text-gray-500 mt-0.5">匹配判定：配套名 == 主体名 或 配套名以主体名开头 或 主体名以配套名开头</p>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                    <p className="font-medium text-teal-600 dark:text-teal-400">五、匹配示例：</p>
                    <div className="ml-2 mt-1 space-y-1">
                      <p className="text-gray-500">✅ <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Qwen3.6-27B-UD-Q4_K_XL.gguf</code> + <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">mmproj-Qwen3.6-27B.gguf</code>（精确匹配）</p>
                      <p className="text-gray-500">✅ <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">DeepSeek-14B-IQ4_XS.gguf</code> + <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">DeepSeek-14B.mmproj</code>（.mmproj 格式）</p>
                      <p className="text-gray-500">✅ <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Qwen3.6-27B-IQ4_XS.gguf</code> + <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">mmproj-Qwen3.6-27B.gguf</code>（同主体不同量化共享投影）</p>
                      <p className="text-gray-400">❌ <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Qwen3.6-27B-UD-Q4_K_XL.gguf</code> + <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">mmproj-Qwen2.5-7B.gguf</code>（主体名不匹配）</p>
                    </div>
                    <p className="text-gray-500 mt-1">同主体名的不同量化参数版本可以共同使用一个投影文件。</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFormatModal(false)}
                  className="mt-3 w-full px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors sticky bottom-0"
                >
                  关闭
                </button>
              </div>
            )}
          </div>
          <div className="flex-1"></div>
          <button
            onClick={handleCheckHealth}
            disabled={serverChecking}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 ${
              serverConnected
                ? 'bg-green-100 text-green-700'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${serverChecking ? 'animate-spin' : ''}`} />
            连通测试
          </button>
        </div>

        <div className="mb-2 px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
          <span className="w-[36%]">模型名称</span>
          <span className="w-[11%]">模型类别</span>
          <span className="w-[9%]">多模态</span>
          <span className="w-[26%]">配套详情</span>
          <span className="w-[18%] text-right">状态/操作</span>
        </div>

        <div className="space-y-1.5 max-h-[650px] overflow-y-auto custom-scrollbar">
          {filteredModels.map((model) => {
            if (model.id === 'placeholder') {
              return (
                <div key="placeholder" className="px-3 py-4 text-xs text-gray-400 text-center">
                  {model.name}
                </div>
              )
            }
            const isMultimodal = getIsMultimodal(model.id, model.detailedInfo)
            const modelType = getModelType(model.id, model.detailedInfo)
            const companionSummary = getCompanionSummary(model.id)
            const hasCompanion = hasAnyCompanion(model.id)

            return (
              <div
                key={model.id}
                className={`flex items-start gap-2 px-3 py-2.5 rounded-lg transition-colors ${
                  selectedModel === model.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <div className="w-[36%] min-w-0 cursor-pointer" onClick={() => handleLoadModel(model.id)}>
                  <div className="flex items-start gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${selectedModel === model.id ? 'bg-blue-500' : 'bg-green-500'}`} />
                    <span className={`text-xs font-medium break-all leading-relaxed ${selectedModel === model.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`} title={model.name}>
                      {model.name}
                    </span>
                  </div>
                  {model.size && (
                    <span className="text-[10px] text-gray-400 ml-3.5">{formatFileSize(model.size)}</span>
                  )}
                </div>

                <div className="w-[11%] pt-0.5">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                    modelType === 'multimodal'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                  }`}>
                    {getModelTypeLabel(model.id, model.detailedInfo)}
                  </span>
                </div>

                <div className="w-[9%] flex justify-center pt-0.5">
                  <button
                    onClick={() => handleToggleMultimodal(model.id)}
                    className={`w-8 h-4 rounded-full transition-colors relative ${
                      isMultimodal ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    title="点击切换 是/否"
                  >
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                      isMultimodal ? 'right-0.5' : 'left-0.5'
                    }`} />
                  </button>
                  <span className="text-[10px] text-gray-400 ml-1">{isMultimodal ? '是' : '否'}</span>
                </div>

                <div className="w-[26%] min-w-0 pt-0.5">
                  <button
                    onClick={() => handleOpenCompanionModal(model.id)}
                    className="flex items-start gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    title="查看/编辑配套模型详情"
                  >
                    <FileSearch className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span className="break-all leading-relaxed">{hasCompanion ? '查看详情' : '无配套模型'}</span>
                  </button>
                  {hasCompanion && (
                    <p className="text-[10px] text-gray-400 break-all leading-relaxed mt-0.5" title={companionSummary}>
                      {companionSummary}
                    </p>
                  )}
                </div>

                <div className="w-[18%] flex items-center justify-end gap-1 pt-0.5">
                  {getStatusBadge(model.status)}
                  {model.id !== 'placeholder' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleModel(model.id) }}
                      className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                        model.status === 'active'
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {model.status === 'active' ? '停用' : '启用'}
                    </button>
                  )}
                  {model.id !== 'placeholder' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteModel(model.id) }}
                      className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded hover:bg-red-100 hover:text-red-600 transition-colors"
                      title="删除模型"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {models.length > 0 && models[0].id !== 'placeholder' && (
          <div className="mt-3 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-relaxed">
              <strong>提示：</strong>点击模型名称加载模型，点击"查看详情"管理多模态配套文件（图像/视频理解、语音输入、语音输出）。启动服务时自动加载已配置的投影文件。
            </p>
          </div>
        )}
      </div>

      {showCompanionModal && (() => {
        const model = models.find(m => m.id === showCompanionModal)
        const modelName = model?.name || showCompanionModal
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowCompanionModal(null); setEditingCategory(null); setEditingIndex(null) }}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[600px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">多模态配套模型详情</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">{modelName}</p>
                </div>
                <button onClick={() => { setShowCompanionModal(null); setEditingCategory(null); setEditingIndex(null) }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {[
                  { key: 'image_video', label: '图像 / 视频理解（多模态）', icon: Image, color: 'text-blue-600' },
                  { key: 'audio_input', label: '语音输入（音频）', icon: Mic, color: 'text-green-600' },
                  { key: 'audio_output', label: '语音输出（TTS）', icon: Volume2, color: 'text-orange-600' },
                ].map((cat) => {
                  const Icon = cat.icon
                  const files = (companionEdits as any)[cat.key] || []
                  return (
                    <div key={cat.key} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className={`text-xs font-semibold flex items-center gap-1.5 ${cat.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {cat.label}
                        </h4>
                        <button
                          onClick={() => handleAddCompanionFile(cat.key)}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          添加
                        </button>
                      </div>
                      {files.length === 0 ? (
                        <p className="text-[11px] text-gray-400 italic">暂未配置配套文件</p>
                      ) : (
                        <div className="space-y-1.5">
                          {files.map((file: CompanionFile, idx: number) => (
                            <div key={idx} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-1.5">
                              {editingCategory === cat.key && editingIndex === idx ? (
                                <div className="flex-1 flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editPathValue}
                                    onChange={(e) => setEditPathValue(e.target.value)}
                                    className="flex-1 px-2 py-1 text-[11px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="输入完整文件路径..."
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEditPath()
                                      if (e.key === 'Escape') { setEditingCategory(null); setEditingIndex(null) }
                                    }}
                                  />
                                  <button onClick={handleSaveEditPath} className="p-1 text-green-600 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => { setEditingCategory(null); setEditingIndex(null) }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-[11px] text-gray-700 dark:text-gray-300 truncate flex-1" title={file.file_path}>
                                    {file.file_name}
                                  </span>
                                  <div className="flex items-center gap-1 ml-2">
                                    <button
                                      onClick={() => handleEditCompanionFile(cat.key, idx)}
                                      className="p-0.5 text-gray-400 hover:text-blue-500 transition-colors"
                                      title="编辑路径"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCompanionFile(cat.key, idx)}
                                      className="p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                                      title="删除"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleSaveCompanionConfig}
                  className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Save className="w-4 h-4 inline mr-1" />
                  保存
                </button>
                <button
                  onClick={() => { setShowCompanionModal(null); setEditingCategory(null); setEditingIndex(null) }}
                  className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {notification && (
        <div 
          className="fixed z-50 pointer-events-none"
          style={{ 
            top: notification.position.top, 
            left: notification.position.left,
            transform: 'translateY(0)'
          }}
        >
          <div className={`px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 pointer-events-auto animate-fade-in ${
            notification.type === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            {notification.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {notification.message}
          </div>
        </div>
      )}
    </div>
  )
}