import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { createPortal } from 'react-dom'
import { useTheme } from '../contexts/ThemeContext'
import { useChat } from '../contexts/ChatContext'
import {
  loadLocalModelPath,
  saveLocalModelPath,
} from '../api/modelManager'
import { testConnection as proxyTestConnection } from '../api/apiProxy'
import LocalModelSettings from './LocalModelSettings'
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
  Settings2,
  Cloud,
  Bot,
  MessageSquare,
  Brain,
  FileText,
  DollarSign,
  Monitor,
  Globe,
  Power,
  SkipForward,
  Plus,
  Eye,
  Loader2,
  EyeOff,
  Save,
  Database,
  Webhook,
  Edit3,
  Trash2,
  Sliders,
  TrendingUp,
  Calendar,
  Smartphone,
  QrCode,
  CheckCircle,
  AlertCircle,
  History,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  Mic,
  Image,
  Palette,
  GripHorizontal,
  Bug,
  AlertTriangle,
  Clipboard,
  Trash,
  Wifi,
  Star
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Legend, Area, Line } from 'recharts'

type SettingsTab = 'general' | 'cloud' | 'local' | 'im' | 'memory' | 'rules' | 'workspace' | 'agent' | 'cost' | 'computer' | 'diagnostics'

interface Model {
  id: string
  name: string
  status: 'active' | 'disabled' | 'available'
  provider: string
}

interface CloudProvider {
  id: string
  name: string
  icon: string
  color: string
  enabled: boolean
  apiKey: string
  baseUrl: string
  apiFormat: 'anthropic' | 'openai' | 'google'
  codingPlan: boolean
  models: string[]
  systemPrompt?: string
}

const mockCloudProviders: CloudProvider[] = [
  { id: '1', name: 'DeepSeek', icon: 'D', color: '#2563eb', enabled: true, apiKey: '', baseUrl: 'https://api.deepseek.com/v1', apiFormat: 'openai', codingPlan: false, models: ['DeepSeek Chat', 'DeepSeek Coder', 'DeepSeek Reasoner', 'DeepSeek V3', 'DeepSeek R1'] },
  { id: '2', name: '火山引擎', icon: 'V', color: '#06b6d4', enabled: true, apiKey: '', baseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3', apiFormat: 'openai', codingPlan: false, models: ['doubao-seed-2-0-code-250615', 'doubao-seed-2-0-pro-250615', 'doubao-seed-2-0-lite-250615', 'doubao-seed-code-250120', 'kimi-k2.5-250120', 'glm-4-7-250120', 'deepseek-v3.2-250120', 'minimax-m2.5-250120', 'ark-code-latest'] },
  { id: '3', name: 'MiniMax', icon: 'M', color: '#ec4899', enabled: true, apiKey: '', baseUrl: 'https://api.minimaxi.com/v1', apiFormat: 'openai', codingPlan: false, models: ['MiniMax-M2.5', 'MiniMax-M2.7', 'MiniMax-M2.5-highspeed', 'abab6.5s-chat', 'abab6.5t-chat', 'abab6-chat', 'abab5.5-chat', 'minimax-01'] },
  { id: '4', name: '讯飞星辰', icon: 'S', color: '#c026d3', enabled: false, apiKey: '', baseUrl: 'https://maas-coding-api.cn-huabei-1.xf-yun.com/v2', apiFormat: 'openai', codingPlan: false, models: ['astron-code-latest', 'Spark 4.0', 'Spark 3.5', 'Spark 3.0'] },
  { id: '5', name: 'Zhipu', icon: 'Z', color: '#6366f1', enabled: false, apiKey: '', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiFormat: 'openai', codingPlan: false, models: ['GLM-4', 'GLM-4-Plus', 'GLM-4-Flash', 'GLM-4-Air', 'GLM-4-AirX', 'GLM-4-Long', 'GLM-3-Turbo'] },
  { id: '6', name: 'Qwen', icon: 'Q', color: '#a855f7', enabled: true, apiKey: '', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiFormat: 'openai', codingPlan: false, models: ['Qwen-Max', 'Qwen-Plus', 'Qwen-Turbo', 'Qwen-Coder-Plus', 'Qwen-VL-Plus', 'Qwen-Max-LongContext'] },
  { id: '7', name: 'Moonshot（月之暗面kimi）', icon: 'K', color: '#eab308', enabled: false, apiKey: '', baseUrl: 'https://api.moonshot.cn/v1', apiFormat: 'openai', codingPlan: false, models: ['kimi-k2.6', 'Moonshot-v1-8k', 'Moonshot-v1-32k', 'Moonshot-v1-128k'] },
  { id: '8', name: 'Xiaomi', icon: 'M', color: '#ff6900', enabled: false, apiKey: '', baseUrl: 'https://api.xiaomi.com/v1', apiFormat: 'openai', codingPlan: false, models: ['MiMo-8B', 'MiMo-72B'] },
  { id: '9', name: 'Baidu/文心千帆', icon: 'B', color: '#2563eb', enabled: false, apiKey: '', baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1', apiFormat: 'openai', codingPlan: false, models: ['ERNIE-4.0', 'ERNIE-3.5', 'ERNIE-Bot-Turbo', 'ERNIE-Bot-8K'] },
  { id: '10', name: '腾讯混元/Tencent HY', icon: 'T', color: '#0052d9', enabled: false, apiKey: '', baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1', apiFormat: 'openai', codingPlan: false, models: ['Hunyuan-Pro', 'Hunyuan-Standard', 'Hunyuan-Lite', 'tc-code-latest'] },
  { id: '11', name: '无问芯穹', icon: 'N', color: '#00b4d8', enabled: false, apiKey: '', baseUrl: 'https://api.infini-ai.com/v1', apiFormat: 'openai', codingPlan: false, models: ['Infini-Megrez', 'Infini-Megrez-8B'] },
  { id: '12', name: 'OpenAI', icon: 'O', color: '#10b981', enabled: false, apiKey: '', baseUrl: 'https://api.openai.com/v1', apiFormat: 'openai', codingPlan: false, models: ['GPT-4o', 'GPT-4o-Mini', 'GPT-4-Turbo', 'GPT-4', 'GPT-3.5-Turbo', 'o1', 'o1-Mini', 'o3-Mini'] },
  { id: '13', name: 'Anthropic', icon: 'A', color: '#f59e0b', enabled: false, apiKey: '', baseUrl: 'https://api.anthropic.com/v1', apiFormat: 'anthropic', codingPlan: false, models: ['Claude Sonnet 4', 'Claude Opus 4', 'Claude Haiku 4', 'Claude 3.5 Sonnet', 'Claude 3.5 Haiku'] },
  { id: '14', name: 'Google', icon: 'G', color: '#3b82f6', enabled: false, apiKey: '', baseUrl: 'https://generativelanguage.googleapis.com/v1', apiFormat: 'google', codingPlan: false, models: ['Gemini 2.5 Pro', 'Gemini 2.5 Flash', 'Gemini 1.5 Pro', 'Gemini 1.5 Flash', 'Gemini Pro'] },
  { id: '15', name: 'Ollama', icon: 'O', color: '#22c55e', enabled: false, apiKey: '', baseUrl: 'http://localhost:11434/v1', apiFormat: 'openai', codingPlan: false, models: ['Llama 3', 'Qwen 2', 'Mistral', 'DeepSeek-R1', 'Phi-3'] },
  { id: '16', name: 'OpenRouter', icon: 'O', color: '#ff6b35', enabled: false, apiKey: '', baseUrl: 'https://openrouter.ai/api/v1', apiFormat: 'openai', codingPlan: false, models: ['Claude 3.5 Sonnet', 'GPT-4o', 'Llama 3', 'DeepSeek V3'] },
  { id: '17', name: 'Mistral AI', icon: 'M', color: '#f97316', enabled: false, apiKey: '', baseUrl: 'https://api.mistral.ai/v1', apiFormat: 'openai', codingPlan: false, models: ['Mistral Large', 'Mistral Small', 'Mistral Medium', 'Mistral Nemo'] },
  { id: '18', name: 'xAI', icon: 'X', color: '#ef4444', enabled: false, apiKey: '', baseUrl: 'https://api.x.ai/v1', apiFormat: 'openai', codingPlan: false, models: ['Grok 2', 'Grok 2 Vision', 'Grok Beta'] },
  { id: '19', name: 'Cohere', icon: 'C', color: '#06b6d4', enabled: false, apiKey: '', baseUrl: 'https://api.cohere.com/v1', apiFormat: 'openai', codingPlan: false, models: ['Command R+', 'Command R', 'Command Light'] },
  { id: '20', name: 'Perplexity', icon: 'P', color: '#8b5cf6', enabled: false, apiKey: '', baseUrl: 'https://api.perplexity.ai', apiFormat: 'openai', codingPlan: false, models: ['Sonar Pro', 'Sonar Reasoning', 'Sonar'] },
  { id: '21', name: 'Meta AI', icon: 'M', color: '#0078ff', enabled: false, apiKey: '', baseUrl: 'https://api.meta.ai/v1', apiFormat: 'openai', codingPlan: false, models: ['Llama 3.1 8B', 'Llama 3.1 70B', 'Llama 3.1 405B'] },
  { id: '22', name: 'Microsoft', icon: 'M', color: '#00a4ef', enabled: false, apiKey: '', baseUrl: 'https://api.microsoft.com/v1', apiFormat: 'openai', codingPlan: false, models: ['Phi-3 Medium', 'Phi-3 Mini', 'Phi-3 Vision'] },
  { id: '23', name: 'NVIDIA', icon: 'N', color: '#76b900', enabled: false, apiKey: '', baseUrl: 'https://integrate.api.nvidia.com/v1', apiFormat: 'openai', codingPlan: false, models: ['Nemotron 70B', 'Nemotron 8B', 'Llama 3 70B'] },
  { id: '24', name: 'IBM', icon: 'I', color: '#006699', enabled: false, apiKey: '', baseUrl: 'https://api.ibm.com/v1', apiFormat: 'openai', codingPlan: false, models: ['Granite 13B', 'Granite 8B'] },
  { id: '25', name: 'AWS Bedrock', icon: 'A', color: '#ff9900', enabled: false, apiKey: '', baseUrl: 'https://bedrock.api.aws/v1', apiFormat: 'openai', codingPlan: false, models: ['Claude 3.5 Sonnet', 'Claude 3 Sonnet', 'Llama 3', 'Mistral Large', 'Titan Text'] },
  { id: '26', name: 'Databricks', icon: 'D', color: '#ef4444', enabled: false, apiKey: '', baseUrl: 'https://api.databricks.com/v1', apiFormat: 'openai', codingPlan: false, models: ['DBRX Instruct', 'DBRX Base', 'Mixtral 8x7B'] },
  { id: '27', name: 'Youdao', icon: 'Y', color: '#e60012', enabled: false, apiKey: '', baseUrl: 'https://open.ai.youdao.com/v1', apiFormat: 'openai', codingPlan: false, models: ['Youdao Pro', 'Youdao Fly'] },
  { id: '28', name: 'StepFun', icon: 'S', color: '#f472b6', enabled: false, apiKey: '', baseUrl: 'https://api.stepfun.com/v1', apiFormat: 'openai', codingPlan: false, models: ['Step-1 Chat', 'Step-1 Vision', 'Step-1.5 Chat', 'Step-2'] },
  { id: '29', name: 'Stability AI', icon: 'S', color: '#9b59b6', enabled: false, apiKey: '', baseUrl: 'https://api.stability.ai/v1', apiFormat: 'openai', codingPlan: false, models: ['Stable Diffusion XL', 'Stable LM 2'] },
  { id: '30', name: 'AI21 Labs', icon: 'A', color: '#21a179', enabled: false, apiKey: '', baseUrl: 'https://api.ai21.com/v1', apiFormat: 'openai', codingPlan: false, models: ['Jamba 1.5', 'Jamba 1.5 Mini', 'Jurassic-2 Ultra'] },
  { id: '31', name: 'Hugging Face', icon: 'H', color: '#f9d045', enabled: false, apiKey: '', baseUrl: 'https://api-inference.huggingface.co/v1', apiFormat: 'openai', codingPlan: false, models: ['Mistral', 'Llama', 'Qwen', 'Gemma', 'Phi'] },
  { id: '32', name: 'Together AI', icon: 'T', color: '#6b48ff', enabled: false, apiKey: '', baseUrl: 'https://api.together.xyz/v1', apiFormat: 'openai', codingPlan: false, models: ['Llama 3 8B', 'Llama 3 70B', 'Mixtral 8x7B', 'Mixtral 8x22B', 'DeepSeek V3'] },
  { id: '33', name: 'Groq', icon: 'G', color: '#f55036', enabled: false, apiKey: '', baseUrl: 'https://api.groq.com/openai/v1', apiFormat: 'openai', codingPlan: false, models: ['Llama 3 8B', 'Llama 3 70B', 'Mixtral 8x7B', 'Gemma 2 9B', 'Gemma 2 27B'] },
  { id: '34', name: 'Nous Research', icon: 'N', color: '#1a1a2e', enabled: false, apiKey: '', baseUrl: 'https://api.nousresearch.com/v1', apiFormat: 'openai', codingPlan: false, models: ['Hermes 3 70B', 'Hermes 3 405B', 'Capybara'] },
  { id: '35', name: 'Novita AI', icon: 'N', color: '#e91e63', enabled: false, apiKey: '', baseUrl: 'https://api.novita.ai/v1', apiFormat: 'openai', codingPlan: false, models: ['Llama 3 8B', 'Llama 3 70B', 'Mistral 7B', 'Qwen 2 72B'] },
  { id: '36', name: 'Azure OpenAI', icon: 'A', color: '#0078d4', enabled: false, apiKey: '', baseUrl: 'https://your-resource.openai.azure.com/v1', apiFormat: 'openai', codingPlan: false, models: ['GPT-4o', 'GPT-4 Turbo', 'GPT-3.5 Turbo', 'o1'] },
]

interface IMBot {
  id: string
  name: string
  enabled: boolean
  webhookUrl: string
  secret: string
  autoReply: boolean
  mentionOnly: boolean
  groupChat: boolean
}

const mockIMBots: IMBot[] = [
  { id: '1', name: '微信', enabled: true, webhookUrl: '', secret: '', autoReply: true, mentionOnly: false, groupChat: true },
  { id: '2', name: '钉钉', enabled: false, webhookUrl: '', secret: '', autoReply: false, mentionOnly: true, groupChat: true },
  { id: '3', name: '飞书', enabled: false, webhookUrl: '', secret: '', autoReply: false, mentionOnly: true, groupChat: true },
  { id: '4', name: '企业微信', enabled: false, webhookUrl: '', secret: '', autoReply: false, mentionOnly: false, groupChat: true },
  { id: '5', name: 'QQ', enabled: true, webhookUrl: '', secret: '', autoReply: true, mentionOnly: false, groupChat: true },
  { id: '6', name: 'Telegram', enabled: false, webhookUrl: '', secret: '', autoReply: false, mentionOnly: false, groupChat: true },
  { id: '7', name: 'WhatsApp', enabled: false, webhookUrl: '', secret: '', autoReply: false, mentionOnly: false, groupChat: true },
  { id: '8', name: '云信', enabled: false, webhookUrl: '', secret: '', autoReply: false, mentionOnly: false, groupChat: false },
  { id: '9', name: '小蜜蜂', enabled: false, webhookUrl: '', secret: '', autoReply: false, mentionOnly: false, groupChat: false },
  { id: '10', name: 'POPO', enabled: false, webhookUrl: '', secret: '', autoReply: false, mentionOnly: false, groupChat: false },
  { id: '11', name: '龙虾邮箱', enabled: false, webhookUrl: '', secret: '', autoReply: false, mentionOnly: false, groupChat: false },
]

const mockModels: Model[] = [
  { id: '1', name: 'DeepSeek Chat', status: 'active', provider: 'deepseek-chat' },
  { id: '2', name: 'DeepSeek Coder', status: 'active', provider: 'deepseek-coder' },
  { id: '3', name: 'GPT-4o', status: 'disabled', provider: 'gpt-4o' },
  { id: '4', name: 'GPT-4o Mini', status: 'disabled', provider: 'gpt-4o-mini' },
  { id: '5', name: 'GPT-4 Turbo', status: 'disabled', provider: 'gpt-4-turbo' },
  { id: '6', name: 'GPT-3.5 Turbo', status: 'active', provider: 'gpt-3.5-turbo' },
  { id: '7', name: 'Claude Sonnet 4', status: 'available', provider: 'claude-sonnet-4' },
  { id: '8', name: 'Claude Opus 4', status: 'available', provider: 'claude-opus-4' },
]

const tabs: { id: SettingsTab; icon: typeof Settings2; label: string }[] = [
  { id: 'general', icon: Settings2, label: '通用' },
  { id: 'cloud', icon: Cloud, label: '云提供商' },
  { id: 'local', icon: Bot, label: '本地模型' },
  { id: 'im', icon: MessageSquare, label: 'IM接入' },
  { id: 'memory', icon: Brain, label: '记忆' },
  { id: 'rules', icon: FileText, label: '规则' },
  { id: 'workspace', icon: FolderOpen, label: '工作区' },
  { id: 'agent', icon: Zap, label: 'Agent进化看板' },
  { id: 'cost', icon: DollarSign, label: '成本管理' },
  { id: 'computer', icon: Monitor, label: '电脑操作' },
  { id: 'diagnostics', icon: Bug, label: '调试诊断' },
]

// LocalModelSettings is now imported from './LocalModelSettings'

function ToggleSwitch({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-7 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-inner ${
        checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-500'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function SettingsToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  id,
}: {
  icon: typeof Settings2
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  id: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3 flex-1">
          <Icon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{title}</span>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
          </div>
        </div>
        <ToggleSwitch checked={checked} onChange={onChange} id={id} />
      </div>
    </div>
  )
}

function SelectButton({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        selected
          ? 'bg-blue-500 text-white shadow-sm'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      {label}
    </button>
  )
}

function ThemeButton({
  label,
  selected,
  onClick,
  color,
  selectedColor,
  darkText = false,
  lightText = false,
}: {
  label: string
  selected: boolean
  onClick: () => void
  color: string
  selectedColor: string
  darkText?: boolean
  lightText?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ${
        selected
          ? `${selectedColor} ${darkText ? 'text-white' : '!text-gray-900'} ring-2 ring-blue-500`
          : `${color} ${darkText ? 'text-gray-200 hover:text-white' : lightText ? '!text-gray-800' : 'text-gray-600'} hover:opacity-80`
      }`}
    >
      {label}
    </button>
  )
}

function GeneralSettings() {
  const { theme, setTheme } = useTheme()
  const [language, setLanguage] = useState<'zh' | 'en'>('zh')
  const [autoStart, setAutoStart] = useState(false)
  const [preventSleep, setPreventSleep] = useState(false)
  const [useProxy, setUseProxy] = useState(false)
  const [autoBackup, setAutoBackup] = useState(false)
  const [skipTasks, setSkipTasks] = useState(false)
  const [reasoningIntensity, setReasoningIntensity] = useState<string>('medium')
  const [thinkingMode, setThinkingMode] = useState(true)
  const [searchModel, setSearchModel] = useState('default')
  const [searchApiKey, setSearchApiKey] = useState('')
  const [voiceModel, setVoiceModel] = useState('default')
  const [voiceApiKey, setVoiceApiKey] = useState('')
  const [imageRecognitionModel, setImageRecognitionModel] = useState('default')
  const [imageRecognitionApiKey, setImageRecognitionApiKey] = useState('')
  const [imageGenerationModel, setImageGenerationModel] = useState('default')
  const [imageGenerationApiKey, setImageGenerationApiKey] = useState('')
  const [contextWindow, setContextWindow] = useState<string>('200K')
  const [customContext, setCustomContext] = useState('')
  const [showCustomContext, setShowCustomContext] = useState(false)
  const [showSearchApiKey, setShowSearchApiKey] = useState(false)
  const [showVoiceApiKey, setShowVoiceApiKey] = useState(false)
  const [showImageRecognitionApiKey, setShowImageRecognitionApiKey] = useState(false)
  const [showImageGenerationApiKey, setShowImageGenerationApiKey] = useState(false)

  const buildGroupedOptions = (customOptions: { value: string; label: string }[]) => {
    const cloudOptions = [
      { value: 'deepseek', label: 'DeepSeek/DeepSeek Chat' },
      { value: 'deepseek-reasoner', label: 'DeepSeek/DeepSeek Reasoner' },
      { value: 'deepseek-coder', label: 'DeepSeek/DeepSeek Coder' },
      { value: 'volcengine-code', label: '火山引擎/Doubao-Seed-2.0-Code' },
      { value: 'volcengine-pro', label: '火山引擎/Doubao-Seed-2.0-Pro' },
      { value: 'volcengine-lite', label: '火山引擎/Doubao-Seed-2.0-Lite' },
      { value: 'volcengine-code2', label: '火山引擎/Doubao-Seed-Code' },
      { value: 'volcengine-kimi', label: '火山引擎/Kimi-K2.5' },
      { value: 'volcengine-glm', label: '火山引擎/GLM-4.7' },
      { value: 'volcengine-deepseek', label: '火山引擎/DeepSeek-V3.2' },
      { value: 'volcengine-minimax', label: '火山引擎/MiniMax-M2.5' },
      { value: 'minimax-m25', label: 'MiniMax/MiniMax M2.5' },
      { value: 'minimax-m27', label: 'MiniMax/MiniMax M2.7' },
      { value: 'minimax-abab', label: 'MiniMax/abab 6.5s Chat' },
      { value: 'minimax-fast', label: 'MiniMax/MiniMax M2.5 极速版' },
    ]
    const localOptions = [
      { value: 'local-llama', label: '本地模型 (llama.cpp)/Qwen3VL-2B-Instruct-Q8_0' },
    ]
    const dedicatedServices = [
      { value: 'baidu-search', label: '百度搜索' },
      { value: 'tavily', label: 'Tavily Search' },
      { value: 'brave-search', label: 'Brave Search' },
    ]

    return [
      { label: '默认', items: [{ value: 'default', label: '默认，使用会话模型' }] },
      ...(cloudOptions.length > 0 ? [{ label: '云端模型', items: cloudOptions }] : []),
      ...(localOptions.length > 0 ? [{ label: '本地模型', items: localOptions }] : []),
      { label: '专用服务', items: [...dedicatedServices, ...customOptions] },
    ]
  }

  const searchProviders = buildGroupedOptions([
    { value: 'baidu', label: '百度' },
    { value: 'xiaomi', label: '小米' },
    { value: 'volcengine', label: '火山引擎' },
    { value: 'minimax', label: 'Minimax' },
    { value: 'tencent', label: '腾讯混元' },
    { value: 'aliyun', label: '阿里云/通义千问' },
    { value: 'zhipu', label: '智谱' },
    { value: 'openai', label: 'OpenAI（ChatGPT）' },
    { value: 'anthropic', label: 'Anthropic（Claude）' },
  ])

  const voiceProviders = buildGroupedOptions([
    { value: 'whisper', label: 'Whisper (OpenAI)' },
    { value: 'deepgram', label: 'Deepgram' },
    { value: 'azure-speech', label: 'Azure 语音服务' },
    { value: 'google-speech', label: 'Google 语音识别' },
    { value: 'aliyun-asr', label: '阿里云语音识别' },
  ])

  const imageRecognitionProviders = buildGroupedOptions([
    { value: 'gpt4-vision', label: 'GPT-4 Vision' },
    { value: 'claude-vision', label: 'Claude Vision' },
    { value: 'gemini-vision', label: 'Gemini Vision' },
    { value: 'qwen-vl', label: 'Qwen-VL' },
    { value: 'deepseek-vl', label: 'DeepSeek-VL' },
  ])

  const imageGenerationProviders = buildGroupedOptions([
    { value: 'dall-e', label: 'DALL-E (OpenAI)' },
    { value: 'stable-diffusion', label: 'Stable Diffusion' },
    { value: 'midjourney', label: 'Midjourney' },
    { value: 'flux', label: 'Flux' },
    { value: 'qwen-vg', label: '通义万相' },
  ])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">语言</label>
            <div className="flex gap-2">
              <SelectButton label="中文" selected={language === 'zh'} onClick={() => setLanguage('zh')} />
              <SelectButton label="EN" selected={language === 'en'} onClick={() => setLanguage('en')} />
            </div>
          </div>

          <SettingsToggleRow
            icon={Power}
            title="开机自启动"
            description="系统启动时自动运行应用"
            checked={autoStart}
            onChange={setAutoStart}
            id="auto-start"
          />

          <SettingsToggleRow
            icon={Monitor}
            title="防止休眠"
            description="防止系统在应用运行时进入睡眠模式"
            checked={preventSleep}
            onChange={setPreventSleep}
            id="prevent-sleep"
          />

          <SettingsToggleRow
            icon={Globe}
            title="使用系统代理"
            description="开启后网络请求将跟随系统代理(保存后生效)"
            checked={useProxy}
            onChange={setUseProxy}
            id="use-proxy"
          />

          <SettingsToggleRow
            icon={HardDrive}
            title="启用自动备份与恢复"
            description="开启后将自动备份数据，并在启动时尝试恢复损坏的数据"
            checked={autoBackup}
            onChange={setAutoBackup}
            id="auto-backup"
          />

          <SettingsToggleRow
            icon={SkipForward}
            title="跳过未执行任务"
            description="启动时跳过离线期间未触发的定时任务，不补充执行(保存后生效)"
            checked={skipTasks}
            onChange={setSkipTasks}
            id="skip-tasks"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">配色主题</label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">在亮色与暗色工作区之间切换，不影响原有亮色主题</p>
            <div className="flex gap-2 flex-wrap">
              <ThemeButton label="简洁（纯白）" selected={theme === 'clean'} onClick={() => setTheme('clean')} color="bg-white border border-gray-200" selectedColor="bg-white border-2 border-blue-500" />
              <ThemeButton label="亮色（土黄）" selected={theme === 'light'} onClick={() => setTheme('light')} color="bg-amber-50" selectedColor="bg-amber-100" lightText />
              <ThemeButton label="暗色（灰黑）" selected={theme === 'dark'} onClick={() => setTheme('dark')} color="bg-gray-800" selectedColor="bg-gray-900" darkText />
              <ThemeButton label="鲜亮（淡蓝）" selected={theme === 'vivid'} onClick={() => setTheme('vivid')} color="bg-blue-50" selectedColor="bg-blue-100" lightText />
              <ThemeButton label="护眼（草绿）" selected={theme === 'eye'} onClick={() => setTheme('eye')} color="bg-green-50" selectedColor="bg-green-100" lightText />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sliders className="w-5 h-5 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">功能模块配置</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-3 pb-4 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <Search className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">网络搜索</span>
                </div>
                <select
                  value={searchModel}
                  onChange={(e) => setSearchModel(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
                >
                  {searchProviders.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.items.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="relative">
                  <input
                    type={showSearchApiKey ? 'text' : 'password'}
                    value={searchApiKey}
                    onChange={(e) => setSearchApiKey(e.target.value)}
                    placeholder="API Key（留空使用会话模型）"
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300 pr-16"
                  />
                  <button
                    onClick={() => setShowSearchApiKey(!showSearchApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                  >
                    {showSearchApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-3 pb-4 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <Mic className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">语音识别/转录</span>
                </div>
                <select
                  value={voiceModel}
                  onChange={(e) => setVoiceModel(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
                >
                  {voiceProviders.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.items.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="relative">
                  <input
                    type={showVoiceApiKey ? 'text' : 'password'}
                    value={voiceApiKey}
                    onChange={(e) => setVoiceApiKey(e.target.value)}
                    placeholder="API Key（留空使用会话模型）"
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300 pr-16"
                  />
                  <button
                    onClick={() => setShowVoiceApiKey(!showVoiceApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                  >
                    {showVoiceApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-3 pb-4 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <Image className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">图像识别</span>
                </div>
                <select
                  value={imageRecognitionModel}
                  onChange={(e) => setImageRecognitionModel(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
                >
                  {imageRecognitionProviders.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.items.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="relative">
                  <input
                    type={showImageRecognitionApiKey ? 'text' : 'password'}
                    value={imageRecognitionApiKey}
                    onChange={(e) => setImageRecognitionApiKey(e.target.value)}
                    placeholder="API Key（留空使用会话模型）"
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300 pr-16"
                  />
                  <button
                    onClick={() => setShowImageRecognitionApiKey(!showImageRecognitionApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                  >
                    {showImageRecognitionApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-3 pb-4 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <Palette className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">图像生成</span>
                </div>
                <select
                  value={imageGenerationModel}
                  onChange={(e) => setImageGenerationModel(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
                >
                  {imageGenerationProviders.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.items.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="relative">
                  <input
                    type={showImageGenerationApiKey ? 'text' : 'password'}
                    value={imageGenerationApiKey}
                    onChange={(e) => setImageGenerationApiKey(e.target.value)}
                    placeholder="API Key（留空使用会话模型）"
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300 pr-16"
                  />
                  <button
                    onClick={() => setShowImageGenerationApiKey(!showImageGenerationApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                  >
                    {showImageGenerationApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={thinkingMode}
                onChange={(e) => setThinkingMode(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
              />
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white">启用思考模式</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  控制新会话是否启用模型思考。关闭后，DeepSeek 等兼容供应商会收到显式非思考模式参数。
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  关闭后会以--thinking disabled启动新会话;适合 DeepSeek V4 Flash/Pro等需要非思考模式的模型。
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">推理等级</label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">控制推理深度。等级越高 = 越智能，响应越慢。</p>
            <div className="flex gap-2">
              <SelectButton label="低" selected={reasoningIntensity === 'low'} onClick={() => setReasoningIntensity('low')} />
              <SelectButton label="中" selected={reasoningIntensity === 'medium'} onClick={() => setReasoningIntensity('medium')} />
              <SelectButton label="高" selected={reasoningIntensity === 'high'} onClick={() => setReasoningIntensity('high')} />
              <SelectButton label="最大" selected={reasoningIntensity === 'maximum'} onClick={() => setReasoningIntensity('maximum')} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">上下文窗口</label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">部分模型（如 Sonnet、deepseek-v4）支持最高 1M 上下文。需订阅计划支持后启用。</p>
            <div className="flex gap-2 mb-3">
              <SelectButton label="200K" selected={contextWindow === '200K'} onClick={() => { setContextWindow('200K'); setShowCustomContext(false); }} />
              <SelectButton label="1M" selected={contextWindow === '1M'} onClick={() => { setContextWindow('1M'); setShowCustomContext(false); }} />
              <SelectButton label="自定义" selected={contextWindow === 'custom'} onClick={() => { setContextWindow('custom'); setShowCustomContext(true); }} />
            </div>
            {showCustomContext && (
              <input
                type="text"
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                placeholder="输入上下文窗口大小（如 500K）"
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const FIXED_MODELS_BY_PROVIDER: Record<string, string[]> = {
  '2': ['ark-code-latest'],
  '4': ['astron-code-latest'],
  '10': ['tc-code-latest'],
}

function CloudProviderSettings() {
  const { setAppConfig, appConfig, syncProviderConfig, setActiveModelId, providers: globalProviders, setProviders: setGlobalProviders, defaultModelId, setDefaultModelId, modelStatuses, setModelStatus } = useChat()

  const mergeSavedProviders = useCallback(() => {
    const saved = localStorage.getItem('canai-settings-cloud-providers')
    let savedByName: Record<string, CloudProvider> = {}
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as CloudProvider[]
        for (const p of parsed) savedByName[p.name] = p
      } catch {}
    }
    return mockCloudProviders.map(mock => {
      const savedP = savedByName[mock.name]
      const fixedModels = FIXED_MODELS_BY_PROVIDER[mock.id] || []
      if (savedP) {
        return {
          ...mock,
          apiKey: savedP.apiKey || mock.apiKey,
          baseUrl: savedP.baseUrl || mock.baseUrl,
          enabled: savedP.enabled,
          systemPrompt: savedP.systemPrompt || mock.systemPrompt,
          models: savedP.models.length > 0
            ? [...new Set([...savedP.models, ...fixedModels])]
            : [...new Set([...mock.models, ...fixedModels])],
        }
      }
      return {
        ...mock,
        models: fixedModels.length > 0 ? [...new Set([...mock.models, ...fixedModels])] : mock.models,
      }
    })
  }, [])

  const [providers, setProviders] = useState<CloudProvider[]>(() => mergeSavedProviders())
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | null>(null)

  useEffect(() => {
    if (!selectedProvider && providers.length > 0) {
      setSelectedProvider(providers[0])
    }
  }, [providers])

  useEffect(() => {
    const current = mockCloudProviders.map(mock => {
      const found = providers.find(p => p.name === mock.name)
      if (found) return found
      return { ...mock }
    })
    localStorage.setItem('canai-settings-cloud-providers', JSON.stringify(current))
  }, [providers])

  useEffect(() => {
    setConnectionResult(null)
    setTestingConnection(false)
  }, [selectedProvider])
  const [showApiKey, setShowApiKey] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newProvider, setNewProvider] = useState({
    id: '',
    name: '',
    icon: 'C',
    color: '#2563eb',
    description: '',
    apiKey: '',
    baseUrl: '',
    apiFormat: 'openai' as 'anthropic' | 'openai' | 'google',
    models: [''],
    codingPlan: false,
    enabled: true,
  })
  
  // DeepSeek balance state
  const [balance, setBalance] = useState<string | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [balanceError, setBalanceError] = useState('')
  const [autoFetchBalance, setAutoFetchBalance] = useState(false)

  const iconOptions = ['C', 'A', 'B', 'D', 'E', 'F', 'G', 'H', 'M', 'O', 'P', 'Q', 'S', 'T', 'V', 'X', 'Z']
  const colorOptions = ['#2563eb', '#ef4444', '#eab308', '#10b981', '#a855f7', '#ec4899', '#f97316', '#06b6d4', '#22c55e', '#6366f1', '#8b5cf6', '#f59e0b']

  const fetchDeepSeekBalance = async () => {
    if (!selectedProvider || selectedProvider.name !== 'DeepSeek') return
    
    const apiKey = selectedProvider.apiKey
    if (!apiKey) {
      setBalanceError('请先输入 API Key')
      return
    }
    
    setBalanceLoading(true)
    setBalanceError('')
    setBalance(null)
    
    try {
      const { getDeepSeekBalance } = await import('../api/deepseek')
      const result = await getDeepSeekBalance(apiKey, selectedProvider.baseUrl)
      const USD_TO_CNY = 7.2
      let cnyBalance: string
      if (result.currency === 'CNY') {
        cnyBalance = result.total_balance
      } else {
        cnyBalance = (parseFloat(result.total_balance) * USD_TO_CNY).toFixed(2)
      }
      setBalance(cnyBalance)
    } catch (err) {
      setBalanceError(String(err))
    }
    setBalanceLoading(false)
  }
  
  // Auto fetch balance when selecting DeepSeek and autoFetch is enabled
  useEffect(() => {
    if (selectedProvider?.name === 'DeepSeek' && autoFetchBalance && selectedProvider.apiKey) {
      const timer = setTimeout(fetchDeepSeekBalance, 500)
      return () => clearTimeout(timer)
    }
  }, [selectedProvider, autoFetchBalance])

  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionResult, setConnectionResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [codingPlanHint, setCodingPlanHint] = useState<string | null>(null)

  const handleTestConnection = async () => {
    if (!selectedProvider) return

    if (!selectedProvider.apiKey || selectedProvider.apiKey.trim() === '') {
      setConnectionResult({ ok: false, message: '请先填写 API Key' })
      return
    }

    const baseUrl = selectedProvider.baseUrl.replace(/\/+$/, '')
    const urlHasCoding = baseUrl.includes('/coding/') || baseUrl.includes('/coding')

    let hint = ''
    if (urlHasCoding && !selectedProvider.codingPlan) {
      hint = '提示：当前为 Coding Plan 地址，建议开启上方「Coding Plan」开关'
    }
    if (!urlHasCoding && selectedProvider.codingPlan) {
      hint = '提示：已开启 Coding Plan，地址非专属端点，如需切换请点击开关'
    }
    setCodingPlanHint(hint)
    setTimeout(() => setCodingPlanHint(null), 5000)

    setTestingConnection(true)
    setConnectionResult(null)
    try {
      const apiKey = selectedProvider.apiKey
      const firstModel = selectedProvider.models[0] || 'default'

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 12000)

      const testModel = firstModel

      const candidateUrls: string[] = []
      const isVolc = selectedProvider.name === '火山引擎' || baseUrl.includes('volces.com')
      const isXfyun = selectedProvider.name === '讯飞星辰' || selectedProvider.id === '4' || baseUrl.includes('xf-yun.com')
      const isMinimax = selectedProvider.name === 'MiniMax' || baseUrl.includes('minimaxi.com')
      const authHeader = isXfyun ? `Basic ${btoa(apiKey)}` : `Bearer ${apiKey}`

      if (isVolc) {
        candidateUrls.push(`${baseUrl}/chat/completions`)
      } else if (isXfyun) {
        candidateUrls.push(`${baseUrl}/chat/completions`)
      } else if (isMinimax) {
        candidateUrls.push(`${baseUrl}/chat/completions`)
        candidateUrls.push(`${baseUrl}/v1/chat/completions`)
      } else {
        candidateUrls.push(`${baseUrl}/models`)
        candidateUrls.push(`${baseUrl}/chat/completions`)
        candidateUrls.push(`${baseUrl}/v1/chat/completions`)
      }

      let lastDetail = ''
      let success = false

      for (const url of candidateUrls) {
        try {
          const isModelsEndpoint = url.endsWith('/models')
          const resp = await fetch(url, {
            method: isModelsEndpoint ? 'GET' : 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            ...(isModelsEndpoint ? {} : {
              body: JSON.stringify({
                model: testModel,
                messages: [{ role: 'user', content: 'hi' }],
                max_tokens: 5,
                stream: false,
              }),
            }),
            signal: controller.signal,
          })

          if (resp.ok) {
            success = true
            break
          }

          let detail = `[${url}] HTTP ${resp.status}`
          try {
            const text = await resp.text()
            if (text) {
              try {
                const j = JSON.parse(text)
                detail += ` - ${j.error?.message || j.error?.code || text.substring(0, 100)}`
              } catch {
                detail += ` - ${text.substring(0, 100)}`
              }
            }
          } catch {}
          lastDetail = detail
        } catch (err) {
          lastDetail = `[${url}] 网络错误: ${err instanceof Error ? err.message : '未知错误'}`
        }
      }

      clearTimeout(timeout)

      if (!success) {
        try {
          const proxyResult = await proxyTestConnection(baseUrl, apiKey, testModel)
          if (proxyResult.ok) {
            success = true
            lastDetail = proxyResult.detail
          } else {
            lastDetail = `${lastDetail} | 代理: ${proxyResult.detail}`
          }
        } catch {
          lastDetail = `${lastDetail} | 代理测试失败`
        }
      }

      if (success) {
        setConnectionResult({ ok: true, message: '连接成功' })
      } else {
        setConnectionResult({ ok: false, message: lastDetail || '所有端点均连接失败' })
      }
    } catch (err) {
      setConnectionResult({ ok: false, message: `连接异常: ${err instanceof Error ? err.message : '未知错误'}` })
    } finally {
      setTestingConnection(false)
    }
  }

  const [fetchingModels, setFetchingModels] = useState(false)

  const handleAutoFetchModels = async () => {
    if (!selectedProvider) return

    if (!selectedProvider.apiKey || selectedProvider.apiKey.trim() === '') {
      setConnectionResult({ ok: false, message: '请先填写 API Key' })
      return
    }

    setFetchingModels(true)
    try {
      const baseUrl = selectedProvider.baseUrl.replace(/\/+$/, '')
      const apiKey = selectedProvider.apiKey
      const isXfyun = selectedProvider.name === '讯飞星辰' || selectedProvider.id === '4' || baseUrl.includes('xf-yun.com')
      const authHeader = isXfyun ? `Basic ${btoa(apiKey)}` : `Bearer ${apiKey}`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      let modelIds: string[] = []
      let found = false

      const tryFetchModels = async (url: string): Promise<boolean> => {
        try {
          const resp = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          })
          if (!resp.ok) return false

          const text = await resp.text()
          if (!text) return false

          let data: any
          try { data = JSON.parse(text) } catch { return false }

          const candidates: string[] = []
          if (data.data && Array.isArray(data.data)) {
            data.data.forEach((item: any) => {
              const name = item.id || item.model || item.model_id
              if (name && !candidates.includes(name)) candidates.push(name)
            })
          } else if (data.models && Array.isArray(data.models)) {
            data.models.forEach((item: any) => {
              const name = item.id || item.model || item.name
              if (name && !candidates.includes(name)) candidates.push(name)
            })
          }

          if (candidates.length > 0) {
            modelIds = candidates
            return true
          }
          return false
        } catch {
          return false
        }
      }

      found = await tryFetchModels(`${baseUrl}/models`)
      if (!found) {
        found = await tryFetchModels(`${baseUrl}/v1/models`)
      }

      clearTimeout(timeout)

      if (found && modelIds.length > 0) {
        const fixedModels = FIXED_MODELS_BY_PROVIDER[selectedProvider.id] || []
        const merged = [...new Set([...modelIds, ...fixedModels])]
        updateProvider(selectedProvider.id, { models: merged })
        setConnectionResult({ ok: true, message: `已获取 ${modelIds.length} 个模型` })

        const testUrl = `${baseUrl.replace(/\/+$/, '')}/chat/completions`
        for (const mId of modelIds) {
          try {
            const r = await fetch(testUrl, {
              method: 'POST',
              headers: { 'Authorization': isXfyun ? `Basic ${btoa(apiKey)}` : `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: mId, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5, stream: false }),
              signal: AbortSignal.timeout(8000),
            })
            setModelStatus(mId, (r.ok || r.status === 429) ? 'ok' : 'fail')
          } catch {
            setModelStatus(mId, 'fail')
          }
        }
      } else {
        setConnectionResult({ ok: false, message: '无法自动获取模型列表，请手动添加' })
      }
      setTimeout(() => setConnectionResult(null), 3000)
    } catch (err) {
      setConnectionResult({ ok: false, message: `获取失败: ${err instanceof Error ? err.message : '未知错误'}` })
      setTimeout(() => setConnectionResult(null), 3000)
    } finally {
      setFetchingModels(false)
    }
  }

  const handleAddModel = () => {
    setShowAddModelModal(true)
    setNewModelName('')
  }

  const [showAddModelModal, setShowAddModelModal] = useState(false)
  const [newModelName, setNewModelName] = useState('')
  const addModelInputRef = useRef<HTMLInputElement>(null)

  const confirmAddModel = () => {
    if (!selectedProvider || !newModelName.trim()) return
    updateProvider(selectedProvider.id, {
      models: [...selectedProvider.models, newModelName.trim()]
    })
    setShowAddModelModal(false)
    setNewModelName('')
  }

  useEffect(() => {
    if (showAddModelModal && addModelInputRef.current) {
      setTimeout(() => addModelInputRef.current?.focus(), 100)
    }
  }, [showAddModelModal])

  const [savingCloud, setSavingCloud] = useState(false)
  const [saveCloudResult, setSaveCloudResult] = useState<{ ok: boolean; message: string } | null>(null)

  const [testingModels, setTestingModels] = useState<Record<string, 'testing' | 'ok' | null>>({})
  const [refreshingList, setRefreshingList] = useState(false)
  const [modelTestErrors, setModelTestErrors] = useState<Record<string, string>>({})

  const handleTestModel = async (modelName: string) => {
    if (!selectedProvider) return
    setTestingModels(prev => ({ ...prev, [modelName]: 'testing' }))
    setModelTestErrors(prev => { const n = { ...prev }; delete n[modelName]; return n })
    try {
      const url = `${selectedProvider.baseUrl.replace(/\/+$/, '')}/chat/completions`
      const apiKey = selectedProvider.apiKey
      const isXfyun = selectedProvider.name === '讯飞星辰' || selectedProvider.id === '4' || url.includes('xf-yun.com')

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (isXfyun) {
        headers['Authorization'] = `Basic ${btoa(apiKey)}`
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`
      }

      let resp: Response | null = null
      try {
        resp = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: modelName,
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
              model: modelName,
              messages: [{ role: 'user', content: 'hi' }],
              max_tokens: 5,
              stream: false,
            }),
          })
          if (result.status < 500) {
            setModelStatus(modelName, 'ok')
            setTestingModels(prev => ({ ...prev, [modelName]: 'ok' }))
            setTimeout(() => setTestingModels(prev => ({ ...prev, [modelName]: null })), 2000)
            return
          }
          setModelStatus(modelName, 'fail')
          setTestingModels(prev => ({ ...prev, [modelName]: null }))
          setModelTestErrors(prev => ({ ...prev, [modelName]: `代理: HTTP ${result.status}` }))
          setTimeout(() => setModelTestErrors(prev => { const n = { ...prev }; delete n[modelName]; return n }), 4000)
          return
        } catch {
          setModelStatus(modelName, 'fail')
          setTestingModels(prev => ({ ...prev, [modelName]: null }))
          setModelTestErrors(prev => ({ ...prev, [modelName]: `网络错误: ${fetchErr instanceof Error ? fetchErr.message : '未知错误'}` }))
          setTimeout(() => setModelTestErrors(prev => { const n = { ...prev }; delete n[modelName]; return n }), 4000)
          return
        }
      }

      if (!resp) return
      if (resp.ok || resp.status === 429) {
        setModelStatus(modelName, 'ok')
        setTestingModels(prev => ({ ...prev, [modelName]: 'ok' }))
        setTimeout(() => setTestingModels(prev => ({ ...prev, [modelName]: null })), 2000)
      } else {
        setModelStatus(modelName, 'fail')
        setTestingModels(prev => ({ ...prev, [modelName]: null }))
        let errDetail = `HTTP ${resp.status}`
        try { const text = await resp.text(); if (text) { try { const j = JSON.parse(text); errDetail += `: ${j.error?.message || j.error?.code || text.substring(0, 150)}` } catch { errDetail += `: ${text.substring(0, 150)}` } } } catch {}
        setModelTestErrors(prev => ({ ...prev, [modelName]: errDetail }))
        setTimeout(() => setModelTestErrors(prev => { const n = { ...prev }; delete n[modelName]; return n }), 4000)
      }
    } catch (err) {
      setModelStatus(modelName, 'fail')
      setTestingModels(prev => ({ ...prev, [modelName]: null }))
      setModelTestErrors(prev => ({ ...prev, [modelName]: `网络错误: ${err instanceof Error ? err.message : '未知错误'}` }))
      setTimeout(() => setModelTestErrors(prev => { const n = { ...prev }; delete n[modelName]; return n }), 4000)
    }
  }

  const handleDeleteModel = (modelName: string) => {
    if (!selectedProvider) return
    updateProvider(selectedProvider.id, {
      models: selectedProvider.models.filter(m => m !== modelName)
    })
    if (defaultModelId === modelName) {
      setDefaultModelId(null)
    }
  }

  const handleToggleDefault = (modelName: string) => {
    if (defaultModelId === modelName) {
      setDefaultModelId(null)
    } else {
      setDefaultModelId(modelName)
      setActiveModelId(modelName, providerIdMap[selectedProvider?.id || ''])
    }
  }

  const providerIdMap: Record<string, string> = {
    '1': 'deepseek', '2': 'volcengine', '3': 'minimax', '4': 'xfyun',
    '5': 'zhipu', '6': 'qwen', '7': 'moonshot', '8': 'xiaomi',
    '9': 'baidu', '10': 'tencent', '11': 'infini', '12': 'openai',
    '13': 'anthropic', '14': 'google', '15': 'ollama', '16': 'openrouter',
    '17': 'mistral', '18': 'xai', '19': 'cohere', '20': 'perplexity',
    '21': 'meta', '22': 'microsoft', '23': 'nvidia', '24': 'ibm',
    '25': 'aws', '26': 'databricks', '27': 'youdao', '28': 'stepfun',
    '29': 'stabilityai', '30': 'ai21', '31': 'huggingface', '32': 'togetherai',
    '33': 'groq', '34': 'nous', '35': 'novita', '36': 'azure',
    'deepseek': 'deepseek', 'volcengine': 'volcengine', 'minimax': 'minimax',
    'xfyun': 'xfyun', 'openai': 'openai', 'anthropic': 'anthropic',
  }

  const handleSaveCloudConfig = async () => {
    if (!selectedProvider) return
    setSavingCloud(true)
    setSaveCloudResult(null)
    try {
      await new Promise(resolve => setTimeout(resolve, 600))

      const globalFormat = providers.map(cp => ({
        id: providerIdMap[cp.id] || cp.id,
        name: cp.name,
        type: 'cloud' as const,
        apiKey: cp.apiKey,
        baseUrl: cp.baseUrl,
        apiFormat: (cp.apiFormat === 'google' ? 'openai' : cp.apiFormat) as 'openai' | 'anthropic',
        enabled: cp.enabled,
        systemPrompt: cp.systemPrompt || '',
        models: cp.models.map(m => {
          const modelId = m.trim()
          return {
            id: modelId,
            name: modelId,
            providerId: providerIdMap[cp.id] || cp.id,
            type: 'cloud' as const,
          }
        }),
      }))

      const localProviders = globalProviders.filter(p => p.type === 'local')
      setGlobalProviders([...globalFormat, ...localProviders])

      const firstModelId = selectedProvider.models[0]
      if (firstModelId && !defaultModelId) {
        setActiveModelId(firstModelId.trim(), providerIdMap[selectedProvider.id])
      } else if (defaultModelId) {
        setActiveModelId(defaultModelId, providerIdMap[selectedProvider.id])
      }

      setAppConfig({
        ...appConfig,
        apiKey: selectedProvider.apiKey,
        baseUrl: selectedProvider.baseUrl,
        apiFormat: selectedProvider.apiFormat === 'google' ? 'openai' : selectedProvider.apiFormat,
        model: selectedProvider.models[0] || appConfig.model,
        providerId: providerIdMap[selectedProvider.id],
      })

      setSaveCloudResult({ ok: true, message: '保存成功' })
    } catch (err) {
      setSaveCloudResult({ ok: false, message: `保存失败: ${err instanceof Error ? err.message : '未知错误'}` })
    } finally {
      setSavingCloud(false)
      setTimeout(() => setSaveCloudResult(null), 3000)
    }
  }

  const handleClearProvider = () => {
    if (!selectedProvider) return
    updateProvider(selectedProvider.id, { apiKey: '', models: [] })
    const updatedProviders = providers.map(p =>
      p.id === selectedProvider.id ? { ...p, apiKey: '', models: [] } : p
    )
    const globalFormat = updatedProviders.map(cp => ({
        id: providerIdMap[cp.id] || cp.id,
        name: cp.name,
        type: 'cloud' as const,
        apiKey: cp.apiKey,
        baseUrl: cp.baseUrl,
        apiFormat: (cp.apiFormat === 'google' ? 'openai' : cp.apiFormat) as 'openai' | 'anthropic',
        enabled: cp.enabled,
        systemPrompt: cp.systemPrompt || '',
        models: cp.models.map(m => {
          const modelId = m.trim()
          return {
            id: modelId,
            name: modelId,
            providerId: providerIdMap[cp.id] || cp.id,
            type: 'cloud' as const,
          }
        }),
      }))
    const localProviders = globalProviders.filter(p => p.type === 'local')
    setGlobalProviders([...globalFormat, ...localProviders])
    setSaveCloudResult({ ok: true, message: '已清空 API Key 和模型列表' })
    setTimeout(() => setSaveCloudResult(null), 2500)
  }
  
  const toggleProvider = (id: string) => {
    const newEnabled = !providers.find(p => p.id === id)?.enabled
    setProviders(providers.map(p => 
      p.id === id ? { ...p, enabled: newEnabled } : p
    ))
    if (selectedProvider?.id === id) {
      setSelectedProvider(prev => prev ? { ...prev, enabled: newEnabled } : null)
    }
    const globalFormat = providers.map(cp => ({
      id: providerIdMap[cp.id] || cp.id,
      name: cp.name,
      type: 'cloud' as const,
      apiKey: cp.apiKey,
      baseUrl: cp.baseUrl,
      apiFormat: (cp.apiFormat === 'google' ? 'openai' : cp.apiFormat) as 'openai' | 'anthropic',
      enabled: cp.id === id ? newEnabled : cp.enabled,
      systemPrompt: cp.systemPrompt || '',
      models: cp.models.map(m => ({
        id: m.trim(),
        name: m.trim(),
        providerId: providerIdMap[cp.id] || cp.id,
        type: 'cloud' as const,
      })),
    }))
    const localProviders = globalProviders.filter(p => p.type === 'local')
    setGlobalProviders([...globalFormat, ...localProviders])
  }

  const updateProvider = (id: string, updates: Partial<CloudProvider>) => {
    setProviders(prev => prev.map(p => 
      p.id === id ? { ...p, ...updates } : p
    ))
    if (selectedProvider?.id === id) {
      setSelectedProvider(prev => prev ? { ...prev, ...updates } : null)
    }
  }

  const resetNewProvider = () => {
    setNewProvider({
      id: '',
      name: '',
      icon: 'C',
      color: '#2563eb',
      description: '',
      apiKey: '',
      baseUrl: '',
      apiFormat: 'openai',
      models: [''],
      codingPlan: false,
      enabled: true,
    })
  }

  const openAddModal = () => {
    resetNewProvider()
    setShowAddModal(true)
  }

  const handleAddProvider = () => {
    if (!newProvider.id.trim() || !newProvider.name.trim() || !newProvider.apiKey.trim() || !newProvider.baseUrl.trim()) return

    const provider: CloudProvider = {
      id: newProvider.id,
      name: newProvider.name,
      icon: newProvider.icon,
      color: newProvider.color,
      enabled: newProvider.enabled,
      apiKey: newProvider.apiKey,
      baseUrl: newProvider.baseUrl,
      apiFormat: newProvider.apiFormat,
      codingPlan: newProvider.codingPlan,
      models: newProvider.models.filter(m => m.trim()),
    }

    setProviders(prev => [...prev, provider])
    setSelectedProvider(provider)
    setShowAddModal(false)
  }

  return (
    <div className="flex h-full">
      {/* 左侧提供商列表 */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">模型提供商</h2>
            <button
              onClick={() => {
                setRefreshingList(true)
                setTimeout(() => {
                  setProviders(mergeSavedProviders())
                  setSelectedProvider(mergeSavedProviders()[0] || null)
                  setTimeout(() => setRefreshingList(false), 400)
                }, 200)
              }}
              className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
              title="刷新提供商列表"
            >
              <RefreshCw className={`w-4 h-4 ${refreshingList ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={openAddModal} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors flex items-center gap-1">
              <Plus className="w-4 h-4" />
              新增
            </button>
            <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1">
              <Plus className="w-4 h-4" />
              导入
            </button>
            <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1">
              <Download className="w-4 h-4" />
              导出
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {providers.map((provider) => (
            <div
              key={provider.id}
              onClick={() => setSelectedProvider(provider)}
              className={`p-4 rounded-xl border cursor-pointer transition-all bg-white dark:bg-gray-800 ${
                selectedProvider?.id === provider.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-200 dark:border-gray-700'
              } hover:border-blue-500 dark:hover:border-blue-500`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: provider.color }}
                  >
                    {provider.icon}
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">{provider.name}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleProvider(provider.id) }}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    provider.enabled ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                      provider.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧设置面板 */}
      {selectedProvider && (
        <div className="w-[560px] border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {selectedProvider.name} 提供商设置
            </h2>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                selectedProvider.enabled
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {selectedProvider.enabled ? '已开启' : '已关闭'}
              </span>
              <button
                onClick={handleClearProvider}
                className="px-3 py-1 bg-yellow-100 text-yellow-700 border border-yellow-300 rounded-lg text-xs font-medium hover:bg-yellow-200 transition-colors"
              >
                清空
              </button>
              <div className="relative">
                <button
                  onClick={handleSaveCloudConfig}
                  disabled={savingCloud}
                  className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 shadow-sm min-w-[110px] justify-center ${
                    savingCloud
                      ? 'bg-blue-400 text-white cursor-not-allowed scale-95'
                      : saveCloudResult
                        ? saveCloudResult.ok
                          ? 'bg-green-500 text-white scale-105'
                          : 'bg-red-500 text-white scale-105'
                        : 'bg-blue-500 text-white hover:bg-blue-600 hover:scale-[1.02] active:scale-95'
                  }`}
                >
                  {savingCloud ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : saveCloudResult ? (
                    <>
                      {saveCloudResult.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      {saveCloudResult.ok ? '保存成功' : '保存失败'}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      保存
                    </>
                  )}
                </button>
                {saveCloudResult && !saveCloudResult.ok && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-10 max-w-[280px] text-center">
                    {saveCloudResult.message}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={selectedProvider.apiKey}
                  onChange={(e) => updateProvider(selectedProvider.id, { apiKey: e.target.value })}
                  placeholder="输入 API Key..."
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white pr-20"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => updateProvider(selectedProvider.id, { apiKey: '' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <a
                href="#"
                className="text-sm text-orange-500 hover:text-orange-600 mt-2 inline-block"
              >
                获取 API Key →
              </a>
            </div>

            {/* API Base URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">API Base URL</label>
              <div className="relative">
                <input
                  type="text"
                  value={selectedProvider.baseUrl}
                  onChange={(e) => updateProvider(selectedProvider.id, { baseUrl: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white pr-10"
                />
                <button
                  onClick={() => updateProvider(selectedProvider.id, { baseUrl: '' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* API Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">API 格式</label>
              <div className="flex gap-3">
                {[
                  { value: 'anthropic', label: 'Anthropic 兼容' },
                  { value: 'openai', label: 'OpenAI 兼容' },
                  { value: 'google', label: 'Google 兼容' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => updateProvider(selectedProvider.id, { apiFormat: option.value as any })}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      selectedProvider.apiFormat === option.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedProvider.apiFormat === option.value ? 'border-blue-500 bg-blue-500' : 'border-gray-400'
                    }`}>
                      {selectedProvider.apiFormat === option.value && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                请选择 API 协议兼容格式，不同格式对应不同的请求和响应结构
              </p>
            </div>

            {/* Coding Plan */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Coding Plan</span>
                <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs rounded font-medium">Beta</span>
              </div>
              <div className="relative">
                <button
                  onClick={() => {
                    const newVal = !selectedProvider.codingPlan
                    const codingPlanUrls: Record<string, { coding: string; standard: string }> = {
                      '火山引擎': {
                        coding: 'https://ark.cn-beijing.volces.com/api/coding/v3',
                        standard: 'https://ark.cn-beijing.volces.com/api/v3',
                      },
                      '讯飞星辰': {
                        coding: 'https://maas-coding-api.cn-huabei-1.xf-yun.com/v2',
                        standard: 'https://maas-api.cn-huabei-1.xf-yun.com/v2',
                      },
                    }
                    const urls = codingPlanUrls[selectedProvider.name]
                    if (urls) {
                      updateProvider(selectedProvider.id, {
                        codingPlan: newVal,
                        baseUrl: newVal ? urls.coding : urls.standard,
                      })
                    } else {
                      updateProvider(selectedProvider.id, { codingPlan: newVal })
                    }
                  }}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    selectedProvider.codingPlan ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                      selectedProvider.codingPlan ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                {codingPlanHint && (
                  <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-yellow-500 text-white text-xs rounded-lg shadow-lg z-20 whitespace-nowrap">
                    {codingPlanHint}
                    <div className="absolute top-full right-3 border-4 border-transparent border-t-yellow-500" />
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-3">
              启用后使用 Coding Plan 专属 API 端点
            </p>

            {/* System Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                系统提示词 (System Prompt)
              </label>
              <textarea
                value={selectedProvider.systemPrompt || ''}
                onChange={(e) => updateProvider(selectedProvider.id, { systemPrompt: e.target.value })}
                placeholder="例如：你是豆包，由字节跳动开发的 AI 助手..."
                rows={3}
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">对话时自动注入为系统消息，帮助模型识别身份</p>
            </div>

            {/* 测试连接 */}
            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className={`w-full py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                connectionResult
                  ? connectionResult.ok
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-red-100 text-red-700 border border-red-300'
                  : 'bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${testingConnection ? 'animate-spin' : ''}`} />
              {testingConnection ? '连接测试中...' : connectionResult ? connectionResult.message : '测试连接'}
            </button>

            {/* 可用模型列表 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">可用模型列表</label>
                <div className="flex gap-2">
                  <button
                    onClick={handleAutoFetchModels}
                    disabled={fetchingModels}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <Database className={`w-3 h-3 ${fetchingModels ? 'animate-pulse' : ''}`} />
                    {fetchingModels ? '获取中...' : '自动获取'}
                  </button>
                  <button
                    onClick={handleAddModel}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    添加模型
                  </button>
                </div>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                <div className="divide-y divide-gray-300 dark:divide-gray-600 max-h-[320px] overflow-y-auto custom-scrollbar">
                  {selectedProvider.models.map((model, index) => (
                    <div key={index} className="px-4 py-2.5 flex items-center justify-between">
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          modelStatuses[model] === 'ok' ? 'bg-green-500' :
                          modelStatuses[model] === 'fail' ? 'bg-red-500' :
                          'bg-gray-300 dark:bg-gray-500'
                        }`} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{model}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {model.toLowerCase().replace(/\s+/g, '-')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleTestModel(model) }}
                            title="测试可用性"
                            className={`p-1.5 rounded transition-colors ${
                              testingModels[model] === 'testing'
                                ? 'bg-green-500 text-white'
                                : testingModels[model] === 'ok'
                                  ? 'bg-green-500 text-white'
                                  : 'text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                            }`}
                          >
                            {testingModels[model] === 'testing' ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : testingModels[model] === 'ok' ? (
                              <span className="text-[10px] font-semibold whitespace-nowrap px-1">可用</span>
                            ) : (
                              <Wifi className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {modelTestErrors[model] && (
                            <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2.5 py-1.5 bg-red-600 text-white text-[10px] rounded-lg shadow-lg z-20 max-w-[260px] text-left leading-tight whitespace-normal">
                              {modelTestErrors[model]}
                              <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-red-600" />
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleDefault(model) }}
                          title={defaultModelId === model ? '取消默认模型' : '设置为默认模型'}
                          className={`p-1.5 rounded transition-colors ${
                            defaultModelId === model
                              ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                              : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${defaultModelId === model ? 'fill-yellow-500' : ''}`} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteModel(model) }}
                          title="删除"
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* DeepSeek Balance */}
            {selectedProvider.name === 'DeepSeek' && (
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">账户余额</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchDeepSeekBalance}
                      disabled={balanceLoading}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                        balanceLoading
                          ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <RefreshCw className={`w-3 h-3 ${balanceLoading ? 'animate-spin' : ''}`} />
                      刷新
                    </button>
                    <button
                      onClick={() => setAutoFetchBalance(!autoFetchBalance)}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                        autoFetchBalance
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      自动获取
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    ¥ {balanceLoading ? '...' : (balance || '--')}
                  </span>
                  <span className="text-sm text-gray-500">元</span>
                </div>
                {balanceError && (
                  <p className="text-xs text-red-500 mt-2">{balanceError}</p>
                )}
              </div>
            )}
          </div>

          <div className="mt-6">
            <FunctionModuleConfig />
          </div>
        </div>
      )}

      {showAddModelModal && createPortal(
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
          onClick={() => setShowAddModelModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-6 w-[400px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">添加模型</h3>
              <button
                onClick={() => setShowAddModelModal(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">模型名称</label>
                <input
                  ref={addModelInputRef}
                  type="text"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmAddModel()
                    if (e.key === 'Escape') setShowAddModelModal(false)
                  }}
                  placeholder="输入模型名称..."
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowAddModelModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmAddModel}
                  disabled={!newModelName.trim()}
                  className="px-5 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  确认添加
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showAddModal && createPortal(
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-6 w-[560px] max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">新增模型提供商</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-5">
              {/* 提供商 ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">提供商ID <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newProvider.id}
                  onChange={(e) => setNewProvider(prev => ({ ...prev, id: e.target.value }))}
                  placeholder="例: myprovider"
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>

              {/* 显示名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">显示名称 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newProvider.name}
                  onChange={(e) => setNewProvider(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例如: 我的AI服务"
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>

              {/* 图标 / 图标颜色选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">图标 / 图标颜色选择</label>
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                    style={{ backgroundColor: newProvider.color }}
                  >
                    {newProvider.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {iconOptions.map((icon) => (
                        <button
                          key={icon}
                          onClick={() => setNewProvider(prev => ({ ...prev, icon }))}
                          className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                            newProvider.icon === icon
                              ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800'
                              : ''
                          }`}
                          style={{ backgroundColor: newProvider.color, color: 'white' }}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewProvider(prev => ({ ...prev, color }))}
                          className={`w-6 h-6 rounded-full transition-all ${
                            newProvider.color === color
                              ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800 scale-110'
                              : ''
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">描述</label>
                <input
                  type="text"
                  value={newProvider.description}
                  onChange={(e) => setNewProvider(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="自定义AI模型提供商"
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">API Key <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newProvider.apiKey}
                  onChange={(e) => setNewProvider(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="sk-..."
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>

              {/* API Base URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">API Base URL <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newProvider.baseUrl}
                  onChange={(e) => setNewProvider(prev => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="https://api.example.com/v1"
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>

              {/* API 格式 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">API格式 <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  {[
                    { value: 'anthropic', label: 'Anthropic 兼容' },
                    { value: 'openai', label: 'OpenAI 兼容' },
                    { value: 'google', label: 'Google 兼容' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setNewProvider(prev => ({ ...prev, apiFormat: option.value as any }))}
                      className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition-all ${
                        newProvider.apiFormat === option.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 模型列表 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  模型列表
                  <span className="text-xs text-gray-400 font-normal ml-1">(每行一个模型ID)</span>
                </label>
                <textarea
                  value={newProvider.models.join('\n')}
                  onChange={(e) => setNewProvider(prev => ({ ...prev, models: e.target.value.split('\n') }))}
                  placeholder="gpt-4o&#10;gpt-4o-mini&#10;gpt-3.5-turbo"
                  rows={4}
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    自动获取模型
                  </button>
                  <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    连通测试
                  </button>
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddProvider}
                disabled={!newProvider.id.trim() || !newProvider.name.trim() || !newProvider.apiKey.trim() || !newProvider.baseUrl.trim()}
                className="px-6 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                添加
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function WebhookField({ bot, updateBot }: { bot: IMBot; updateBot: (id: string, updates: Partial<IMBot>) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4" />
          Webhook 地址
        </div>
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={bot.webhookUrl}
          onChange={(e) => updateBot(bot.id, { webhookUrl: e.target.value })}
          placeholder={`请输入${bot.name} Webhook 地址`}
          className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
        />
        <button onClick={() => updateBot(bot.id, { webhookUrl: '' })} className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">复制当前链接到 {bot.name} 机器人配置页面，用于接收消息推送</p>
    </div>
  )
}

function SecretField({ bot, updateBot, showSecret, setShowSecret }: { bot: IMBot; updateBot: (id: string, updates: Partial<IMBot>) => void; showSecret: boolean; setShowSecret: (v: boolean) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4" />
          Secret 密钥
        </div>
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showSecret ? 'text' : 'password'}
            value={bot.secret}
            onChange={(e) => updateBot(bot.id, { secret: e.target.value })}
            placeholder="请输入 Secret 密钥"
            className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white pr-10"
          />
          <button onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button onClick={() => updateBot(bot.id, { secret: '' })} className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function IMSettings() {
  const [bots, setBots] = useState<IMBot[]>(mockIMBots)
  const [selectedBot, setSelectedBot] = useState<IMBot | null>(mockIMBots[0])
  const [showSecret, setShowSecret] = useState(false)
  const [showQrCode, setShowQrCode] = useState(false)

  const toggleBot = (id: string) => {
    setBots(bots.map(b => 
      b.id === id ? { ...b, enabled: !b.enabled } : b
    ))
    if (selectedBot?.id === id) {
      setSelectedBot(prev => prev ? { ...prev, enabled: !prev.enabled } : null)
    }
  }

  const updateBot = (id: string, updates: Partial<IMBot>) => {
    setBots(bots.map(b => 
      b.id === id ? { ...b, ...updates } : b
    ))
    if (selectedBot?.id === id) {
      setSelectedBot(prev => prev ? { ...prev, ...updates } : null)
    }
  }

  return (
    <div className="flex h-full">
      {/* 左侧 IM 机器人列表 */}
      <div className="flex-1 p-6 overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">IM 机器人</h2>
        <div className="space-y-2">
          {bots.map((bot) => (
            <div
              key={bot.id}
              onClick={() => setSelectedBot(bot)}
              className={`p-4 rounded-xl border cursor-pointer transition-all bg-white dark:bg-gray-800 ${
                selectedBot?.id === bot.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-200 dark:border-gray-700'
              } hover:border-blue-500 dark:hover:border-blue-500`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className={`w-5 h-5 ${bot.enabled ? 'text-blue-500' : 'text-gray-400'}`} />
                  <span className="font-semibold text-gray-900 dark:text-white">{bot.name}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleBot(bot.id) }}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    bot.enabled ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                      bot.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧链接设置栏 */}
      {selectedBot && (
        <div className="w-[560px] border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-blue-500" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedBot.name} 机器人设置</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                selectedBot.enabled
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {selectedBot.enabled ? '已开启' : '已关闭'}
              </span>
              <button className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                取消
              </button>
              <button className="px-6 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors flex items-center gap-2 shadow-sm">
                <Save className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {/* 飞书/钉钉/QQ/云信/小蜜蜂/POPO/龙虾邮箱/WhatsApp 专用配置 */}
            {['飞书', '钉钉', 'QQ', '云信', '小蜜蜂', 'POPO', '龙虾邮箱', 'WhatsApp'].includes(selectedBot.name) && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">App ID <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="如 cli_xxx" className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                    <button className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">App Secret <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    <input type="password" placeholder="从飞书开放平台获取" className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                    <button className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                {/* WhatsApp 专用 - Bot Token */}
                {selectedBot.name === 'WhatsApp' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bot Token <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                      <input type="password" placeholder="粘贴从 @BotFather 获取的 Token" className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                      <button className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Encrypt Key</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="可选" className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                    <button className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Verification Token</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="可选" className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                    <button className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">允许的用户</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="ou_xXx,ou_yyy" className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                    <button className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">逗号分隔。留空允许所有人。</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Webhook地址</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="请输入飞书 Webhook地址" className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                    <button className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">复制当前链接到飞书机器人配置页面，用于接收消息推送</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Secret密钥</label>
                  <div className="flex gap-2">
                    <input type="password" placeholder="请输入Secret 密钥" className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                    <button className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500" />
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">流式卡片模式</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">实时更新消息内容，体验更好</p>
                  </div>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">配对管理</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">生成配对码后在 IM 私聊中发送给 Bot，完成身份绑定。</p>
                  <button className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">生成配对码</button>
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
                    <p className="text-sm text-gray-400">暂无已配对用户</p>
                  </div>
                </div>
              </>
            )}

            {/* Telegram 专用配置 */}
            {selectedBot.name === 'Telegram' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bot Token <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    <input type="password" placeholder="粘贴从 @BotFather 获取的 Token" className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                    <button className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">允许的用户</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="如 123456789,987654321" className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                    <button className="p-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">逗号分隔。留空允许所有人。</p>
                </div>
                <WebhookField bot={selectedBot} updateBot={updateBot} />
                <SecretField bot={selectedBot} updateBot={updateBot} showSecret={showSecret} setShowSecret={setShowSecret} />
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">配对管理</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">生成配对码后在 IM 私聊中发送给 Bot，完成身份绑定。</p>
                  <button className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">生成配对码</button>
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
                    <p className="text-sm text-gray-400">暂无已配对用户</p>
                  </div>
                </div>
              </>
            )}

            {/* 扫码连接微信 - 微信和企业微信 */}
            {(selectedBot.name === '微信' || selectedBot.name === '企业微信') && (
              <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Smartphone className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">扫码连接{selectedBot.name}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">使用{selectedBot.name}扫描二维码，连接{selectedBot.name} IM 机器人</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowQrCode(true)}
                  className="w-full py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <QrCode className="w-4 h-4" />
                  扫码连接{selectedBot.name}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  使用手机{selectedBot.name}扫描二维码完成连接，在手机{selectedBot.name}弹出的页面中点击"连接"，之后等待软件连接页面刷新，连接成功后，即可通过{selectedBot.name}发送消息与 AI 对话
                </p>
              </div>
            )}

            {/* 测试链接 */}
            <button className="w-full py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4" />
              测试链接
            </button>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* 自动回复 */}
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">自动回复</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">启用后机器人将自动回复用户消息</p>
                </div>
              </div>
              <button
                onClick={() => updateBot(selectedBot.id, { autoReply: !selectedBot.autoReply })}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  selectedBot.autoReply ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    selectedBot.autoReply ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 仅 @ 提及 */}
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">仅 @ 提及</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">仅在被 @ 提及或回复时响应消息</p>
                </div>
              </div>
              <button
                onClick={() => updateBot(selectedBot.id, { mentionOnly: !selectedBot.mentionOnly })}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  selectedBot.mentionOnly ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    selectedBot.mentionOnly ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 群聊 */}
            {selectedBot.groupChat && (
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">群聊模式</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">启用后可在群聊中使用机器人</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-xs font-medium">支持</span>
              </div>
            )}
          </div>
        </div>
      )}

      {showQrCode && createPortal(
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
          onClick={() => setShowQrCode(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-8 min-w-[380px] max-w-[420px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <QrCode className="w-6 h-6 text-green-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">扫码连接微信</h3>
              </div>
              <button
                onClick={() => setShowQrCode(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="bg-white dark:bg-gray-700 rounded-xl p-6 mb-6 flex items-center justify-center border border-gray-200 dark:border-gray-600">
              <div className="w-48 h-48 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center shadow-inner">
                <QrCode className="w-32 h-32 text-white opacity-80" />
              </div>
            </div>

            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                <span>点击「<strong>扫码连接微信</strong>」按钮</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                <span>使用手机微信扫描二维码完成连接</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                <span>在手机微信弹出的页面中点击"连接"，之后等待软件连接页面刷新</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                <span className="text-green-700 dark:text-green-400 font-medium">连接成功后，即可通过微信发送消息与 AI 对话</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                二维码有效期为 5 分钟，过期后请重新点击按钮生成
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function MemorySettings() {
  const [activeMemoryTab, setActiveMemoryTab] = useState<'entries' | 'embedding'>('entries')
  const [enableEmbedding, setEnableEmbedding] = useState(false)
  const [embeddingProvider, setEmbeddingProvider] = useState('OpenAI')
  const [embeddingModel, setEmbeddingModel] = useState('')
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [semanticWeight, setSemanticWeight] = useState(0.7)
  const [showApiKey, setShowApiKey] = useState(false)

  const [memoryEntries, setMemoryEntries] = useState([
    { id: '1', content: '记忆列表内容1' },
    { id: '2', content: '记忆列表内容2' },
    { id: '3', content: '记忆列表内容3' },
  ])
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newEntryContent, setNewEntryContent] = useState('')
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 2000)
  }

  const handleAddEntry = () => {
    if (!newEntryContent.trim()) {
      showNotification('error', '请输入记忆内容')
      return
    }
    const newEntry = {
      id: Date.now().toString(),
      content: newEntryContent.trim(),
    }
    setMemoryEntries([...memoryEntries, newEntry])
    setNewEntryContent('')
    setShowAddModal(false)
    showNotification('success', '记忆条目添加成功')
  }

  const handleStartEdit = (entry: { id: string; content: string }) => {
    setEditingId(entry.id)
    setEditingContent(entry.content)
  }

  const handleSaveEdit = (id: string) => {
    if (!editingContent.trim()) {
      showNotification('error', '请输入记忆内容')
      return
    }
    setMemoryEntries(memoryEntries.map(entry =>
      entry.id === id ? { ...entry, content: editingContent.trim() } : entry
    ))
    setEditingId(null)
    setEditingContent('')
    showNotification('success', '记忆条目修改成功')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingContent('')
  }

  const handleDelete = (id: string) => {
    setMemoryEntries(memoryEntries.filter(entry => entry.id !== id))
    showNotification('success', '记忆条目删除成功')
  }

  const filteredEntries = memoryEntries.filter(entry =>
    entry.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">记忆</h2>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveMemoryTab('entries')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeMemoryTab === 'entries'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            记忆条目管理
          </button>
          <button
            onClick={() => setActiveMemoryTab('embedding')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeMemoryTab === 'embedding'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Embedding 语义搜索
          </button>
        </div>

        {activeMemoryTab === 'entries' ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            {notification && (
              <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
                notification.type === 'success' 
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              }`}>
                {notification.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {notification.message}
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">记忆条目管理</h3>
              <button 
                onClick={() => setShowAddModal(true)}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                新增条目
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">你可以在这里查看、搜索、新增、编辑或删除记忆内容。</p>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">记忆总数:</span>
              <span className="text-lg font-bold text-blue-500">{filteredEntries.length}</span>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索记忆内容/来源"
                className="w-full pl-9 pr-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            </div>

            <div className="space-y-2 mb-6">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  {editingId === entry.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-600 border border-blue-300 dark:border-blue-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(entry.id)}
                        className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                        title="保存"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                        title="取消"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-gray-900 dark:text-white">{entry.content}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartEdit(entry)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                          title="编辑"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                取消
              </button>
              <button className="px-6 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors shadow-sm">
                保存
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Embedding 语义搜索</h3>
              <button
                onClick={() => setEnableEmbedding(!enableEmbedding)}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  enableEmbedding ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    enableEmbedding ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-4 mb-6">在词法检索基础上用向量相似度重排结果，提升召回质量</p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Embedding 提供者</label>
                <select
                  value={embeddingProvider}
                  onChange={(e) => setEmbeddingProvider(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white appearance-none"
                >
                  <option value="OpenAI">OpenAI</option>
                  <option value="Gemini">Gemini</option>
                  <option value="Voyage">Voyage</option>
                  <option value="Mistral">Mistral</option>
                  <option value="Ollama">Ollama</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">选择 embedding 的运行方式</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Embedding 模型</label>
                <input
                  type="text"
                  value={embeddingModel}
                  onChange={(e) => setEmbeddingModel(e.target.value)}
                  placeholder="text-embedding-3-large"
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  留空使用提供者默认模型。如 OpenAI 默认 text-embedding-3-large，Gemini 默认 gemini-embedding-001
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">API Base URL</label>
                <input
                  type="text"
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  填写到域名/版本号即可，无需包含 /embeddings 路径。例如 https://api.openai.com/v1
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">API Key</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="输入 API Key"
                    className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white pr-10"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  用于远程 embedding 服务的 API 密钥
                </p>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sliders className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">高级设置</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">语义重排权重: {semanticWeight.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={semanticWeight}
                    onChange={(e) => setSemanticWeight(Number(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    范围 0-1，值越大越依赖 embedding 相似度，建议 0.62
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
              <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                取消
              </button>
              <button className="px-6 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors shadow-sm">
                保存
              </button>
            </div>
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md mx-4">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">新增记忆条目</h3>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setNewEntryContent('')
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">记忆内容</label>
                <textarea
                  value={newEntryContent}
                  onChange={(e) => setNewEntryContent(e.target.value)}
                  placeholder="请输入记忆内容..."
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setNewEntryContent('')
                  }}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAddEntry}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  确认添加
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RulesSettings() {
  const [includeAgentsMd, setIncludeAgentsMd] = useState(true)
  const [includeClaudeMd, setIncludeClaudeMd] = useState(true)
  const [rulesTab, setRulesTab] = useState<'global' | 'project'>('global')

  const [globalRules, setGlobalRules] = useState([
    { id: '1', content: '全局规则内容1' },
    { id: '2', content: '全局规则内容2' },
  ])

  const [projectRules, setProjectRules] = useState([
    { id: '1', content: '项目规则内容1' },
    { id: '2', content: '项目规则内容2' },
  ])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newRuleContent, setNewRuleContent] = useState('')
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 2000)
  }

  const handleAddRule = () => {
    if (!newRuleContent.trim()) {
      showNotification('error', '请输入规则内容')
      return
    }
    const newRule = {
      id: Date.now().toString(),
      content: newRuleContent.trim(),
    }
    if (rulesTab === 'global') {
      setGlobalRules([...globalRules, newRule])
    } else {
      setProjectRules([...projectRules, newRule])
    }
    setNewRuleContent('')
    setShowAddModal(false)
    showNotification('success', '规则添加成功')
  }

  const handleStartEdit = (rule: { id: string; content: string }) => {
    setEditingId(rule.id)
    setEditingContent(rule.content)
  }

  const handleSaveEdit = (id: string) => {
    if (!editingContent.trim()) {
      showNotification('error', '请输入规则内容')
      return
    }
    if (rulesTab === 'global') {
      setGlobalRules(globalRules.map(rule =>
        rule.id === id ? { ...rule, content: editingContent.trim() } : rule
      ))
    } else {
      setProjectRules(projectRules.map(rule =>
        rule.id === id ? { ...rule, content: editingContent.trim() } : rule
      ))
    }
    setEditingId(null)
    setEditingContent('')
    showNotification('success', '规则修改成功')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingContent('')
  }

  const handleDelete = (id: string) => {
    if (rulesTab === 'global') {
      setGlobalRules(globalRules.filter(rule => rule.id !== id))
    } else {
      setProjectRules(projectRules.filter(rule => rule.id !== id))
    }
    showNotification('success', '规则删除成功')
  }

  const currentRules = rulesTab === 'global' ? globalRules : projectRules

  return (
    <div className="max-w-3xl space-y-5">
      {notification && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
          notification.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
        }`}>
          {notification.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {notification.message}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">导入设置</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900 dark:text-white">将AGENTS.md包含在上下文中</span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">智能体将读取根目录中的AGENTS.md文件并将其添加到上下文中。</p>
            </div>
            <button
              onClick={() => setIncludeAgentsMd(!includeAgentsMd)}
              className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                includeAgentsMd ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                  includeAgentsMd ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900 dark:text-white">将CLAUDE.md包含在上下文中</span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">智能体将读取根目录中的CLAUDE.md和CLAUDE.local.md文件并将其添加到上下文中。</p>
            </div>
            <button
              onClick={() => setIncludeClaudeMd(!includeClaudeMd)}
              className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                includeClaudeMd ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                  includeClaudeMd ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">规则</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">创建并管理规则，在聊天过程中遵循这些规则。</p>
          </div>
          <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setRulesTab('global')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              rulesTab === 'global'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            全局
          </button>
          <button
            onClick={() => setRulesTab('project')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              rulesTab === 'project'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            项目
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {rulesTab === 'global' ? '全局' : '项目'}
            </span>
            <button 
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              创建
            </button>
          </div>

          {currentRules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              {editingId === rule.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-600 border border-blue-300 dark:border-blue-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveEdit(rule.id)}
                    className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                    title="保存"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                    title="取消"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm text-gray-900 dark:text-white">{rule.content}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartEdit(rule)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                      title="编辑"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">创建规则</h3>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewRuleContent('')
                }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">规则内容</label>
              <textarea
                value={newRuleContent}
                onChange={(e) => setNewRuleContent(e.target.value)}
                placeholder="请输入规则内容..."
                rows={4}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewRuleContent('')
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddRule}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type PeriodType = 'today' | 'week' | 'month' | 'quarter' | 'year'

const periodLabels: Record<PeriodType, string> = {
  today: '今日',
  week: '本周',
  month: '本月',
  quarter: '本季',
  year: '年度',
}

interface ProviderCost {
  name: string
  totalTokens: number
  inputTokens: number
  outputTokens: number
  requests: number
  toolCalls: number
  webSearch: number
  cost: number
  price: string
  codingPlan: boolean
  color: string
}

const mockPeriodData: Record<PeriodType, { dailyData: { date: string; cost: number; tokens: number; inputTokens: number; outputTokens: number }[]; providers: ProviderCost[]; summary: { totalTokens: number; inputTokens: number; outputTokens: number; requests: number; toolCalls: number; webSearch: number; totalCost: number } }> = {
  today: {
    dailyData: Array.from({ length: 24 }, (_, i) => ({ date: `${i}:00`, cost: Math.random() * 0.5 + 0.1, tokens: Math.floor(Math.random() * 5000 + 1000), inputTokens: Math.floor(Math.random() * 3000 + 500), outputTokens: Math.floor(Math.random() * 2000 + 300) })),
    providers: [
      { name: 'DeepSeek', totalTokens: 185000, inputTokens: 120000, outputTokens: 65000, requests: 89, toolCalls: 156, webSearch: 12, cost: 0.85, price: '¥2.5/M tokens', codingPlan: false, color: '#2563eb' },
      { name: 'Qwen', totalTokens: 96000, inputTokens: 62000, outputTokens: 34000, requests: 45, toolCalls: 78, webSearch: 8, cost: 0.42, price: '¥1.8/M tokens', codingPlan: false, color: '#a855f7' },
      { name: 'GPT-4o Mini', totalTokens: 45000, inputTokens: 28000, outputTokens: 17000, requests: 22, toolCalls: 35, webSearch: 5, cost: 0.38, price: '¥3.2/M tokens', codingPlan: false, color: '#10b981' },
    ],
    summary: { totalTokens: 326000, inputTokens: 210000, outputTokens: 116000, requests: 156, toolCalls: 269, webSearch: 25, totalCost: 1.65 },
  },
  week: {
    dailyData: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i)); return { date: `${d.getMonth() + 1}/${d.getDate()}`, cost: Math.random() * 3 + 0.5, tokens: Math.floor(Math.random() * 50000 + 10000), inputTokens: Math.floor(Math.random() * 30000 + 5000), outputTokens: Math.floor(Math.random() * 20000 + 3000) };
    }),
    providers: [
      { name: 'DeepSeek', totalTokens: 1250000, inputTokens: 820000, outputTokens: 430000, requests: 623, toolCalls: 1120, webSearch: 85, cost: 5.85, price: '¥2.5/M tokens', codingPlan: false, color: '#2563eb' },
      { name: 'Qwen', totalTokens: 680000, inputTokens: 440000, outputTokens: 240000, requests: 334, toolCalls: 580, webSearch: 42, cost: 3.12, price: '¥1.8/M tokens', codingPlan: false, color: '#a855f7' },
      { name: 'GPT-4o Mini', totalTokens: 320000, inputTokens: 200000, outputTokens: 120000, requests: 158, toolCalls: 260, webSearch: 28, cost: 2.75, price: '¥3.2/M tokens', codingPlan: false, color: '#10b981' },
      { name: 'MiniMax', totalTokens: 156000, inputTokens: 98000, outputTokens: 58000, requests: 76, toolCalls: 130, webSearch: 15, cost: 0.98, price: '¥1.5/M tokens', codingPlan: true, color: '#ec4899' },
    ],
    summary: { totalTokens: 2406000, inputTokens: 1558000, outputTokens: 848000, requests: 1191, toolCalls: 2090, webSearch: 170, totalCost: 12.70 },
  },
  month: {
    dailyData: Array.from({ length: 30 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (29 - i)); return { date: `${d.getMonth() + 1}/${d.getDate()}`, cost: Math.random() * 4 + 0.3, tokens: Math.floor(Math.random() * 60000 + 8000), inputTokens: Math.floor(Math.random() * 40000 + 4000), outputTokens: Math.floor(Math.random() * 20000 + 2000) };
    }),
    providers: [
      { name: 'DeepSeek', totalTokens: 5200000, inputTokens: 3400000, outputTokens: 1800000, requests: 2560, toolCalls: 4850, webSearch: 380, cost: 24.50, price: '¥2.5/M tokens', codingPlan: false, color: '#2563eb' },
      { name: 'Qwen', totalTokens: 2800000, inputTokens: 1800000, outputTokens: 1000000, requests: 1380, toolCalls: 2520, webSearch: 195, cost: 12.80, price: '¥1.8/M tokens', codingPlan: false, color: '#a855f7' },
      { name: 'GPT-4o Mini', totalTokens: 1350000, inputTokens: 850000, outputTokens: 500000, requests: 670, toolCalls: 1150, webSearch: 110, cost: 11.50, price: '¥3.2/M tokens', codingPlan: true, color: '#10b981' },
      { name: 'MiniMax', totalTokens: 650000, inputTokens: 420000, outputTokens: 230000, requests: 320, toolCalls: 560, webSearch: 65, cost: 4.20, price: '¥1.5/M tokens', codingPlan: true, color: '#ec4899' },
      { name: 'Volcengine', totalTokens: 380000, inputTokens: 240000, outputTokens: 140000, requests: 190, toolCalls: 320, webSearch: 40, cost: 2.45, price: '¥1.2/M tokens', codingPlan: false, color: '#06b6d4' },
    ],
    summary: { totalTokens: 10380000, inputTokens: 6710000, outputTokens: 3670000, requests: 5120, toolCalls: 9400, webSearch: 790, totalCost: 55.45 },
  },
  quarter: {
    dailyData: Array.from({ length: 90 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (89 - i));
      const weekNum = Math.floor(i / 7) + 1;
      return { date: i % 7 === 0 ? `W${weekNum}` : '', cost: Math.random() * 5 + 0.5, tokens: Math.floor(Math.random() * 70000 + 10000), inputTokens: Math.floor(Math.random() * 45000 + 5000), outputTokens: Math.floor(Math.random() * 25000 + 3000) };
    }).filter(d => d.date !== ''),
    providers: [
      { name: 'DeepSeek', totalTokens: 15000000, inputTokens: 9800000, outputTokens: 5200000, requests: 7500, toolCalls: 14200, webSearch: 1150, cost: 71.20, price: '¥2.5/M tokens', codingPlan: false, color: '#2563eb' },
      { name: 'Qwen', totalTokens: 8200000, inputTokens: 5300000, outputTokens: 2900000, requests: 4100, toolCalls: 7500, webSearch: 580, cost: 36.80, price: '¥1.8/M tokens', codingPlan: false, color: '#a855f7' },
      { name: 'GPT-4o Mini', totalTokens: 4000000, inputTokens: 2500000, outputTokens: 1500000, requests: 2000, toolCalls: 3500, webSearch: 320, cost: 33.50, price: '¥3.2/M tokens', codingPlan: true, color: '#10b981' },
      { name: 'MiniMax', totalTokens: 1900000, inputTokens: 1200000, outputTokens: 700000, requests: 950, toolCalls: 1680, webSearch: 190, cost: 12.00, price: '¥1.5/M tokens', codingPlan: true, color: '#ec4899' },
      { name: 'Volcengine', totalTokens: 1100000, inputTokens: 700000, outputTokens: 400000, requests: 560, toolCalls: 980, webSearch: 110, cost: 7.20, price: '¥1.2/M tokens', codingPlan: false, color: '#06b6d4' },
    ],
    summary: { totalTokens: 30200000, inputTokens: 19500000, outputTokens: 10700000, requests: 15110, toolCalls: 27860, webSearch: 2350, totalCost: 160.70 },
  },
  year: {
    dailyData: Array.from({ length: 12 }, (_, i) => ({ date: `${i + 1}月`, cost: Math.random() * 30 + 10, tokens: Math.floor(Math.random() * 500000 + 100000), inputTokens: Math.floor(Math.random() * 300000 + 50000), outputTokens: Math.floor(Math.random() * 200000 + 30000) })),
    providers: [
      { name: 'DeepSeek', totalTokens: 62000000, inputTokens: 40000000, outputTokens: 22000000, requests: 31000, toolCalls: 58000, webSearch: 4800, cost: 295.00, price: '¥2.5/M tokens', codingPlan: false, color: '#2563eb' },
      { name: 'Qwen', totalTokens: 34000000, inputTokens: 22000000, outputTokens: 12000000, requests: 17000, toolCalls: 31000, webSearch: 2400, cost: 152.00, price: '¥1.8/M tokens', codingPlan: false, color: '#a855f7' },
      { name: 'GPT-4o Mini', totalTokens: 16800000, inputTokens: 10500000, outputTokens: 6300000, requests: 8400, toolCalls: 14800, webSearch: 1350, cost: 141.00, price: '¥3.2/M tokens', codingPlan: true, color: '#10b981' },
      { name: 'MiniMax', totalTokens: 7800000, inputTokens: 5000000, outputTokens: 2800000, requests: 3900, toolCalls: 6900, webSearch: 780, cost: 49.00, price: '¥1.5/M tokens', codingPlan: true, color: '#ec4899' },
      { name: 'Volcengine', totalTokens: 4500000, inputTokens: 2800000, outputTokens: 1700000, requests: 2300, toolCalls: 4000, webSearch: 460, cost: 29.50, price: '¥1.2/M tokens', codingPlan: false, color: '#06b6d4' },
    ],
    summary: { totalTokens: 125100000, inputTokens: 80300000, outputTokens: 44800000, requests: 62600, toolCalls: 114700, webSearch: 9790, totalCost: 666.50 },
  },
}

function CostSettings() {
  const [period, setPeriod] = useState<PeriodType>('today')
  const [viewMode, setViewMode] = useState<'period' | 'history'>('period')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')
  const [providersData, setProvidersData] = useState<Record<string, ProviderCost[]>>(() => {
    const initial: Record<string, ProviderCost[]> = {}
    for (const key of Object.keys(mockPeriodData) as PeriodType[]) {
      initial[key] = mockPeriodData[key].providers.map(p => ({ ...p }))
    }
    return initial
  })
  const [editingPrice, setEditingPrice] = useState<string | null>(null)
  const [editPriceValue, setEditPriceValue] = useState('')

  const data = mockPeriodData[period]
  const currentProviders = providersData[period] || data.providers

  const toggleCodingPlan = (providerName: string) => {
    setProvidersData(prev => ({
      ...prev,
      [period]: prev[period].map(p =>
        p.name === providerName ? { ...p, codingPlan: !p.codingPlan } : p
      )
    }))
  }

  const startEditPrice = (providerName: string, currentPrice: string) => {
    setEditingPrice(providerName)
    setEditPriceValue(currentPrice)
  }

  const saveEditPrice = (providerName: string) => {
    setProvidersData(prev => ({
      ...prev,
      [period]: prev[period].map(p =>
        p.name === providerName ? { ...p, price: editPriceValue } : p
      )
    }))
    setEditingPrice(null)
  }

  const cancelEditPrice = () => {
    setEditingPrice(null)
  }

  const [historyProviders, setHistoryProviders] = useState<ProviderCost[]>([
    { name: 'DeepSeek', totalTokens: 980000, inputTokens: 640000, outputTokens: 340000, requests: 445, toolCalls: 820, webSearch: 62, cost: 4.58, price: '¥2.5/M tokens', codingPlan: false, color: '#2563eb' },
    { name: 'Qwen', totalTokens: 520000, inputTokens: 340000, outputTokens: 180000, requests: 260, toolCalls: 470, webSearch: 38, cost: 2.85, price: '¥1.8/M tokens', codingPlan: false, color: '#a855f7' },
    { name: 'GPT-4o Mini', totalTokens: 250000, inputTokens: 160000, outputTokens: 90000, requests: 125, toolCalls: 215, webSearch: 28, cost: 2.42, price: '¥3.2/M tokens', codingPlan: true, color: '#10b981' },
  ])

  const toggleHistCodingPlan = (providerName: string) => {
    setHistoryProviders(prev => prev.map(p =>
      p.name === providerName ? { ...p, codingPlan: !p.codingPlan } : p
    ))
  }

  const saveHistEditPrice = (providerName: string) => {
    setHistoryProviders(prev => prev.map(p =>
      p.name === providerName ? { ...p, price: editPriceValue } : p
    ))
    setEditingPrice(null)
  }
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const handleHistoryQuery = () => {
    // 执行历史查询 - 后续可对接真实API数据
  }

  const METRIC_OPTIONS = [
    { key: 'cost', label: '总费用（柱）', color: '#f59e0b' },
    { key: 'totalTokens', label: '总token量（柱）', color: '#8b5cf6' },
    { key: 'inputTokens', label: '输入量（柱）', color: '#3b82f6' },
    { key: 'outputTokens', label: '输出量（柱）', color: '#10b981' },
    { key: 'requests', label: '请求次数（柱）', color: '#ec4899' },
    { key: 'toolCalls', label: '调工具次数（柱）', color: '#06b6d4' },
  ]

  const PERIOD_METRIC_OPTIONS = [
    { key: 'cost', label: '总费用（线）', color: '#f59e0b' },
    { key: 'totalTokens', label: '总token量（柱）', color: '#8b5cf6' },
    { key: 'inputTokens', label: '输入量（柱）', color: '#3b82f6' },
    { key: 'outputTokens', label: '输出量（柱）', color: '#10b981' },
    { key: 'requests', label: '请求次数（柱）', color: '#ec4899' },
    { key: 'toolCalls', label: '调工具次数（柱）', color: '#06b6d4' },
  ]

  const [histChartMetrics, setHistChartMetrics] = useState<Set<string>>(new Set(['totalTokens', 'inputTokens', 'outputTokens', 'cost']))
  const [showHistMetricMenu, setShowHistMetricMenu] = useState(false)
  const [tempHistMetrics, setTempHistMetrics] = useState<Set<string>>(new Set(['totalTokens', 'inputTokens', 'outputTokens', 'cost']))
  const histMetricBtnRef = useRef<HTMLButtonElement>(null)

  const [periodChartMetrics, setPeriodChartMetrics] = useState<Set<string>>(new Set(['totalTokens', 'inputTokens', 'outputTokens', 'cost']))
  const [showPeriodMetricMenu, setShowPeriodMetricMenu] = useState(false)
  const [tempPeriodMetrics, setTempPeriodMetrics] = useState<Set<string>>(new Set(['totalTokens', 'inputTokens', 'outputTokens', 'cost']))
  const periodMetricBtnRef = useRef<HTMLButtonElement>(null)

  const [periodProviderCharts, setPeriodProviderCharts] = useState<Set<string>>(new Set(['DeepSeek', 'Qwen']))
  const [showPeriodProviderMenu, setShowPeriodProviderMenu] = useState(false)
  const [tempPeriodProviders, setTempPeriodProviders] = useState<Set<string>>(new Set(['DeepSeek', 'Qwen']))
  const periodProviderBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      let shouldClose = true
      if (showHistMetricMenu) {
        const btn = histMetricBtnRef.current
        const menu = document.querySelector('[data-menu="hist-metric"]')
        if (btn?.contains(target) || menu?.contains(target)) shouldClose = false
      }
      if (showPeriodMetricMenu) {
        const btn = periodMetricBtnRef.current
        const menu = document.querySelector('[data-menu="period-metric"]')
        if (btn?.contains(target) || menu?.contains(target)) shouldClose = false
      }
      if (showPeriodProviderMenu) {
        const btn = periodProviderBtnRef.current
        const menu = document.querySelector('[data-menu="period-provider"]')
        if (btn?.contains(target) || menu?.contains(target)) shouldClose = false
      }
      if (shouldClose) {
        setShowHistMetricMenu(false)
        setShowPeriodMetricMenu(false)
        setShowPeriodProviderMenu(false)
      }
    }
    if (showHistMetricMenu || showPeriodMetricMenu || showPeriodProviderMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showHistMetricMenu, showPeriodMetricMenu, showPeriodProviderMenu])

  const renderPeriodContent = () => (
    <>
      {/* 概览统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">总 Token</span>
          <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{formatNumber(data.summary.totalTokens)}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">输入量</span>
          <div className="mt-1 text-lg font-bold text-blue-500">{formatNumber(data.summary.inputTokens)}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">输出量</span>
          <div className="mt-1 text-lg font-bold text-green-500">{formatNumber(data.summary.outputTokens)}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">请求次数</span>
          <div className="mt-1 text-lg font-bold text-purple-500">{formatNumber(data.summary.requests)}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">工具调用</span>
          <div className="mt-1 text-lg font-bold text-cyan-500">{formatNumber(data.summary.toolCalls)}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">网络搜索</span>
          <div className="mt-1 text-lg font-bold text-yellow-500">{formatNumber(data.summary.webSearch)}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">总费用</span>
          <div className="mt-1 text-lg font-bold text-orange-500">${data.summary.totalCost.toFixed(2)}</div>
        </div>
      </div>

      {/* 图表：费用曲线 + Token柱状图 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">费用趋势 & Token 用量</h3>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.dailyData}>
              <defs>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => `$${v.toFixed(1)}`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => formatNumber(v)} />
              <Tooltip />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="cost" stroke="#3b82f6" fill="url(#colorCost)" strokeWidth={2} name="费用" />
              <Bar yAxisId="right" dataKey="tokens" fill="#8b5cf6" radius={[2, 2, 0, 0]} barSize={8} name="总Token" />
              <Bar yAxisId="right" dataKey="inputTokens" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={8} name="输入量" />
              <Bar yAxisId="right" dataKey="outputTokens" fill="#10b981" radius={[2, 2, 0, 0]} barSize={8} name="输出量" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 各提供商费用 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">各提供商消费明细</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">提供商</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">总 Token</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">输入量</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">输出量</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">请求次数</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">工具调用</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">网络搜索</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">价格</th>
                <th className="text-center py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">CodingPlan</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">消费金额</th>
              </tr>
            </thead>
            <tbody>
              {currentProviders.map((p, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.totalTokens)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.inputTokens)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.outputTokens)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.requests)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.toolCalls)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.webSearch)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">
                    {editingPrice === p.name ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="text"
                          value={editPriceValue}
                          onChange={(e) => setEditPriceValue(e.target.value)}
                          className="w-28 px-2 py-1 bg-white dark:bg-gray-700 border border-blue-500 rounded text-xs text-gray-900 dark:text-white focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditPrice(p.name); if (e.key === 'Escape') cancelEditPrice(); }}
                        />
                        <button onClick={() => saveEditPrice(p.name)} className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded">
                          <Check className="w-3 h-3" />
                        </button>
                        <button onClick={cancelEditPrice} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditPrice(p.name, p.price)}
                        className="text-xs text-gray-600 dark:text-gray-300 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 px-1.5 py-0.5 rounded transition-colors"
                        title="点击编辑价格"
                      >
                        {p.price}
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <button
                      onClick={() => toggleCodingPlan(p.name)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        p.codingPlan
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                      title={p.codingPlan ? '点击切换为按量计费' : '点击切换为CodingPlan计费'}
                    >
                      {p.codingPlan ? 'CodingPlan' : '按量'}
                    </button>
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-gray-900 dark:text-white">${p.cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 历史提供商消费对比 - 可配置指标 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">历史提供商消费对比</h3>
          <div className="relative">
            <button ref={histMetricBtnRef} onClick={() => { setShowHistMetricMenu(v => !v); if (!showHistMetricMenu) setTempHistMetrics(new Set(histChartMetrics)) }}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <TrendingUp className="w-3 h-3" />显示指标 <ChevronDown className="w-3 h-3" />
            </button>
            {showHistMetricMenu && createPortal(
              <div data-menu="hist-metric" className="fixed z-[99999] w-[200px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1.5 px-3 shadow-xl" style={{
                top: histMetricBtnRef.current ? histMetricBtnRef.current.getBoundingClientRect().bottom + 4 : 0,
                left: histMetricBtnRef.current ? Math.min(histMetricBtnRef.current.getBoundingClientRect().left, window.innerWidth - 210) : 0,
              }}>
                <label className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer border-b border-gray-100 dark:border-gray-700 mb-1">
                  <input type="checkbox" checked={tempHistMetrics.size === METRIC_OPTIONS.length}
                    onChange={() => { if (tempHistMetrics.size === METRIC_OPTIONS.length) setTempHistMetrics(new Set()); else setTempHistMetrics(new Set(METRIC_OPTIONS.map(m => m.key))) }}
                    className="h-3 w-3 rounded accent-blue-500" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">全选</span>
                </label>
                {METRIC_OPTIONS.map(m => (
                  <label key={m.key} className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={tempHistMetrics.has(m.key)}
                      onChange={() => { const n = new Set(tempHistMetrics); if (n.has(m.key)) n.delete(m.key); else n.add(m.key); setTempHistMetrics(n) }}
                      className="h-3 w-3 rounded accent-blue-500" />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="text-gray-700 dark:text-gray-300">{m.label}</span>
                  </label>
                ))}
                <div className="flex gap-2 border-t border-gray-100 dark:border-gray-700 pt-2 mt-1">
                  <button onClick={() => { setShowHistMetricMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600">取消</button>
                  <button onClick={() => { setHistChartMetrics(new Set(tempHistMetrics)); setShowHistMetricMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
                </div>
              </div>, document.body)}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={currentProviders.map(p => ({
              name: p.name,
              ...METRIC_OPTIONS.reduce((acc, m) => ({ ...acc, [m.label]: m.key === 'cost' ? Number(Number(p[m.key as keyof ProviderCost]).toFixed(2)) : p[m.key as keyof ProviderCost] }), {}),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => `$${v}`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip />
              <Legend />
              {METRIC_OPTIONS.filter(m => histChartMetrics.has(m.key)).map(m => (
                <Bar key={m.key} yAxisId={m.key === 'cost' ? 'left' : (m.key === 'requests' || m.key === 'toolCalls' ? 'count' : 'right')} dataKey={m.label} fill={m.color} radius={[4, 4, 0, 0]} barSize={12} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 各提供商历史消费 - 多周期对比 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">各提供商历史消费</h3>
          <div className="relative">
            <button ref={periodMetricBtnRef} onClick={() => { setShowPeriodMetricMenu(v => !v); if (!showPeriodMetricMenu) setTempPeriodMetrics(new Set(periodChartMetrics)) }}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <BarChart className="w-3 h-3 inline" />显示指标 <ChevronDown className="w-3 h-3" />
            </button>
            {showPeriodMetricMenu && createPortal(
              <div data-menu="period-metric" className="fixed z-[99999] w-[200px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1.5 px-3 shadow-xl" style={{
                top: periodMetricBtnRef.current ? periodMetricBtnRef.current.getBoundingClientRect().bottom + 4 : 0,
                left: periodMetricBtnRef.current ? Math.min(periodMetricBtnRef.current.getBoundingClientRect().left, window.innerWidth - 210) : 0,
              }}>
                <label className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer border-b border-gray-100 dark:border-gray-700 mb-1">
                  <input type="checkbox" checked={tempPeriodMetrics.size === PERIOD_METRIC_OPTIONS.length}
                    onChange={() => { if (tempPeriodMetrics.size === PERIOD_METRIC_OPTIONS.length) setTempPeriodMetrics(new Set()); else setTempPeriodMetrics(new Set(PERIOD_METRIC_OPTIONS.map(m => m.key))) }}
                    className="h-3 w-3 rounded accent-blue-500" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">全选</span>
                </label>
                {PERIOD_METRIC_OPTIONS.map(m => (
                  <label key={m.key} className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={tempPeriodMetrics.has(m.key)}
                      onChange={() => { const n = new Set(tempPeriodMetrics); if (n.has(m.key)) n.delete(m.key); else n.add(m.key); setTempPeriodMetrics(n) }}
                      className="h-3 w-3 rounded accent-blue-500" />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="text-gray-700 dark:text-gray-300">{m.label}</span>
                  </label>
                ))}
                <div className="flex gap-2 border-t border-gray-100 dark:border-gray-700 pt-2 mt-1">
                  <button onClick={() => { setShowPeriodMetricMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600">取消</button>
                  <button onClick={() => { setPeriodChartMetrics(new Set(tempPeriodMetrics)); setShowPeriodMetricMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
                </div>
              </div>, document.body)}
          </div>
          <div className="relative">
            <button ref={periodProviderBtnRef} onClick={() => { setShowPeriodProviderMenu(v => !v); if (!showPeriodProviderMenu) setTempPeriodProviders(new Set(periodProviderCharts)) }}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <BarChart className="w-3 h-3 inline" />选择提供商 <ChevronDown className="w-3 h-3" />
            </button>
            {showPeriodProviderMenu && createPortal(
              <div data-menu="period-provider" className="fixed z-[99999] w-[200px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1.5 px-3 shadow-xl" style={{
                top: periodProviderBtnRef.current ? periodProviderBtnRef.current.getBoundingClientRect().bottom + 4 : 0,
                left: periodProviderBtnRef.current ? Math.min(periodProviderBtnRef.current.getBoundingClientRect().left, window.innerWidth - 210) : 0,
              }}>
                <label className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer border-b border-gray-100 dark:border-gray-700 mb-1">
                  <input type="checkbox" checked={tempPeriodProviders.size === data.providers.length}
                    onChange={() => { if (tempPeriodProviders.size === data.providers.length) setTempPeriodProviders(new Set()); else setTempPeriodProviders(new Set(data.providers.map(p => p.name))) }}
                    className="h-3 w-3 rounded accent-blue-500" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">全选</span>
                </label>
                {data.providers.map(p => (
                  <label key={p.name} className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={tempPeriodProviders.has(p.name)}
                      onChange={() => { const n = new Set(tempPeriodProviders); if (n.has(p.name)) n.delete(p.name); else n.add(p.name); setTempPeriodProviders(n) }}
                      className="h-3 w-3 rounded accent-blue-500" />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-gray-700 dark:text-gray-300">{p.name}</span>
                  </label>
                ))}
                <div className="flex gap-2 border-t border-gray-100 dark:border-gray-700 pt-2 mt-1">
                  <button onClick={() => { setShowPeriodProviderMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600">取消</button>
                  <button onClick={() => { setPeriodProviderCharts(new Set(tempPeriodProviders)); setShowPeriodProviderMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
                </div>
              </div>, document.body)}
          </div>
        </div>
        <div className="space-y-6 max-h-[700px] overflow-y-auto">
          {data.providers.filter(p => periodProviderCharts.has(p.name)).slice(0, 5).map((provider) => {
            const periodData = (Object.keys(periodLabels) as PeriodType[]).map(periodKey => {
              const pData = mockPeriodData[periodKey as PeriodType].providers.find(p => p.name === provider.name)
              return {
                period: periodLabels[periodKey as PeriodType],
                totalTokens: pData?.totalTokens || 0,
                inputTokens: pData?.inputTokens || 0,
                outputTokens: pData?.outputTokens || 0,
                requests: pData?.requests || 0,
                toolCalls: pData?.toolCalls || 0,
                cost: pData?.cost || 0,
              }
            })
            return (
              <div key={provider.name}>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: provider.color }} />
                  {provider.name}
                </h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={periodData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={(v) => `$${v.toFixed(2)}`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={v => formatNumber(v)} />
                      <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <Tooltip />
                      <Legend />
                      {periodChartMetrics.has('totalTokens') && <Bar yAxisId="right" dataKey="totalTokens" fill="#8b5cf6" radius={[2, 2, 0, 0]} barSize={10} name="总token量（柱）" />}
                      {periodChartMetrics.has('inputTokens') && <Bar yAxisId="right" dataKey="inputTokens" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={10} name="输入量（柱）" />}
                      {periodChartMetrics.has('outputTokens') && <Bar yAxisId="right" dataKey="outputTokens" fill="#10b981" radius={[2, 2, 0, 0]} barSize={10} name="输出量（柱）" />}
                      {periodChartMetrics.has('requests') && <Bar yAxisId="count" dataKey="requests" fill="#ec4899" radius={[2, 2, 0, 0]} barSize={10} name="请求次数（柱）" />}
                      {periodChartMetrics.has('toolCalls') && <Bar yAxisId="count" dataKey="toolCalls" fill="#06b6d4" radius={[2, 2, 0, 0]} barSize={10} name="调工具次数（柱）" />}
                      {periodChartMetrics.has('cost') && <Line yAxisId="left" type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2} name="总费用（线）" dot={{ r: 3 }} />}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )

  const renderHistoryContent = () => (
    <>
      {/* 概览统计卡片（历史查询mock数据） */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">总 Token</span>
          <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white">1.8M</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">输入量</span>
          <div className="mt-1 text-lg font-bold text-blue-500">1.2M</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">输出量</span>
          <div className="mt-1 text-lg font-bold text-green-500">600K</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">请求次数</span>
          <div className="mt-1 text-lg font-bold text-purple-500">892</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">工具调用</span>
          <div className="mt-1 text-lg font-bold text-cyan-500">1.5K</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">网络搜索</span>
          <div className="mt-1 text-lg font-bold text-yellow-500">128</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">总费用</span>
          <div className="mt-1 text-lg font-bold text-orange-500">$9.85</div>
        </div>
      </div>

      {/* 历史数据图表 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">历史费用趋势 & Token 用量</h3>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={Array.from({ length: 7 }, (_, i) => {
              const d = new Date(historyFrom || Date.now()); d.setDate(d.getDate() + i);
              return { date: `${d.getMonth() + 1}/${d.getDate()}`, cost: Math.random() * 2 + 0.5, tokens: Math.floor(Math.random() * 30000 + 5000), inputTokens: Math.floor(Math.random() * 20000 + 2000), outputTokens: Math.floor(Math.random() * 10000 + 1000) };
            })}>
              <defs>
                <linearGradient id="colorHistCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => `$${v.toFixed(1)}`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => formatNumber(v)} />
              <Tooltip />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="cost" stroke="#f59e0b" fill="url(#colorHistCost)" strokeWidth={2} name="费用" />
              <Bar yAxisId="right" dataKey="tokens" fill="#8b5cf6" radius={[2, 2, 0, 0]} barSize={8} name="总Token" />
              <Bar yAxisId="right" dataKey="inputTokens" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={8} name="输入量" />
              <Bar yAxisId="right" dataKey="outputTokens" fill="#10b981" radius={[2, 2, 0, 0]} barSize={8} name="输出量" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 历史各提供商明细 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">历史各提供商消费明细</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">提供商</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">总 Token</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">输入量</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">输出量</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">请求次数</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">工具调用</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">网络搜索</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">价格</th>
                <th className="text-center py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">CodingPlan</th>
                <th className="text-right py-3 px-2 text-gray-500 dark:text-gray-400 font-medium">消费金额</th>
              </tr>
            </thead>
            <tbody>
              {historyProviders.map((p, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.totalTokens)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.inputTokens)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.outputTokens)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.requests)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.toolCalls)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">{formatNumber(p.webSearch)}</td>
                  <td className="py-3 px-2 text-right text-gray-700 dark:text-gray-300">
                    {editingPrice === `hist-${p.name}` ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="text"
                          value={editPriceValue}
                          onChange={(e) => setEditPriceValue(e.target.value)}
                          className="w-28 px-2 py-1 bg-white dark:bg-gray-700 border border-blue-500 rounded text-xs text-gray-900 dark:text-white focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') saveHistEditPrice(p.name); if (e.key === 'Escape') cancelEditPrice(); }}
                        />
                        <button onClick={() => saveHistEditPrice(p.name)} className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded">
                          <Check className="w-3 h-3" />
                        </button>
                        <button onClick={cancelEditPrice} className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingPrice(`hist-${p.name}`); setEditPriceValue(p.price); }}
                        className="text-xs text-gray-600 dark:text-gray-300 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 px-1.5 py-0.5 rounded transition-colors"
                        title="点击编辑价格"
                      >
                        {p.price}
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <button
                      onClick={() => toggleHistCodingPlan(p.name)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        p.codingPlan
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {p.codingPlan ? 'CodingPlan' : '按量'}
                    </button>
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-gray-900 dark:text-white">${p.cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 历史费用柱状图 - 多选指标 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">历史提供商消费对比</h3>
          <div className="relative">
            <button ref={histMetricBtnRef} onClick={() => { setShowHistMetricMenu(v => !v); if (!showHistMetricMenu) setTempHistMetrics(new Set(histChartMetrics)) }}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <TrendingUp className="w-3 h-3" />显示指标 <ChevronDown className="w-3 h-3" />
            </button>
            {showHistMetricMenu && createPortal(
              <div data-menu="hist-metric" className="fixed z-[99999] w-[200px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1.5 px-3 shadow-xl" style={{
                top: histMetricBtnRef.current ? histMetricBtnRef.current.getBoundingClientRect().bottom + 4 : 0,
                left: histMetricBtnRef.current ? Math.min(histMetricBtnRef.current.getBoundingClientRect().left, window.innerWidth - 210) : 0,
              }}>
                <label className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer border-b border-gray-100 dark:border-gray-700 mb-1">
                  <input type="checkbox" checked={tempHistMetrics.size === METRIC_OPTIONS.length}
                    onChange={() => { if (tempHistMetrics.size === METRIC_OPTIONS.length) setTempHistMetrics(new Set()); else setTempHistMetrics(new Set(METRIC_OPTIONS.map(m => m.key))) }}
                    className="h-3 w-3 rounded accent-blue-500" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">全选</span>
                </label>
                {METRIC_OPTIONS.map(m => (
                  <label key={m.key} className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={tempHistMetrics.has(m.key)}
                      onChange={() => { const n = new Set(tempHistMetrics); if (n.has(m.key)) n.delete(m.key); else n.add(m.key); setTempHistMetrics(n) }}
                      className="h-3 w-3 rounded accent-blue-500" />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="text-gray-700 dark:text-gray-300">{m.label}</span>
                  </label>
                ))}
                <div className="flex gap-2 border-t border-gray-100 dark:border-gray-700 pt-2 mt-1">
                  <button onClick={() => { setShowHistMetricMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600">取消</button>
                  <button onClick={() => { setHistChartMetrics(new Set(tempHistMetrics)); setShowHistMetricMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
                </div>
              </div>, document.body)}
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={historyProviders.map(p => ({
              name: p.name,
              ...METRIC_OPTIONS.reduce((acc, m) => ({ ...acc, [m.label]: m.key === 'cost' ? Number(Number(p[m.key as keyof ProviderCost]).toFixed(2)) : p[m.key as keyof ProviderCost] }), {}),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => `$${v}`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip />
              <Legend />
              {METRIC_OPTIONS.filter(m => histChartMetrics.has(m.key)).map(m => (
                <Bar key={m.key} yAxisId={m.key === 'cost' ? 'left' : (m.key === 'requests' || m.key === 'toolCalls' ? 'count' : 'right')} dataKey={m.label} fill={m.color} radius={[4, 4, 0, 0]} barSize={12} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 各提供商历史消费 - 多周期对比 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">各提供商历史消费</h3>
          <div className="relative">
            <button ref={periodMetricBtnRef} onClick={() => { setShowPeriodMetricMenu(v => !v); if (!showPeriodMetricMenu) setTempPeriodMetrics(new Set(periodChartMetrics)) }}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <BarChart className="w-3 h-3 inline" />显示指标 <ChevronDown className="w-3 h-3" />
            </button>
            {showPeriodMetricMenu && createPortal(
              <div data-menu="period-metric" className="fixed z-[99999] w-[200px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1.5 px-3 shadow-xl" style={{
                top: periodMetricBtnRef.current ? periodMetricBtnRef.current.getBoundingClientRect().bottom + 4 : 0,
                left: periodMetricBtnRef.current ? Math.min(periodMetricBtnRef.current.getBoundingClientRect().left, window.innerWidth - 210) : 0,
              }}>
                <label className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer border-b border-gray-100 dark:border-gray-700 mb-1">
                  <input type="checkbox" checked={tempPeriodMetrics.size === PERIOD_METRIC_OPTIONS.length}
                    onChange={() => { if (tempPeriodMetrics.size === PERIOD_METRIC_OPTIONS.length) setTempPeriodMetrics(new Set()); else setTempPeriodMetrics(new Set(PERIOD_METRIC_OPTIONS.map(m => m.key))) }}
                    className="h-3 w-3 rounded accent-blue-500" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">全选</span>
                </label>
                {PERIOD_METRIC_OPTIONS.map(m => (
                  <label key={m.key} className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={tempPeriodMetrics.has(m.key)}
                      onChange={() => { const n = new Set(tempPeriodMetrics); if (n.has(m.key)) n.delete(m.key); else n.add(m.key); setTempPeriodMetrics(n) }}
                      className="h-3 w-3 rounded accent-blue-500" />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="text-gray-700 dark:text-gray-300">{m.label}</span>
                  </label>
                ))}
                <div className="flex gap-2 border-t border-gray-100 dark:border-gray-700 pt-2 mt-1">
                  <button onClick={() => { setShowPeriodMetricMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600">取消</button>
                  <button onClick={() => { setPeriodChartMetrics(new Set(tempPeriodMetrics)); setShowPeriodMetricMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
                </div>
              </div>, document.body)}
          </div>
          <div className="relative">
            <button ref={periodProviderBtnRef} onClick={() => { setShowPeriodProviderMenu(v => !v); if (!showPeriodProviderMenu) setTempPeriodProviders(new Set(periodProviderCharts)) }}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              <BarChart className="w-3 h-3 inline" />选择提供商 <ChevronDown className="w-3 h-3" />
            </button>
            {showPeriodProviderMenu && createPortal(
              <div data-menu="period-provider" className="fixed z-[99999] w-[200px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1.5 px-3 shadow-xl" style={{
                top: periodProviderBtnRef.current ? periodProviderBtnRef.current.getBoundingClientRect().bottom + 4 : 0,
                left: periodProviderBtnRef.current ? Math.min(periodProviderBtnRef.current.getBoundingClientRect().left, window.innerWidth - 210) : 0,
              }}>
                <label className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer border-b border-gray-100 dark:border-gray-700 mb-1">
                  <input type="checkbox" checked={tempPeriodProviders.size === data.providers.length}
                    onChange={() => { if (tempPeriodProviders.size === data.providers.length) setTempPeriodProviders(new Set()); else setTempPeriodProviders(new Set(data.providers.map(p => p.name))) }}
                    className="h-3 w-3 rounded accent-blue-500" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">全选</span>
                </label>
                {data.providers.map(p => (
                  <label key={p.name} className="flex items-center gap-2 py-1.5 text-[11px] cursor-pointer">
                    <input type="checkbox" checked={tempPeriodProviders.has(p.name)}
                      onChange={() => { const n = new Set(tempPeriodProviders); if (n.has(p.name)) n.delete(p.name); else n.add(p.name); setTempPeriodProviders(n) }}
                      className="h-3 w-3 rounded accent-blue-500" />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-gray-700 dark:text-gray-300">{p.name}</span>
                  </label>
                ))}
                <div className="flex gap-2 border-t border-gray-100 dark:border-gray-700 pt-2 mt-1">
                  <button onClick={() => { setShowPeriodProviderMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600">取消</button>
                  <button onClick={() => { setPeriodProviderCharts(new Set(tempPeriodProviders)); setShowPeriodProviderMenu(false) }}
                    className="flex-1 px-2 py-1 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
                </div>
              </div>, document.body)}
          </div>
        </div>
        <div className="space-y-6 max-h-[700px] overflow-y-auto">
          {data.providers.filter(p => periodProviderCharts.has(p.name)).slice(0, 5).map((provider) => {
            const periodData = (Object.keys(periodLabels) as PeriodType[]).map(periodKey => {
              const pData = mockPeriodData[periodKey as PeriodType].providers.find(p => p.name === provider.name)
              return {
                period: periodLabels[periodKey as PeriodType],
                totalTokens: pData?.totalTokens || 0,
                inputTokens: pData?.inputTokens || 0,
                outputTokens: pData?.outputTokens || 0,
                requests: pData?.requests || 0,
                toolCalls: pData?.toolCalls || 0,
                cost: pData?.cost || 0,
              }
            })
            return (
              <div key={provider.name}>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: provider.color }} />
                  {provider.name}
                </h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={periodData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={(v) => `$${v.toFixed(2)}`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={v => formatNumber(v)} />
                      <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                      <Tooltip />
                      <Legend />
                      {periodChartMetrics.has('totalTokens') && <Bar yAxisId="right" dataKey="totalTokens" fill="#8b5cf6" radius={[2, 2, 0, 0]} barSize={10} name="总token量（柱）" />}
                      {periodChartMetrics.has('inputTokens') && <Bar yAxisId="right" dataKey="inputTokens" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={10} name="输入量（柱）" />}
                      {periodChartMetrics.has('outputTokens') && <Bar yAxisId="right" dataKey="outputTokens" fill="#10b981" radius={[2, 2, 0, 0]} barSize={10} name="输出量（柱）" />}
                      {periodChartMetrics.has('requests') && <Bar yAxisId="count" dataKey="requests" fill="#ec4899" radius={[2, 2, 0, 0]} barSize={10} name="请求次数（柱）" />}
                      {periodChartMetrics.has('toolCalls') && <Bar yAxisId="count" dataKey="toolCalls" fill="#06b6d4" radius={[2, 2, 0, 0]} barSize={10} name="调工具次数（柱）" />}
                      {periodChartMetrics.has('cost') && <Line yAxisId="left" type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2} name="总费用（线）" dot={{ r: 3 }} />}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )

  return (
    <div className="max-w-6xl space-y-6">
      {/* 周期选择 + 历史查询 */}
      <div className="flex items-center justify-between">
        {viewMode === 'period' ? (
          <div className="flex gap-2">
            {(Object.keys(periodLabels) as PeriodType[]).map((key) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  period === key
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                {periodLabels[key]}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">日期范围</span>
            <input
              type="date"
              value={historyFrom}
              onChange={(e) => setHistoryFrom(e.target.value)}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
            <span className="text-gray-400">至</span>
            <input
              type="date"
              value={historyTo}
              onChange={(e) => setHistoryTo(e.target.value)}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
            <button
              onClick={handleHistoryQuery}
              className="px-4 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-1"
            >
              <Search className="w-3.5 h-3.5" />
              查询
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('period')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'period'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 inline mr-1" />
            周期统计
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'history'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Search className="w-3.5 h-3.5 inline mr-1" />
            历史查询
          </button>
        </div>
      </div>

      {viewMode === 'period' ? renderPeriodContent() : renderHistoryContent()}
    </div>
  )
}

interface EnvStatus {
  python: { installed: boolean; version: string | null; path: string | null }
  venv: { created: boolean; path: string }
  deps: { installed: boolean }
}

interface BackendApp {
  name: string
  key: string
  enabled: boolean
}

interface ComputerUseConfig {
  authorizedApps: BackendApp[]
  clipboardAccess: boolean
  systemShortcuts: boolean
}

function ComputerSettings() {
  const [checked, setChecked] = useState(false)
  const [checking, setChecking] = useState(false)
  const [appSearch, setAppSearch] = useState('')
  const [selectAll, setSelectAll] = useState(false)
  const [clipboardAccess, setClipboardAccess] = useState(true)
  const [systemShortcuts, setSystemShortcuts] = useState(false)
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null)
  const [authorizedApps, setAuthorizedApps] = useState<BackendApp[]>([])

  useEffect(() => {
    invoke<ComputerUseConfig>('load_computer_use_config').then((config) => {
      setAuthorizedApps(config.authorizedApps)
      setClipboardAccess(config.clipboardAccess)
      setSystemShortcuts(config.systemShortcuts)
    }).catch(() => {})
  }, [])

  const persistConfig = (apps: BackendApp[], clipboard: boolean, shortcuts: boolean) => {
    invoke('save_computer_use_config', {
      config: { authorizedApps: apps, clipboardAccess: clipboard, systemShortcuts: shortcuts }
    }).catch(() => {})
  }

  const toggleApp = (key: string) => {
    setAuthorizedApps(prev => {
      const next = prev.map(app =>
        app.key === key ? { ...app, enabled: !app.enabled } : app
      )
      persistConfig(next, clipboardAccess, systemShortcuts)
      return next
    })
  }

  const toggleSelectAll = () => {
    const newValue = !selectAll
    setSelectAll(newValue)
    setAuthorizedApps(prev => {
      const next = prev.map(app => ({ ...app, enabled: newValue }))
      persistConfig(next, clipboardAccess, systemShortcuts)
      return next
    })
  }

  const handleClipboardChange = (val: boolean) => {
    setClipboardAccess(val)
    persistConfig(authorizedApps, val, systemShortcuts)
  }

  const handleShortcutsChange = (val: boolean) => {
    setSystemShortcuts(val)
    persistConfig(authorizedApps, clipboardAccess, val)
  }

  const handleRecheck = async () => {
    setChecking(true)
    try {
      const status = await invoke<EnvStatus>('check_environment')
      setEnvStatus(status)
      setChecked(true)
    } catch {
      setChecked(true)
    }
    setChecking(false)
  }

  const handleSetup = async () => {
    setChecking(true)
    try {
      await invoke('run_setup')
      const status = await invoke<EnvStatus>('check_environment')
      setEnvStatus(status)
      setChecked(true)
    } catch {
      setChecked(true)
    }
    setChecking(false)
  }

  const filteredApps = authorizedApps.filter(app =>
    app.name.toLowerCase().includes(appSearch.toLowerCase())
  )

  return (
    <div className="max-w-4xl space-y-6">
      {/* 标题与说明 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-2">
          <Monitor className="w-6 h-6 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">电脑操作</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          允许 CanAI 截屏、点击、打字并控制你的电脑。需要 Python 3，macOS 上还需要辅助功能权限。
        </p>
      </div>

      {/* 环境检测 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">环境检测</h3>

        {checking ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 text-white animate-spin" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">正在检测环境...</span>
              </div>
            </div>
          </div>
        ) : checked && envStatus ? (
          <>
            <div className="space-y-3">
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                envStatus.python.installed
                  ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  envStatus.python.installed ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {envStatus.python.installed ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <X className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{envStatus.python.installed ? 'Python 3 已安装' : 'Python 3 未安装'}</span>
                  {envStatus.python.installed && envStatus.python.version && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {envStatus.python.version} ({envStatus.python.path || '未知路径'})
                    </p>
                  )}
                </div>
              </div>

              <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                envStatus.venv.created
                  ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  envStatus.venv.created ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {envStatus.venv.created ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <X className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{envStatus.venv.created ? '虚拟环境已就绪' : '虚拟环境未创建'}</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {envStatus.venv.path}
                  </p>
                </div>
              </div>

              <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                envStatus.deps.installed
                  ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                  : 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  envStatus.deps.installed ? 'bg-green-500' : 'bg-yellow-500'
                }`}>
                  {envStatus.deps.installed ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <span className="text-white text-xs font-bold">!</span>
                  )}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{envStatus.deps.installed ? '依赖包已安装' : '依赖包未安装'}</span>
                </div>
              </div>
            </div>

            {envStatus.python.installed && envStatus.venv.created && envStatus.deps.installed && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">所有检查通过，电脑操作功能已就绪。</p>
              </div>
            )}

            {envStatus.python.installed && (!envStatus.venv.created || !envStatus.deps.installed) && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">环境不完整，请点击下方按钮自动配置环境。</p>
              </div>
            )}
          </>
        ) : null}

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleRecheck}
            disabled={checking}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checked ? '重新检测' : '开始环境检测'}
          </button>
          {checked && envStatus?.python.installed && (!envStatus.venv.created || !envStatus.deps.installed) && (
            <button
              onClick={handleSetup}
              disabled={checking}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              自动配置环境
            </button>
          )}
        </div>
      </div>

      {/* 已授权应用 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">已授权应用</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          预先授权 App，将可以直接控制这些 App，无需运行时弹窗确认。
        </p>

        {/* 全局权限 */}
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={clipboardAccess}
              onChange={(e) => handleClipboardChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">剪贴板访问</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={systemShortcuts}
              onChange={(e) => handleShortcutsChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">系统快捷键</span>
          </label>
        </div>

        {/* 搜索 */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索 App..."
            value={appSearch}
            onChange={(e) => setAppSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
          />
        </div>

        {/* 软件列表 */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">电脑软件列表</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">全选</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
          {filteredApps.map((app) => (
            <label
              key={app.key}
              className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-colors"
            >
              <input
                type="checkbox"
                checked={app.enabled}
                onChange={() => toggleApp(app.key)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
              />
              <Monitor className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{app.name}</span>
            </label>
          ))}
        </div>

        {filteredApps.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
            没有找到匹配的应用
          </p>
        )}
      </div>
    </div>
  )
}

function WorkspaceSettings() {
  const [workspacePath, setWorkspacePath] = useState('')
  const [restrictAccess, setRestrictAccess] = useState(true)
  const [autoSaveContext, setAutoSaveContext] = useState(true)
  const [fileWatch, setFileWatch] = useState(false)
  const [heartbeatFreq, setHeartbeatFreq] = useState('30分钟')
  const [memoryDuration, setMemoryDuration] = useState('7天')
  const [clearType, setClearType] = useState<'idle' | 'daily'>('idle')
  const [clearTime, setClearTime] = useState('00:00')

  const heartbeatOptions = ['2分钟', '30分钟', '1小时', '2小时', '4小时']
  const memoryOptions = ['1小时', '1天', '7天', '30天']

  const handleBrowse = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({ directory: true, multiple: false, title: '选择工作区目录' })
      if (selected && typeof selected === 'string') {
        setWorkspacePath(selected)
      }
    } catch {
      const path = prompt('请输入工作区目录路径:', workspacePath || '')
      if (path) setWorkspacePath(path)
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">工作区</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">配置本地项目目录与上下文持久化行为。</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">默认项目目录</label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">CanAI项目和上下文文件的保存位置。</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={workspacePath}
              onChange={(e) => setWorkspacePath(e.target.value)}
              placeholder="~/CanAI/workspace"
              className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
            <button
              onClick={handleBrowse}
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              浏览
            </button>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700" />

        <ToggleItem label="限制文件访问范围" description="建议备份重要文件。注：受技术限制，我们无法保证完全阻止目录外执行带来的外部影响，请自行评估风险并谨慎使用。" checked={restrictAccess} onChange={setRestrictAccess} />
        <ToggleItem label="自动保存上下文" description="自动将聊天记录和提取的产物保存到本地工作区文件夹。" checked={autoSaveContext} onChange={setAutoSaveContext} />
        <ToggleItem label="文件监听" description="监听本地文件变更，实时更新Agent上下文。" checked={fileWatch} onChange={setFileWatch} />

        <div className="border-t border-gray-200 dark:border-gray-700" />

        <SelectItem label="Agent心跳频率" description="Agent会定期向模型发送心跳检查，每次会消耗积分。降低频率可节省积分。" value={heartbeatFreq} options={heartbeatOptions} onChange={setHeartbeatFreq} />

        <div className="border-t border-gray-200 dark:border-gray-700" />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">对话记忆时长</label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">长时间没说话，AI会忘掉当前对话聊过的内容，下次当作新对话开始。</p>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              {(['idle', 'daily'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setClearType(type)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    clearType === type
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {type === 'idle' ? '闲置后清空' : '每天定时清空'}
                </button>
              ))}
            </div>
            {clearType === 'idle' ? (
              <select
                value={memoryDuration}
                onChange={(e) => setMemoryDuration(e.target.value)}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              >
                {memoryOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type="time"
                value={clearTime}
                onChange={(e) => setClearTime(e.target.value)}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              />
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700" />

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">从 OpenClaw 迁移</span>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">将 OpenClaw 的配置、对话记录、技能等数据迁移到 CanAI</p>
          </div>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">开始迁移</button>
        </div>
      </div>
    </div>
  )
}

function ToggleItem({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
          checked ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

function SelectItem({ label, description, value, options, onChange }: { label: string; description: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}

function AgentEvolutionSettings() {
  const [speed, setSpeed] = useState(0.5)
  const [activeFilter, setActiveFilter] = useState<string>('全部')
  const filterOptions = ['全部', '长期记忆', '行为规范', 'Skill', '工具调用']

  return (
    <div className="max-w-3xl space-y-5">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Agents 进化看板</h2>
          <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">各Agent进化记录与数据汇总（openclaw、hermes、openhuman等）</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 text-center">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">0</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">今日进化</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 text-center">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">0</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">今日发起</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 text-center">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">0</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">本月发起</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 text-center">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">0</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">发起总数</div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Agent进化速度</span>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {speed < 0.33 ? '低（谨慎学习）' : speed < 0.66 ? '中（均衡）' : '高（高速迭代）'}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>低（谨慎学习）</span>
          <span>中（均衡）</span>
          <span>高（高速迭代）</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">注：谨慎学习：稳定可靠不易出错，但学习进化速度较慢。高速迭代:快速自我更新，但易有偏差。</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">更新内容</span>
        </div>
        <div className="flex gap-2 mb-6">
          {filterOptions.map((option) => (
            <button
              key={option}
              onClick={() => setActiveFilter(option)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeFilter === option
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <History className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-sm">暂无内容</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">可以试试调整自我进化速度后多与Agent协作</p>
        </div>
      </div>
    </div>
  )
}

function FunctionModuleConfig() {
  const { providers } = useChat()

  const buildGroupedOptions = (dedicatedServices: { value: string; label: string }[]) => {
    const cloudOptions = providers.filter(p => p.type === 'cloud' && p.enabled).flatMap(p =>
      p.models.map(m => ({ value: m.id, label: `${p.name}/${m.name}` }))
    )
    const localOptions = providers.filter(p => p.type === 'local' && p.enabled).flatMap(p =>
      p.models.map(m => ({ value: m.id, label: `${p.name}/${m.name}` }))
    )
    return [
      { label: '默认', items: [{ value: 'default', label: '默认，使用会话模型' }] },
      ...(cloudOptions.length > 0 ? [{ label: '云端模型', items: cloudOptions }] : []),
      ...(localOptions.length > 0 ? [{ label: '本地模型', items: localOptions }] : []),
      { label: '专用服务', items: dedicatedServices },
    ]
  }

  const [webSearchProvider, setWebSearchProvider] = useState('default')
  const [webSearchApiKey, setWebSearchApiKey] = useState('')
  const [webSearchShowKey, setWebSearchShowKey] = useState(false)

  const [speechProvider, setSpeechProvider] = useState('default')
  const [speechApiKey, setSpeechApiKey] = useState('')
  const [speechShowKey, setSpeechShowKey] = useState(false)

  const [imageRecogProvider, setImageRecogProvider] = useState('default')
  const [imageRecogApiKey, setImageRecogApiKey] = useState('')
  const [imageRecogShowKey, setImageRecogShowKey] = useState(false)

  const [imageGenProvider, setImageGenProvider] = useState('default')
  const [imageGenApiKey, setImageGenApiKey] = useState('')
  const [imageGenShowKey, setImageGenShowKey] = useState(false)

  const [reasoningLevel, setReasoningLevel] = useState('medium')
  const [contextWindow, setContextWindow] = useState('200k')
  const [customContext, setCustomContext] = useState('')
  const [showCustomContext, setShowCustomContext] = useState(false)

  const searchProviders = buildGroupedOptions([
    { value: 'baidu', label: '百度' },
    { value: 'xiaomi', label: '小米' },
    { value: 'volcengine', label: '火山引擎' },
    { value: 'minimax', label: 'Minimax' },
    { value: 'tencent', label: '腾讯混元' },
    { value: 'aliyun', label: '阿里云/通义千问' },
    { value: 'zhipu', label: '智谱' },
    { value: 'tavily', label: 'Tavily' },
    { value: 'brave', label: 'Brave' },
    { value: 'openai', label: 'OpenAI（ChatGPT）' },
    { value: 'anthropic', label: 'Anthropic（Claude）' },
  ])

  const speechProviders = buildGroupedOptions([
    { value: 'whisper', label: 'Whisper (OpenAI)' },
    { value: 'deepgram', label: 'Deepgram' },
    { value: 'azure-speech', label: 'Azure 语音服务' },
    { value: 'google-speech', label: 'Google 语音识别' },
    { value: 'aliyun-asr', label: '阿里云语音识别' },
  ])

  const imageRecogProviders = buildGroupedOptions([
    { value: 'gpt4-vision', label: 'GPT-4 Vision' },
    { value: 'claude-vision', label: 'Claude Vision' },
    { value: 'gemini-vision', label: 'Gemini Vision' },
    { value: 'qwen-vl', label: 'Qwen-VL' },
    { value: 'deepseek-vl', label: 'DeepSeek-VL' },
  ])

  const imageGenProviders = buildGroupedOptions([
    { value: 'dall-e', label: 'DALL-E (OpenAI)' },
    { value: 'stable-diffusion', label: 'Stable Diffusion' },
    { value: 'midjourney', label: 'Midjourney' },
    { value: 'flux', label: 'Flux' },
    { value: 'qwen-vg', label: '通义万相' },
  ])

  const reasoningLevels = [
    { value: 'low', label: '低' },
    { value: 'medium', label: '中' },
    { value: 'high', label: '高' },
    { value: 'maximum', label: '最大' },
  ]

  const renderSelectField = (
    label: string,
    icon: typeof Globe,
    value: string,
    options: { label: string; items: { value: string; label: string }[] }[],
    onChange: (v: string) => void,
    apiKey: string,
    onApiKeyChange: (v: string) => void,
    showKey: boolean,
    onToggleShowKey: () => void
  ) => {
    const Icon = icon
    return (
      <div className="space-y-3 pb-4 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 last:pb-0">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
        >
          {options.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.items.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="API Key（留空使用会话模型）"
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300 pr-16"
          />
          <button
            onClick={onToggleShowKey}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
          >
            {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-2 mb-5">
        <GripHorizontal className="w-5 h-5 text-gray-400" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">功能模块配置</h3>
      </div>

      <div className="space-y-5">
        {renderSelectField(
          '网络搜索',
          Search,
          webSearchProvider,
          searchProviders,
          setWebSearchProvider,
          webSearchApiKey,
          setWebSearchApiKey,
          webSearchShowKey,
          () => setWebSearchShowKey(!webSearchShowKey)
        )}

        {renderSelectField(
          '语音识别/转录',
          Mic,
          speechProvider,
          speechProviders,
          setSpeechProvider,
          speechApiKey,
          setSpeechApiKey,
          speechShowKey,
          () => setSpeechShowKey(!speechShowKey)
        )}

        {renderSelectField(
          '图像识别',
          Image,
          imageRecogProvider,
          imageRecogProviders,
          setImageRecogProvider,
          imageRecogApiKey,
          setImageRecogApiKey,
          imageRecogShowKey,
          () => setImageRecogShowKey(!imageRecogShowKey)
        )}

        {renderSelectField(
          '图像生成',
          Palette,
          imageGenProvider,
          imageGenProviders,
          setImageGenProvider,
          imageGenApiKey,
          setImageGenApiKey,
          imageGenShowKey,
          () => setImageGenShowKey(!imageGenShowKey)
        )}

        <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
          CanAI 会自动为子任务选择模型层级。未配置时回退到会话模型。
        </p>

        {/* 推理等级 */}
        <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">推理等级</span>
          </div>
          <div className="flex gap-2">
            {reasoningLevels.map((level) => (
              <button
                key={level.value}
                onClick={() => setReasoningLevel(level.value)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  reasoningLevel === level.value
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {level.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            控制推理深度。等级越高 = 越智能，响应越慢。
          </p>
        </div>

        {/* 上下文窗口 */}
        <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">上下文窗口</span>
          </div>
          <div className="flex gap-2">
            {[
              { value: '200k', label: '200K' },
              { value: '1m', label: '1M' },
              { value: 'custom', label: '自定义' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setContextWindow(option.value)
                  if (option.value === 'custom') {
                    setShowCustomContext(true)
                  } else {
                    setShowCustomContext(false)
                  }
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  contextWindow === option.value
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {showCustomContext && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                placeholder="输入上下文窗口大小（如 500K）"
                className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
              />
            </div>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            部分模型（如 Sonnet、deepseek-v4）支持最高 1M 上下文。需订阅计划支持后启用。
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('local')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const renderContent = () => {
    switch (activeTab) {
      case 'local':
        return <LocalModelSettings />
      case 'general':
        return <GeneralSettings />
      case 'cloud':
        return <CloudProviderSettings />
      case 'im':
        return <IMSettings />
      case 'memory':
        return <MemorySettings />
      case 'rules':
        return <RulesSettings />
      case 'workspace':
        return <WorkspaceSettings />
      case 'agent':
        return <AgentEvolutionSettings />
      case 'cost':
        return <CostSettings />
      case 'computer':
        return <ComputerSettings />
      case 'diagnostics':
        return <DiagnosticsSettings />
    }
  }

  return (
    <div className="h-full flex bg-gray-50 dark:bg-gray-900">
      <div className={`flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 py-4 overflow-y-auto transition-all duration-300 ${
        sidebarCollapsed ? 'w-0 overflow-hidden px-0' : 'w-48'
      }`}>
        <div className="px-4 mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">设置</h2>
        </div>
        <nav className="space-y-0.5 px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div className="absolute top-2 left-2 z-10">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>
        {/* 云提供商、IM接入和记忆有自己的布局 */}
        {activeTab === 'cloud' || activeTab === 'im' || activeTab === 'memory' ? (
          renderContent()
        ) : (
          <div className="h-full overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                {tabs.find(t => t.id === activeTab)?.label}
              </h1>
              {renderContent()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import {
  getLogs,
  getStats,
  getLogDir,
  openLogDir,
  clearLogs,
  exportDiagnostics,
  reloadLogs,
  deleteLog,
  formatFileSize,
  type LogEntry,
  type LogStats,
} from '../api/diagnostics'

async function copyTextToClipboard(text: string) {
  await navigator.clipboard.writeText(text)
}

function DiagnosticsSettings() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logDir, setLogDir] = useState('')
  const [stats, setStats] = useState<LogStats>({
    total_size: 0,
    event_count: 0,
    warning_count_24h: 0,
    retention_policy: '7天/50MB',
  })
  const [exportPath, setExportPath] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshed, setRefreshed] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)
  const [exportError, setExportError] = useState('')
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [clearError, setClearError] = useState('')
  const [openDirError, setOpenDirError] = useState('')
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg)
    setToastType(type)
    setTimeout(() => setToast(''), 2000)
  }

  const loadData = async () => {
    try {
      const [logsData, statsData, dir] = await Promise.all([
        getLogs(),
        getStats(),
        getLogDir(),
      ])
      setLogs(logsData)
      setStats(statsData)
      setLogDir(dir)
    } catch (error) {
      console.error('Failed to load diagnostics data:', error)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    setRefreshed(false)
    setRefreshError('')
    try {
      const logsData = await reloadLogs()
      const statsData = await getStats()
      setLogs(logsData)
      setStats(statsData)
      setRefreshed(true)
      setTimeout(() => setRefreshed(false), 2000)
    } catch (error) {
      console.error('Failed to refresh logs:', error)
      setRefreshError(error instanceof Error ? error.message : '刷新失败')
      setTimeout(() => setRefreshError(''), 3000)
    } finally {
      setRefreshing(false)
    }
  }

  const handleOpenLogDir = async () => {
    try {
      await openLogDir()
      setOpenDirError('')
    } catch (error) {
      console.error('Failed to open log directory:', error)
      const errorMsg = error instanceof Error ? error.message : '打开失败'
      console.error('Error details:', errorMsg)
      setOpenDirError(errorMsg)
      setTimeout(() => setOpenDirError(''), 3000)
    }
  }

  const handleExportDiagnostics = async () => {
    setExporting(true)
    setExported(false)
    setExportError('')
    try {
      const exportResult = await exportDiagnostics()
      setExportPath(exportResult)
      setExported(true)
      setTimeout(() => setExported(false), 2000)
    } catch (error) {
      console.error('Failed to export diagnostics:', error)
      setExportError(error instanceof Error ? error.message : '导出失败')
      setTimeout(() => setExportError(''), 3000)
    } finally {
      setExporting(false)
    }
  }

  const handleCopySummary = async () => {
    try {
      const errors = logs.filter(l => l.level === 'ERROR')
      const summary = errors.map(l => `${l.time_str} - ${l.content}`).join('\n')
      await copyTextToClipboard(summary)
      setCopied(true)
      setCopyError('')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy summary:', error)
      setCopied(false)
      setCopyError(error instanceof Error ? error.message : '复制失败')
      setTimeout(() => setCopyError(''), 3000)
    }
  }

  const handleClearLogs = async () => {
    setClearing(true)
    setCleared(false)
    setClearError('')
    try {
      await clearLogs()
      setLogs([])
      setStats({
        total_size: 0,
        event_count: 0,
        warning_count_24h: 0,
        retention_policy: '7天/50MB',
      })
      setCleared(true)
      setTimeout(() => setCleared(false), 2000)
    } catch (error) {
      console.error('Failed to clear logs:', error)
      setClearError(error instanceof Error ? error.message : '清理失败')
      setTimeout(() => setClearError(''), 3000)
    } finally {
      setClearing(false)
    }
  }

  const handleCopyLog = async (log: LogEntry) => {
    try {
      const logContent = `[${log.time_str}] ${log.level} - ${log.content}`
      await copyTextToClipboard(logContent)
      showToast('日志内容已复制', 'success')
    } catch (error) {
      console.error('Failed to copy log:', error)
      showToast('复制失败', 'error')
    }
  }

  const handleDeleteLog = async (log: LogEntry) => {
    try {
      await deleteLog(log.id)
      setLogs(prev => prev.filter(l => l.id !== log.id))
      showToast('日志已删除', 'success')
    } catch (error) {
      console.error('Failed to delete log:', error)
      showToast('删除失败', 'error')
    }
  }

  const handleViewDetail = (log: LogEntry) => {
    alert(`日志详情\n\n时间: ${log.time_str}\n类型: ${log.level}\n内容:\n${log.content}`)
  }

  const filterLogs = logs.filter(l => l.level === 'ERROR' || l.level === 'WARN')

  return (
    <div className="max-w-4xl space-y-6">
      {toast && (
        <div className={`p-4 rounded-lg text-sm font-medium ${
          toastType === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {toast}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Bug className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">调试诊断</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">记录服务端与CLI的启动、服务商、会话运行错误，便于复现和定位问题。</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? '刷新中...' : '刷新'}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">日志大小</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatFileSize(stats.total_size)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">事件数</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{stats.event_count}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">24h警告</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{stats.warning_count_24h}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">保留策略</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{stats.retention_policy}</p>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">日志目录</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs" title={logDir}>{logDir}</p>
            </div>
            <div className="relative">
              <button
                onClick={handleOpenLogDir}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors min-w-[100px] justify-center ${
                  openDirError
                    ? 'bg-red-500 text-white'
                    : 'bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500'
                }`}
              >
                {openDirError ? (
                  <>
                    <X className="w-4 h-4" />
                    打开失败
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-4 h-4" />
                    打开文件夹
                  </>
                )}
              </button>
              {openDirError && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-10">
                  {openDirError}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            <button
              onClick={handleExportDiagnostics}
              disabled={exporting}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors min-w-[110px] justify-center disabled:opacity-50 ${
                exported
                  ? 'bg-green-500 text-white'
                  : exportError
                    ? 'bg-red-500 text-white'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  导出中...
                </>
              ) : exported ? (
                <>
                  <Check className="w-4 h-4" />
                  已导出
                </>
              ) : exportError ? (
                <>
                  <X className="w-4 h-4" />
                  导出失败
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  导出诊断包
                </>
              )}
            </button>
            {exportError && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-10">
                {exportError}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={handleCopySummary}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors min-w-[110px] justify-center ${
                copied
                  ? 'bg-green-500 text-white'
                  : copyError
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  已复制
                </>
              ) : copyError ? (
                <>
                  <X className="w-4 h-4" />
                  复制失败
                </>
              ) : (
                <>
                  <Clipboard className="w-4 h-4" />
                  复制错误摘要
                </>
              )}
            </button>
            {copyError && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-10">
                {copyError}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={handleClearLogs}
              disabled={clearing}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors min-w-[100px] justify-center disabled:opacity-50 ${
                cleared
                  ? 'bg-green-500 text-white'
                  : clearError
                    ? 'bg-red-500 text-white'
                    : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-800/30'
              }`}
            >
              {clearing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  清理中...
                </>
              ) : cleared ? (
                <>
                  <Check className="w-4 h-4" />
                  已清理
                </>
              ) : clearError ? (
                <>
                  <X className="w-4 h-4" />
                  清理失败
                </>
              ) : (
                <>
                  <Trash className="w-4 h-4" />
                  清理日志
                </>
              )}
            </button>
            {clearError && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-10">
                {clearError}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
              </div>
            )}
          </div>
        </div>

        {exportPath && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            诊断包已导出：{exportPath}
          </p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">最近事件</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">导出的诊断包会脱敏，不包含聊天内容、文件内容、完整环境变量或APIKey。</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">时间</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">类型</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">日志内容</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">操作</th>
              </tr>
            </thead>
            <tbody>
              {filterLogs.length > 0 ? (
                filterLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{log.time_str}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        log.level === 'ERROR'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {log.level === 'ERROR' ? <AlertCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {log.level}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300 max-w-md truncate" title={log.content}>
                      {log.content}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewDetail(log)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="查看详情"
                        >
                          <Edit3 className="w-3 h-3" />
                          详情
                        </button>
                        <button
                          onClick={() => handleCopyLog(log)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="复制日志"
                        >
                          <Copy className="w-3 h-3" />
                          复制
                        </button>
                        <button
                          onClick={() => handleDeleteLog(log)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="删除日志"
                        >
                          <Trash className="w-3 h-3" />
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    暂无警告或错误日志
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
