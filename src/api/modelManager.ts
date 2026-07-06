export type ModelType = 'cloud' | 'local'
export type ApiFormat = 'openai' | 'anthropic'

export interface ProviderConfig {
  id: string
  name: string
  type: ModelType
  apiKey: string
  baseUrl: string
  apiFormat: ApiFormat
  enabled: boolean
  models: ModelDefinition[]
  systemPrompt?: string
}

export interface ModelDefinition {
  id: string
  name: string
  providerId: string
  type: ModelType
  filePath?: string
  mmprojPath?: string
  audioInputPath?: string
  modelVocoder?: string
}

export interface ActiveModel {
  modelId: string
  providerId: string
  modelName: string
  providerName: string
  type: ModelType
  baseUrl: string
  apiKey: string
  apiFormat: ApiFormat
  temperature: number
  maxTokens: number
}

export interface LocalModelInfo {
  name: string
  path: string
  size: number
  modified: number
}

export interface LlamaCppConfig {
  model_path: string
  port: number
  host: string
  n_gpu_layers: number
  n_ctx: number
  threads: number
  batch_size: number
  api_key?: string
  mtp_tokens?: number
  mmproj_path?: string
  audio_input_path?: string
  model_vocoder?: string
}

export interface CompanionFile {
  category: string
  file_name: string
  file_path: string
  file_size: number
}

export interface DetailedModelInfo {
  name: string
  path: string
  size: number
  modified: number
  base_name: string
  quant_part: string
  model_type: string
  is_multimodal: boolean
  auto_matched_mmproj: CompanionFile[]
  available_mmproj_files: CompanionFile[]
  auto_matched_audio_input: CompanionFile[]
  auto_matched_audio_output: CompanionFile[]
  available_audio_input_files: CompanionFile[]
  available_audio_output_files: CompanionFile[]
}

export interface ServerStatus {
  running: boolean
  url: string
  model_loaded: boolean
  model_name?: string
}

const STORAGE_KEY = 'canai-model-providers'
const ACTIVE_MODEL_KEY = 'canai-active-model'
const DEFAULT_MODEL_KEY = 'canai-default-model'
const MODEL_STATUS_KEY = 'canai-model-statuses'
const LOCAL_MODEL_CONFIG_KEY = 'canai-local-model-config'

export function cleanStaleStorage(): void {
  try {
    const migrated = localStorage.getItem('canai-storage-version')
    if (migrated === '3') return
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('canai-')) {
        keysToRemove.push(key)
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key)
    }
    localStorage.setItem('canai-storage-version', '3')
  } catch {}
}

cleanStaleStorage()

export type ModelStatus = 'ok' | 'fail' | null

export function loadModelStatuses(): Record<string, ModelStatus> {
  try {
    const saved = localStorage.getItem(MODEL_STATUS_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch { return {} }
}

export function saveModelStatuses(statuses: Record<string, ModelStatus>): void {
  try {
    localStorage.setItem(MODEL_STATUS_KEY, JSON.stringify(statuses))
  } catch {}
}

const MODEL_PARAMS: Record<string, { temperature?: number; maxTokens?: number }> = {
  'kimi-k2.6': { temperature: 1 },
}

export function getModelParams(modelId: string): { temperature: number; maxTokens: number } {
  const p = MODEL_PARAMS[modelId]
  return {
    temperature: p?.temperature ?? 0.7,
    maxTokens: p?.maxTokens ?? 4096,
  }
}

export function loadDefaultModelId(): string | null {
  try {
    return localStorage.getItem(DEFAULT_MODEL_KEY)
  } catch { return null }
}

export function saveDefaultModelId(modelId: string | null): void {
  try {
    if (modelId) localStorage.setItem(DEFAULT_MODEL_KEY, modelId)
    else localStorage.removeItem(DEFAULT_MODEL_KEY)
  } catch {}
}

const DEFAULT_CLOUD_PROVIDERS: ProviderConfig[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    apiFormat: 'openai',
    enabled: true,
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', providerId: 'deepseek', type: 'cloud' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', providerId: 'deepseek', type: 'cloud' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', providerId: 'deepseek', type: 'cloud' },
    ],
  },
  {
    id: 'volcengine',
    name: '火山引擎',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
    apiFormat: 'openai',
    enabled: true,
    models: [
      { id: 'doubao-seed-2-0-code-250615', name: 'Doubao-Seed-2.0-Code', providerId: 'volcengine', type: 'cloud' },
      { id: 'doubao-seed-2-0-pro-250615', name: 'Doubao-Seed-2.0-Pro', providerId: 'volcengine', type: 'cloud' },
      { id: 'doubao-seed-2-0-lite-250615', name: 'Doubao-Seed-2.0-Lite', providerId: 'volcengine', type: 'cloud' },
      { id: 'doubao-seed-code-250120', name: 'Doubao-Seed-Code', providerId: 'volcengine', type: 'cloud' },
      { id: 'kimi-k2.5-250120', name: 'Kimi-K2.5', providerId: 'volcengine', type: 'cloud' },
      { id: 'glm-4-7-250120', name: 'GLM-4.7', providerId: 'volcengine', type: 'cloud' },
      { id: 'deepseek-v3.2-250120', name: 'DeepSeek-V3.2', providerId: 'volcengine', type: 'cloud' },
      { id: 'minimax-m2.5-250120', name: 'MiniMax-M2.5', providerId: 'volcengine', type: 'cloud' },
    ],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.minimaxi.com/v1',
    apiFormat: 'openai',
    enabled: true,
    models: [
      { id: 'MiniMax-M2.5', name: 'MiniMax M2.5', providerId: 'minimax', type: 'cloud' },
      { id: 'MiniMax-M2.7', name: 'MiniMax M2.7', providerId: 'minimax', type: 'cloud' },
      { id: 'abab6.5s-chat', name: 'abab 6.5s Chat', providerId: 'minimax', type: 'cloud' },
      { id: 'MiniMax-M2.5-highspeed', name: 'MiniMax M2.5 极速版', providerId: 'minimax', type: 'cloud' },
    ],
  },
  {
    id: 'xfyun',
    name: '讯飞星辰',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://maas-coding-api.cn-huabei-1.xf-yun.com/v2',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'astron-code-latest', name: 'astron-code-latest', providerId: 'xfyun', type: 'cloud' },
    ],
  },
  {
    id: 'zhipu',
    name: 'Zhipu',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'glm-4', name: 'GLM-4', providerId: 'zhipu', type: 'cloud' },
      { id: 'glm-4-plus', name: 'GLM-4 Plus', providerId: 'zhipu', type: 'cloud' },
      { id: 'glm-4-flash', name: 'GLM-4 Flash', providerId: 'zhipu', type: 'cloud' },
    ],
  },
  {
    id: 'qwen',
    name: 'Qwen',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'qwen-max', name: 'Qwen-Max', providerId: 'qwen', type: 'cloud' },
      { id: 'qwen-plus', name: 'Qwen-Plus', providerId: 'qwen', type: 'cloud' },
      { id: 'qwen-turbo', name: 'Qwen-Turbo', providerId: 'qwen', type: 'cloud' },
    ],
  },
  {
    id: 'moonshot',
    name: 'Moonshot（月之暗面kimi）',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'kimi-k2.6', name: 'Kimi K2.6', providerId: 'moonshot', type: 'cloud' },
      { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', providerId: 'moonshot', type: 'cloud' },
      { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K', providerId: 'moonshot', type: 'cloud' },
      { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K', providerId: 'moonshot', type: 'cloud' },
    ],
  },
  {
    id: 'xiaomi',
    name: 'Xiaomi',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.xiaomi.com/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'mimo-8b', name: 'MiMo 8B', providerId: 'xiaomi', type: 'cloud' },
      { id: 'mimo-72b', name: 'MiMo 72B', providerId: 'xiaomi', type: 'cloud' },
    ],
  },
  {
    id: 'baidu',
    name: 'Baidu/文心千帆',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'ernie-4.0', name: 'ERNIE 4.0', providerId: 'baidu', type: 'cloud' },
      { id: 'ernie-3.5', name: 'ERNIE 3.5', providerId: 'baidu', type: 'cloud' },
    ],
  },
  {
    id: 'tencent',
    name: '腾讯混元/Tencent HY',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'hunyuan-pro', name: 'Hunyuan-Pro', providerId: 'tencent', type: 'cloud' },
      { id: 'hunyuan-standard', name: 'Hunyuan-Standard', providerId: 'tencent', type: 'cloud' },
    ],
  },
  {
    id: 'infini',
    name: '无问芯穹',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.infini-ai.com/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'infini-megrez', name: 'Infini-Megrez', providerId: 'infini', type: 'cloud' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', providerId: 'openai', type: 'cloud' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', providerId: 'openai', type: 'cloud' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', providerId: 'openai', type: 'cloud' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.anthropic.com/v1',
    apiFormat: 'anthropic',
    enabled: false,
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', providerId: 'anthropic', type: 'cloud' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', providerId: 'anthropic', type: 'cloud' },
      { id: 'claude-haiku-4-20250514', name: 'Claude Haiku 4', providerId: 'anthropic', type: 'cloud' },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', providerId: 'google', type: 'cloud' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', providerId: 'google', type: 'cloud' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'http://localhost:11434/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'llama3', name: 'Llama 3', providerId: 'ollama', type: 'cloud' },
      { id: 'qwen2', name: 'Qwen 2', providerId: 'ollama', type: 'cloud' },
      { id: 'mistral', name: 'Mistral', providerId: 'ollama', type: 'cloud' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', providerId: 'openrouter', type: 'cloud' },
      { id: 'gpt-4o', name: 'GPT-4o', providerId: 'openrouter', type: 'cloud' },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.mistral.ai/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', providerId: 'mistral', type: 'cloud' },
      { id: 'mistral-small-latest', name: 'Mistral Small', providerId: 'mistral', type: 'cloud' },
    ],
  },
  {
    id: 'xai',
    name: 'xAI',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.x.ai/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'grok-2', name: 'Grok 2', providerId: 'xai', type: 'cloud' },
      { id: 'grok-2-vision', name: 'Grok 2 Vision', providerId: 'xai', type: 'cloud' },
    ],
  },
  {
    id: 'cohere',
    name: 'Cohere',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.cohere.com/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'command-r-plus', name: 'Command R+', providerId: 'cohere', type: 'cloud' },
      { id: 'command-r', name: 'Command R', providerId: 'cohere', type: 'cloud' },
    ],
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.perplexity.ai',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'sonar-pro', name: 'Sonar Pro', providerId: 'perplexity', type: 'cloud' },
      { id: 'sonar-reasoning', name: 'Sonar Reasoning', providerId: 'perplexity', type: 'cloud' },
    ],
  },
  {
    id: 'meta',
    name: 'Meta AI',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.meta.ai/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', providerId: 'meta', type: 'cloud' },
      { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', providerId: 'meta', type: 'cloud' },
    ],
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.microsoft.com/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'phi-3-medium', name: 'Phi-3 Medium', providerId: 'microsoft', type: 'cloud' },
      { id: 'phi-3-mini', name: 'Phi-3 Mini', providerId: 'microsoft', type: 'cloud' },
    ],
  },
  {
    id: 'nvidia',
    name: 'NVIDIA',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'nemotron-70b', name: 'Nemotron 70B', providerId: 'nvidia', type: 'cloud' },
      { id: 'nemotron-8b', name: 'Nemotron 8B', providerId: 'nvidia', type: 'cloud' },
    ],
  },
  {
    id: 'ibm',
    name: 'IBM',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.ibm.com/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'granite-13b', name: 'Granite 13B', providerId: 'ibm', type: 'cloud' },
    ],
  },
  {
    id: 'aws',
    name: 'AWS Bedrock',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://bedrock.api.aws/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'claude-3.5-sonnet-bedrock', name: 'Claude 3.5 Sonnet', providerId: 'aws', type: 'cloud' },
    ],
  },
  {
    id: 'databricks',
    name: 'Databricks',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.databricks.com/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'dbrx-instruct', name: 'DBRX Instruct', providerId: 'databricks', type: 'cloud' },
    ],
  },
  {
    id: 'youdao',
    name: 'Youdao',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://open.ai.youdao.com/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'youdao-pro', name: 'Youdao Pro', providerId: 'youdao', type: 'cloud' },
    ],
  },
  {
    id: 'stepfun',
    name: 'StepFun',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.stepfun.com/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'step-1-chat', name: 'Step-1 Chat', providerId: 'stepfun', type: 'cloud' },
      { id: 'step-1-vision', name: 'Step-1 Vision', providerId: 'stepfun', type: 'cloud' },
    ],
  },
  {
    id: 'stabilityai',
    name: 'Stability AI',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.stability.ai/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'stable-diffusion-xl', name: 'Stable Diffusion XL', providerId: 'stabilityai', type: 'cloud' },
    ],
  },
  {
    id: 'ai21',
    name: 'AI21 Labs',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.ai21.com/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'jamba-1.5', name: 'Jamba 1.5', providerId: 'ai21', type: 'cloud' },
    ],
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api-inference.huggingface.co/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'mistral', name: 'Mistral', providerId: 'huggingface', type: 'cloud' },
      { id: 'llama', name: 'Llama', providerId: 'huggingface', type: 'cloud' },
    ],
  },
  {
    id: 'togetherai',
    name: 'Together AI',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.together.xyz/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'llama-3-8b', name: 'Llama 3 8B', providerId: 'togetherai', type: 'cloud' },
      { id: 'llama-3-70b', name: 'Llama 3 70B', providerId: 'togetherai', type: 'cloud' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'llama3-8b', name: 'Llama 3 8B', providerId: 'groq', type: 'cloud' },
      { id: 'llama3-70b', name: 'Llama 3 70B', providerId: 'groq', type: 'cloud' },
    ],
  },
  {
    id: 'nous',
    name: 'Nous Research',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.nousresearch.com/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'hermes-3', name: 'Hermes 3', providerId: 'nous', type: 'cloud' },
    ],
  },
  {
    id: 'novita',
    name: 'Novita AI',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://api.novita.ai/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'llama-3', name: 'Llama 3', providerId: 'novita', type: 'cloud' },
    ],
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    type: 'cloud',
    apiKey: '',
    baseUrl: 'https://your-resource.openai.azure.com/v1',
    apiFormat: 'openai',
    enabled: false,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', providerId: 'azure', type: 'cloud' },
    ],
  },
]

export function createLocalProvider(config: {
  id?: string
  name?: string
  baseUrl: string
  apiKey?: string
  models?: ModelDefinition[]
}): ProviderConfig {
  return {
    id: config.id || 'local-llama',
    name: config.name || '本地模型',
    type: 'local',
    apiKey: config.apiKey || '',
    baseUrl: config.baseUrl,
    apiFormat: 'openai',
    enabled: true,
    models: config.models || [],
  }
}

export function loadProviders(): ProviderConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as ProviderConfig[]
      const merged = DEFAULT_CLOUD_PROVIDERS.map(defaultP => {
        const savedP = parsed.find(p => p.id === defaultP.id)
        if (savedP) {
          const safeBaseUrl = isForeignBaseUrl(defaultP.id, savedP.baseUrl) ? defaultP.baseUrl : savedP.baseUrl
          return {
            ...defaultP,
            ...savedP,
            baseUrl: safeBaseUrl,
            models: savedP.models.length > 0 ? savedP.models : defaultP.models,
          }
        }
        return defaultP
      })
      const localProviders = parsed.filter(p => p.type === 'local')
      return [...merged, ...localProviders]
    }
  } catch {}
  return DEFAULT_CLOUD_PROVIDERS
}

const KNOWN_DOMAINS: Record<string, string> = {
  deepseek: 'deepseek.com',
  volcengine: 'volces.com',
  minimax: 'minimaxi.com',
  xfyun: 'xf-yun.com',
  zhipu: 'bigmodel.cn',
  qwen: 'dashscope.aliyuncs.com',
  moonshot: 'moonshot.cn',
  baidu: 'baidubce.com',
  tencent: 'hunyuan.cloud.tencent.com',
  openai: 'openai.com',
  anthropic: 'anthropic.com',
  google: 'googleapis.com',
}

function isForeignBaseUrl(providerId: string, baseUrl: string): boolean {
  if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) return false
  for (const [id, domain] of Object.entries(KNOWN_DOMAINS)) {
    if (id === providerId) continue
    if (baseUrl.includes(domain)) return true
  }
  return false
}

export function saveProviders(providers: ProviderConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(providers))
  } catch {}
}

export function loadActiveModel(): ActiveModel | null {
  try {
    const saved = localStorage.getItem(ACTIVE_MODEL_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as ActiveModel
      if (parsed && parsed.modelId && parsed.baseUrl) {
        return parsed
      }
    }
  } catch {}
  return null
}

export function saveActiveModel(model: ActiveModel): void {
  try {
    const clean: ActiveModel = {
      modelId: model.modelId,
      providerId: model.providerId || '',
      modelName: model.modelName || model.modelId,
      providerName: model.providerName || '',
      type: model.type || 'cloud',
      baseUrl: model.baseUrl || '',
      apiKey: model.apiKey || '',
      apiFormat: model.apiFormat || 'openai',
      temperature: model.temperature ?? 0.7,
      maxTokens: model.maxTokens ?? 4096,
    }
    localStorage.setItem(ACTIVE_MODEL_KEY, JSON.stringify(clean))
  } catch {}
}

export function getAllModels(providers: ProviderConfig[]): ModelDefinition[] {
  return providers
    .filter(p => p.enabled)
    .flatMap(p => p.models)
}

export function getActiveModel(
  providers: ProviderConfig[],
  activeModelId: string | null
): ActiveModel | null {
  if (!activeModelId) return null

  for (const provider of providers) {
    const model = provider.models.find(m => m.id === activeModelId)
    if (model) {
      return {
        modelId: model.id,
        providerId: provider.id,
        modelName: model.name,
        providerName: provider.name,
        type: provider.type,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        apiFormat: provider.apiFormat,
        temperature: 0.7,
        maxTokens: 4096,
      }
    }
  }
  return null
}

export function getDefaultModel(providers: ProviderConfig[]): ModelDefinition | null {
  const allModels = getAllModels(providers)
  return allModels[0] || null
}

export async function checkLlamaCppHealth(baseUrl: string): Promise<boolean> {
  // 优先使用 Tauri 命令检查（无 CORS 问题）
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const ok: boolean = await invoke('llama_cpp_check_health', { url: baseUrl })
    return ok
  } catch {
    // 降级到直接 fetch
    const healthUrl = `${baseUrl.replace(/\/+$/, '')}/health`
    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      })
      return response.ok
    } catch {
      return false
    }
  }
}

export const LOCAL_MODEL_PATH_KEY = 'canai-local-model-path'

export function saveLocalModelPath(path: string): void {
  try { localStorage.setItem(LOCAL_MODEL_PATH_KEY, path) } catch {}
}

export function loadLocalModelPath(): string {
  try { return localStorage.getItem(LOCAL_MODEL_PATH_KEY) || '' } catch { return '' }
}

export function saveLocalModelConfig(config: {
  port: number
  host: string
  n_gpu_layers: number
  n_ctx: number
  threads: number
  batch_size: number
  mtp_tokens: number
  backend: string
}): void {
  try {
    localStorage.setItem(LOCAL_MODEL_CONFIG_KEY, JSON.stringify(config))
  } catch {}
}

export function loadLocalModelConfig(): {
  port: number
  host: string
  n_gpu_layers: number
  n_ctx: number
  threads: number
  batch_size: number
  mtp_tokens: number
  backend: string
} {
  try {
    const saved = localStorage.getItem(LOCAL_MODEL_CONFIG_KEY)
    if (saved) {
      return { ...loadDefaultConfig(), ...JSON.parse(saved) }
    }
  } catch {}
  return loadDefaultConfig()
}

function loadDefaultConfig() {
  return {
    port: 8080,
    host: '127.0.0.1',
    n_gpu_layers: -1,
    n_ctx: 4096,
    threads: 8,
    batch_size: 512,
    mtp_tokens: 0,
    backend: 'auto',
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  'deepseek-chat': { input: 2.5, output: 10 },
  'deepseek-reasoner': { input: 4, output: 16 },
  'deepseek-coder': { input: 2.5, output: 10 },
  'doubao-seed-2-0-code-250615': { input: 1.2, output: 4.8 },
  'doubao-seed-2-0-pro-250615': { input: 1.2, output: 4.8 },
  'doubao-seed-2-0-lite-250615': { input: 0.6, output: 2.4 },
  'doubao-seed-code-250120': { input: 1.2, output: 4.8 },
  'kimi-k2.5-250120': { input: 1.5, output: 6 },
  'glm-4-7-250120': { input: 1.8, output: 7.2 },
  'deepseek-v3.2-250120': { input: 2.5, output: 10 },
  'minimax-m2.5-250120': { input: 1.5, output: 6 },
  'MiniMax-M2.5': { input: 1.5, output: 6 },
  'MiniMax-M2.7': { input: 2, output: 8 },
  'abab6.5s-chat': { input: 1.5, output: 6 },
  'MiniMax-M2.5-highspeed': { input: 3, output: 12 },
  'astron-code-latest': { input: 2, output: 8 },
  'glm-4': { input: 1.8, output: 7.2 },
  'glm-4-plus': { input: 3.6, output: 14.4 },
  'glm-4-flash': { input: 0.6, output: 2.4 },
  'qwen-max': { input: 2.4, output: 9.6 },
  'qwen-plus': { input: 1.2, output: 4.8 },
  'qwen-turbo': { input: 0.6, output: 2.4 },
  'moonshot-v1-8k': { input: 3.2, output: 12.8 },
  'moonshot-v1-32k': { input: 6.4, output: 25.6 },
  'moonshot-v1-128k': { input: 12.8, output: 51.2 },
  'kimi-k2.6': { input: 3.2, output: 12.8 },
  'mimo-8b': { input: 1.5, output: 6 },
  'mimo-72b': { input: 3, output: 12 },
}

export function calculateCost(modelId: string, tokens: number): number {
  const price = MODEL_PRICES[modelId]
  if (!price) return 0
  return (tokens / 1000000) * price.output
}

export function formatDate(timestamp: number): string {
  if (timestamp === 0) return '-'
  const date = new Date(timestamp * 1000)
  return date.toLocaleString('zh-CN')
}
