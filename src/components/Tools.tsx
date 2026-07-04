import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Terminal,
  Sparkles,
  Puzzle,
  Plug,
  Settings2,
  X,
  Upload,
  Zap,
  ExternalLink,
  Eye,
  Plus,
  RefreshCw,
  Trash2,
  Info,
  FolderOpen,
  Globe,
  GitBranch,
  Package,
  Check,
  Shield,
  Sliders,
  Download,
  Search,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react'
import GZAIStudio from './GZAIStudio'

type ToolTab = 'terminal' | 'skills' | 'mcp' | 'plugins'

const tabs: { id: ToolTab; icon: typeof Terminal; label: string }[] = [
  { id: 'skills', icon: Sparkles, label: '技能' },
  { id: 'mcp', icon: Puzzle, label: 'MCP' },
  { id: 'plugins', icon: Plug, label: '插件' },
  { id: 'terminal', icon: Terminal, label: '代码编辑终端' },
]

interface Skill {
  id: string
  name: string
  author: string
  version: string
  tags: string[]
  description: string
  enabled: boolean
}

const mockSkills: Skill[] = [
  { id: '1', name: 'agent-browser', author: 'jina.ai', version: 'v2.0.1', tags: ['浏览器', '外部技能'], description: 'Browser automation CLI for AI agents. Use when the user needs to interact with websites, fill forms, click buttons, and extract data.', enabled: true },
  { id: '2', name: 'agent-memory-systems', author: 'jina.ai', version: 'v0.0.3', tags: ['内存', '外部技能'], description: 'This is a composite skill that allows users to use memory constrained memory systems.', enabled: true },
  { id: '3', name: '文章润色', author: 'jina.ai', version: 'v0.0.1', tags: ['写作', '外部技能'], description: '智能分析文章语境，自动识别句式特点；提供多种风格润色方案，支持中英文双语文本优化。', enabled: true },
  { id: '4', name: '知识漫画', author: 'jina.ai', version: 'v0.0.2', tags: ['创意', '外部技能'], description: '轻松绘制简洁、可爱风格的图片/文本文档等多种图片，可保存为PNG。', enabled: true },
  { id: '5', name: '文章封面图', author: 'jina.ai', version: 'v0.0.2', tags: ['创意', '外部技能'], description: '5款独特文章封面，支持6种配色风格选择，根据场景创意定制。', enabled: false },
  { id: '6', name: 'Markdown 格式化', author: 'jina.ai', version: 'v0.0.1', tags: ['效率', '外部技能'], description: '文本格式化为规范 Markdown，自动添加 frontmatter/标题/列表/表格，支持中英文排版。', enabled: true },
  { id: '7', name: 'AI 图像生成', author: 'jina.ai', version: 'v0.0.3', tags: ['创意', '外部技能'], description: '多模型 AI 图像生成 (DALL-E, Imagen, 通义万象, Replicate)，支持多种比例、质量预设、提示词优化。', enabled: true },
]

interface MCP {
  id: string
  name: string
  author: string
  version: string
  tags: string[]
  description: string
  enabled: boolean
}

const mockMCP: MCP[] = [
  { id: '1', name: 'chrome-devtools', author: 'sfkit', version: 'v0.1.2', tags: ['内置', '工具', '已启用'], description: 'Chrome DevTools MCP (Google) - 提供浏览器自动化、开发者工具集成能力，支持页面操作、元素测试、网络监控等。', enabled: true },
  { id: '2', name: 'web-search', author: 'sfkit', version: 'v0.1.3', tags: ['内置', '工具', '已启用'], description: 'Web Search (DuckDuckGo) - 提供网页搜索能力，支持实时搜索互联网内容，获取最新信息。', enabled: true },
  { id: '3', name: 'filesystem-mcp', author: 'sfkit', version: 'v1.1.0', tags: ['内置', '工具', '已启用'], description: 'Filesystem MCP Server - 提供文件系统访问能力，支持读写文件、目录操作、文件管理等。', enabled: false },
  { id: '4', name: 'github-mcp', author: 'sfkit', version: 'v0.1.3', tags: ['内置', '工具', '已启用'], description: 'GitHub MCP Server - 提供GitHub仓库管理能力，支持创建issue、PR、代码浏览等操作。', enabled: false },
  { id: '5', name: 'memory-knowledge-graph', author: 'sfkit', version: 'v0.1.1', tags: ['内置', '工具', '已启用'], description: 'Memory & Knowledge Graph MCP - 提供持久化记忆和知识图谱存储能力，让Agent拥有长期记忆。', enabled: true },
]

function SkillsView() {
  const [activeTab, setActiveTab] = useState<'installed' | 'market'>('installed')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [skills, setSkills] = useState<Skill[]>(mockSkills)

  const toggleSkill = (id: string) => {
    setSkills(skills.map(skill => 
      skill.id === id ? { ...skill, enabled: !skill.enabled } : skill
    ))
    if (selectedSkill?.id === id) {
      setSelectedSkill(prev => prev ? { ...prev, enabled: !prev.enabled } : null)
    }
  }

  const deleteSkill = (id: string) => {
    setSkills(skills.filter(skill => skill.id !== id))
    if (selectedSkill?.id === id) {
      setSelectedSkill(null)
    }
  }

  if (activeTab === 'market') {
    return <SkillsMarketView onClose={() => setActiveTab('installed')} />
  }

  return (
      <div className="flex h-full">
        <>
        {/* 左侧列表栏 */}
      <div className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('installed')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors bg-blue-500 text-white"
            >
              已安装
            </button>
            <button
              onClick={() => setActiveTab('market')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              技能市场
            </button>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1">
              <Upload className="w-4 h-4" />
              导入本地
            </button>
            <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1">
              <Zap className="w-4 h-4" />
              AI 测评
            </button>
          </div>
        </div>

        <div className="relative mb-4">
          <input
            type="text"
            placeholder="搜索已安装技能..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
          />
        </div>

        <div className="space-y-3">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className={`p-4 rounded-lg border transition-all bg-white dark:bg-gray-800 ${
                selectedSkill?.id === skill.id
                  ? 'border-blue-500'
                  : 'border-gray-200 dark:border-gray-700'
              } hover:border-blue-500 dark:hover:border-blue-500`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className={`w-5 h-5 ${skill.enabled ? 'text-yellow-500' : 'text-gray-400'}`} />
                    <span className="font-semibold text-gray-900 dark:text-white">{skill.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{skill.author}</span>
                    <span className="text-xs text-blue-500">{skill.version}</span>
                  </div>
                  <div className="flex gap-2 mb-2">
                    {skill.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{skill.description}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedSkill(skill) }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="查看"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSkill(skill.id) }}
                    className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                      skill.enabled
                        ? 'bg-purple-500 text-white hover:bg-purple-600'
                        : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                  >
                    {skill.enabled ? '禁用' : '启用'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedSkill(skill) }}
                    className="px-4 py-1.5 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600 transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSkill(skill.id) }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧设置栏 */}
      {selectedSkill && (
        <div className="w-[480px] border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 overflow-y-auto">
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Skill 配置</h2>
              <button
                onClick={() => setSelectedSkill(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">技能名称</label>
                <input
                  type="text"
                  value={selectedSkill.name}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">技能描述</label>
                <textarea
                  value={selectedSkill.description}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">提示词</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="（空）"
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white pr-8"
                  />
                  <Info className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">模型</label>
                <select className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white">
                  <option value="">请选择模型...</option>
                  <option>DeepSeek Chat</option>
                  <option>DeepSeek Coder</option>
                  <option>GPT-4o</option>
                  <option>GPT-4o Mini</option>
                  <option>GPT-4 Turbo</option>
                  <option>GPT-3.5 Turbo</option>
                  <option>Claude Sonnet 4</option>
                  <option>Claude Opus 4</option>
                  <option>Qwen Plus</option>
                  <option>Qwen Max</option>
                  <option>Gemini Pro</option>
                  <option>Gemini Ultra</option>
                  <option>Moonshot Chat</option>
                  <option>Mistral Large</option>
                  <option>Grok 2</option>
                  <option>Spark 4.0</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">温度</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    defaultValue="0.7"
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400 w-10">0.7</span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedSkill(null)}
                className="px-5 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => setSelectedSkill(null)}
                className="px-5 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                保存
              </button>
            </div>
          </>
        </div>
      )}
      </>
    </div>
  )
}

function SkillsMarketView({ onClose }: { onClose: () => void }) {
  const [selectedSite, setSelectedSite] = useState<string>('全部')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddSite, setShowAddSite] = useState(false)
  const [newSiteUrl, setNewSiteUrl] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url: string; name: string } | null>(null)
  const [copyToast, setCopyToast] = useState('')

  const contextMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenu && contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  const [sites] = useState([
    { name: '全部', url: '' },
    { name: '腾讯skillHub', url: 'https://skillhub.cn/' },
    { name: 'openclaw龙虾技能市场', url: 'https://clawhub.ai/' },
    { name: 'minimax-skill', url: 'https://agent.minimaxi.com/skills' },
  ])

  const mockMarketSkills = [
    { name: 'agent-browser', author: 'jina.ai', version: 'v2.0.1', desc: 'Browser automation CLI for AI agents.' },
    { name: '文章润色', author: 'jina.ai', version: 'v0.0.1', desc: '智能分析文章语境，自动识别句式特点。' },
    { name: '知识漫画', author: 'jina.ai', version: 'v0.0.2', desc: '轻松绘制简洁、可爱风格的图片。' },
    { name: '文章封面图', author: 'jina.ai', version: 'v0.0.2', desc: '5款独特文章封面，支持6种配色风格。' },
    { name: 'Markdown 格式化', author: 'jina.ai', version: 'v0.0.1', desc: '文本格式化为规范 Markdown。' },
    { name: 'AI 图像生成', author: 'jina.ai', version: 'v0.0.3', desc: '多模型 AI 图像生成。' },
  ]

  const handleContextMenu = (e: React.MouseEvent, name: string, url: string) => {
    e.preventDefault()
    if (name === '全部') return
    setContextMenu({ x: e.clientX, y: e.clientY, url, name })
  }

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopyToast('已复制网址')
    } catch {
      setCopyToast('复制失败')
    }
    setContextMenu(null)
    setTimeout(() => setCopyToast(''), 2000)
  }

  const handleDownload = async () => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const path = await save({ title: '保存技能文件', filters: [{ name: '技能包', extensions: ['zip', 'tar.gz'] }] })
      if (path) console.log('Save to:', path)
    } catch {
      console.log('Download triggered')
    }
  }

  const handleInstall = () => {
    console.log('Install skill')
  }

  return (
    <div className="flex h-full w-full">
      {/* 左侧市场网站列表 */}
      <div className="w-56 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Skill 市场</h3>
          <button onClick={() => setShowAddSite(true)} className="p-1 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors" title="添加市场"><Plus className="w-3.5 h-3.5" /></button>
        </div>
        <div className="space-y-0.5">
          {sites.map((site) => (
            <button
              key={site.name}
              onClick={() => setSelectedSite(site.name)}
              onContextMenu={(e) => handleContextMenu(e, site.name, site.url)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedSite === site.name
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span className="truncate block">{site.name}</span>
              {site.url && <span className="text-[10px] text-gray-400 truncate block">{site.url}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 右侧技能列表 */}
      <div className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{selectedSite} - 技能列表</h2>
          <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">返回已安装</button>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="搜索 skill..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
        </div>
        <div className="space-y-2">
          {mockMarketSkills.filter(s => s.name.includes(searchQuery)).map((skill) => (
            <div key={skill.name} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{skill.name}</span>
                    <span className="text-xs text-gray-500">{skill.author}</span>
                    <span className="text-xs text-blue-500">{skill.version}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{skill.desc}</p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <button onClick={handleDownload} className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">下载</button>
                  <button onClick={handleInstall} className="px-2.5 py-1 bg-blue-500 text-white rounded text-[11px] font-medium hover:bg-blue-600 transition-colors">安装</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div ref={contextMenuRef} className="fixed z-[200]" style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 w-40">
            <button onClick={() => copyUrl(contextMenu.url)} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">复制网址</button>
          </div>
        </div>
      )}

      {/* 添加市场弹窗 */}
      {showAddSite && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" onClick={() => setShowAddSite(false)}>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-5 w-[420px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">添加 Skill 市场</h3>
            <input type="text" placeholder="输入 Skill 市场网址" value={newSiteUrl} onChange={(e) => setNewSiteUrl(e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white mb-4" />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setShowAddSite(false)} className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 transition-colors">取消</button>
              <button onClick={() => { setShowAddSite(false); setNewSiteUrl('') }} className="px-4 py-1.5 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 transition-colors">添加</button>
            </div>
          </div>
        </div>
      )}

      {/* 复制提示 */}
      {copyToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">{copyToast}</div>
      )}
    </div>
  )
}

function MCPMarketView({ onClose }: { onClose: () => void }) {
  const [selectedSite, setSelectedSite] = useState<string>('全部')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddSite, setShowAddSite] = useState(false)
  const [newSiteUrl, setNewSiteUrl] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url: string; name: string } | null>(null)
  const [copyToast, setCopyToast] = useState('')

  const contextMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenu && contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  const [sites] = useState([
    { name: '全部', url: '' },
    { name: 'MCP 官方注册表（权威官方源）', url: 'https://registry.modelcontextprotocol.io/' },
    { name: '阿里云魔搭 ModelScope MCP 广场', url: 'https://modelscope.cn/mcp' },
    { name: '火山引擎 MCP 资源站', url: 'https://www.volcengine.com/ark/mcp' },
    { name: 'AIbase 中文 MCP 资源站', url: 'https://www.aibase.com/mcp' },
    { name: 'AWS Labs MCP', url: 'https://awslabs.github.io/mcp/' },
    { name: 'Model Context Protocol', url: 'https://registry.modelcontextprotocol.io/' },
    { name: 'Anthropic MCP Server', url: 'https://github.com/anthropics/mcp' },
    { name: 'mcp.so（全球最大 MCP 应用商店）', url: 'https://mcp.so/' },
    { name: 'Smithery.ai（最火 MCP 市场）', url: 'https://smithery.ai/' },
    { name: 'LobeHub MCP 市场', url: 'https://mcp.lobehub.com/' },
  ])

  const mockMarketMCPs = [
    { name: 'chrome-devtools', author: 'sfkit', version: 'v0.1.2', desc: 'Chrome DevTools MCP - 浏览器自动化、开发者工具集成。' },
    { name: 'web-search', author: 'sfkit', version: 'v0.1.3', desc: 'Web Search (DuckDuckGo) - 实时搜索互联网内容。' },
    { name: 'filesystem-mcp', author: 'sfkit', version: 'v1.1.0', desc: 'Filesystem MCP Server - 文件系统访问能力。' },
    { name: 'github-mcp', author: 'sfkit', version: 'v0.1.3', desc: 'GitHub MCP Server - GitHub 仓库管理能力。' },
    { name: 'memory-knowledge-graph', author: 'sfkit', version: 'v0.1.1', desc: 'Memory & Knowledge Graph MCP - 持久化记忆存储。' },
  ]

  const handleContextMenu = (e: React.MouseEvent, name: string, url: string) => {
    e.preventDefault()
    if (name === '全部') return
    setContextMenu({ x: e.clientX, y: e.clientY, url, name })
  }

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopyToast('已复制网址')
    } catch {
      setCopyToast('复制失败')
    }
    setContextMenu(null)
    setTimeout(() => setCopyToast(''), 2000)
  }

  const handleDownload = async () => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const path = await save({ title: '保存 MCP 文件', filters: [{ name: 'MCP包', extensions: ['zip', 'tar.gz'] }] })
      if (path) console.log('Save to:', path)
    } catch {
      console.log('Download triggered')
    }
  }

  const handleInstall = () => {
    console.log('Install MCP')
  }

  return (
    <div className="flex h-full w-full">
      {/* 左侧市场网站列表 */}
      <div className="w-56 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">MCP 市场</h3>
          <button onClick={() => setShowAddSite(true)} className="p-1 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors" title="添加市场"><Plus className="w-3.5 h-3.5" /></button>
        </div>
        <div className="space-y-0.5">
          {sites.map((site) => (
            <button
              key={site.name}
              onClick={() => setSelectedSite(site.name)}
              onContextMenu={(e) => handleContextMenu(e, site.name, site.url)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedSite === site.name
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span className="truncate block">{site.name}</span>
              {site.url && <span className="text-[10px] text-gray-400 truncate block">{site.url}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 右侧 MCP 列表 */}
      <div className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{selectedSite} - MCP 列表</h2>
          <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">返回已安装</button>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="搜索 MCP..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
        </div>
        <div className="space-y-2">
          {mockMarketMCPs.filter(m => m.name.includes(searchQuery)).map((mcp) => (
            <div key={mcp.name} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Puzzle className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{mcp.name}</span>
                    <span className="text-xs text-gray-500">{mcp.author}</span>
                    <span className="text-xs text-blue-500">{mcp.version}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{mcp.desc}</p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <button onClick={handleDownload} className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">下载</button>
                  <button onClick={handleInstall} className="px-2.5 py-1 bg-blue-500 text-white rounded text-[11px] font-medium hover:bg-blue-600 transition-colors">安装</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div ref={contextMenuRef} className="fixed z-[200]" style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 w-44">
            <button onClick={() => copyUrl(contextMenu.url)} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">复制网址</button>
          </div>
        </div>
      )}

      {/* 添加市场弹窗 */}
      {showAddSite && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" onClick={() => setShowAddSite(false)}>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-5 w-[420px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">添加 MCP 市场</h3>
            <input type="text" placeholder="输入 MCP 市场网址" value={newSiteUrl} onChange={(e) => setNewSiteUrl(e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white mb-4" />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setShowAddSite(false)} className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 transition-colors">取消</button>
              <button onClick={() => { setShowAddSite(false); setNewSiteUrl('') }} className="px-4 py-1.5 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 transition-colors">添加</button>
            </div>
          </div>
        </div>
      )}

      {/* 复制提示 */}
      {copyToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">{copyToast}</div>
      )}
    </div>
  )
}

function MCPView() {
  const [activeTab, setActiveTab] = useState<'installed' | 'market'>('installed')
  const [selectedMCP, setSelectedMCP] = useState<MCP | null>(null)
  const [mcps, setMcps] = useState<MCP[]>(mockMCP)

  const toggleMCP = (id: string) => {
    setMcps(mcps.map(mcp => 
      mcp.id === id ? { ...mcp, enabled: !mcp.enabled } : mcp
    ))
    if (selectedMCP?.id === id) {
      setSelectedMCP(prev => prev ? { ...prev, enabled: !prev.enabled } : null)
    }
  }

  if (activeTab === 'market') {
    return <MCPMarketView onClose={() => setActiveTab('installed')} />
  }

  return (
    <div className="flex h-full">
      <>
      {/* 左侧列表栏 */}
      <div className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('installed')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors bg-blue-500 text-white"
            >
              已安装
            </button>
            <button
              onClick={() => setActiveTab('market')}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              MCP市场
            </button>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1">
              <Plus className="w-4 h-4" />
              添加服务器
            </button>
            <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1">
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Puzzle className="w-5 h-5" />
          MCP 服务器管理
        </h2>

        <div className="space-y-3">
          {mcps.map((mcp) => (
            <div
              key={mcp.id}
              className={`p-4 rounded-lg border transition-all bg-white dark:bg-gray-800 ${
                selectedMCP?.id === mcp.id
                  ? 'border-blue-500'
                  : 'border-gray-200 dark:border-gray-700'
              } hover:border-blue-500 dark:hover:border-blue-500`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Puzzle className={`w-5 h-5 ${mcp.enabled ? 'text-green-500' : 'text-gray-400'}`} />
                    <span className="font-semibold text-gray-900 dark:text-white">{mcp.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{mcp.author}</span>
                    <span className="text-xs text-blue-500">{mcp.version}</span>
                  </div>
                  <div className="flex gap-2 mb-2">
                    {mcp.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{mcp.description}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleMCP(mcp.id) }}
                    className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                      mcp.enabled
                        ? 'bg-purple-500 text-white hover:bg-purple-600'
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                  >
                    {mcp.enabled ? '停用' : '应用'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedMCP(mcp) }}
                    className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                      mcp.enabled
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-gray-500 text-white hover:bg-gray-600'
                    }`}
                  >
                    {mcp.enabled ? '移除' : '配置'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation() }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧设置栏 */}
      {selectedMCP && (
        <div className="w-[560px] border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 overflow-y-auto">
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">MCP 配置</h2>
              <button
                onClick={() => setSelectedMCP(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">

              {/* 标题说明 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">MCP</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">按当前支持的字段添加一个自定义MCP服务。</p>
              </div>

              {/* 名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">名称 <span className="text-red-500">*</span></label>
                <input type="text" placeholder="MCP 服务名称" className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
              </div>

              {/* 配置范围 */}
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <span className="font-medium">配置范围：</span>这个页面只管理全局用户MCP，以保证速度和清晰度。项目级MCP将放到聊天页的斜杠命令体验里。
                </p>
              </div>

              {/* 传输协议 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">传输协议</label>
                <div className="flex gap-2">
                  {['STDIO', 'Streamable HTTP', 'SSE'].map((protocol) => (
                    <button
                      key={protocol}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                        protocol === 'STDIO'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                      }`}
                    >
                      {protocol}
                    </button>
                  ))}
                </div>
              </div>

              {/* 启动命令 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">启动命令 <span className="text-red-500">*</span></label>
                <input type="text" placeholder="npx、Python、uVX、py、pythonw" className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  STDIO MCP 命令会直接在宿主机上运行。像 Node.js、Python、Bun、uv 这类运行时需要用户自己安装，并确保这个命令在 PATH 里可用。
                </p>
              </div>

              {/* 参数 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">参数</label>
                  <button className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="删除参数">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">空格分隔，或每行一个；路径含空格请用引号包裹</p>
                <textarea
                  placeholder={'chrome-devtools-mcp@latest\n如：-m openakita.mcp_servers.web_search\n或每行一个参数:\n-y\n@anthropic/mcp-server-filesystem\n"C:\\My Path\\dir"'}
                  rows={5}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white resize-none"
                />
              </div>

              {/* 环境变量 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">环境变量</label>
                  <button className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="删除环境变量">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">每行一个，格式 KEY=VALUE</p>
                <textarea
                  placeholder={'API_KEY=sk-xXx\nMY_VAR=hello'}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white resize-none"
                />
              </div>

              {/* 启动时自动连接 */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">启动时自动连接</span>
                <button className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${true ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${true ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setSelectedMCP(null)}
                  className="px-5 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => setSelectedMCP(null)}
                  className="px-5 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  保存
                </button>
              </div>

            </div>
          </>
        </div>
      )}
      </>
    </div>
  )
}

interface PluginItem {
  id: string
  name: string
  displayName: string
  description: string
  version: string
  author: string
  source: 'npm' | 'clawhub' | 'git' | 'local'
  enabled: boolean
  installedAt: string
  homepage?: string
  icon?: string
}

function PluginExpertSelector() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>(['代码架构师', '调试专家'])
  const experts = ['代码架构师', '调试专家', 'UI 设计师', '数据分析师', '安全专家', '性能优化师']
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (name: string) => {
    setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
      >
        <span className={selected.length === 0 ? 'text-gray-400' : ''}>
          {selected.length === 0 ? '选择专家...' : `已选 ${selected.length} 个专家`}
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50">
          <div className="p-2 max-h-48 overflow-y-auto">
            {experts.map((name) => (
              <label
                key={name}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(name)}
                  onChange={() => toggle(name)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{name}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 p-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => { setSelected([]); setOpen(false) }}
              className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-1.5 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ToggleRow({ label, desc, defaultOn }: { label: string; desc: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => setOn(!on)}
        className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
          on ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
            on ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

function PluginsView() {
  const [plugins, setPlugins] = useState<PluginItem[]>([
    { id: 'p1', name: 'nsp-clawguard', displayName: 'ClawGuard 安全防护', description: '实时监控和防护插件，提供代码安全扫描、依赖漏洞检测和运行时异常告警功能，支持自定义安全策略规则。', version: '2.1.0', author: 'nsp-team', source: 'npm', enabled: true, installedAt: '2026-05-20 14:30:22' },
    { id: 'p2', name: 'nsp-code-reviewer', displayName: 'AI Code Reviewer', description: '基于AI的代码审查插件，自动检测代码质量问题、性能瓶颈和安全隐患，提供修改建议和最佳实践指导。', version: '1.3.2', author: 'openclaw', source: 'clawhub', enabled: true, installedAt: '2026-05-18 09:15:47' },
    { id: 'p3', name: 'nsp-terminal-pro', displayName: 'Terminal Pro 增强', description: '增强终端功能的插件，支持多标签页、主题自定义、输出高亮、命令补全和历史搜索等功能。', version: '0.8.5', author: 'sfkit', source: 'git', enabled: false, installedAt: '2026-05-15 16:42:10' },
    { id: 'p4', name: 'auto-commit', displayName: 'Auto Commit 智能提交', description: '自动分析代码变更并生成规范的提交信息，支持多语言、自定义提交模板和Git工作流集成。', version: '1.0.0', author: 'devtools', source: 'npm', enabled: true, installedAt: '2026-05-12 11:08:33' },
    { id: 'p5', name: 'local-mcp-bridge', displayName: 'MCP Bridge 本地桥接', description: '本地加载的MCP桥接插件，用于连接和管理本地MCP服务器实例。', version: '0.1.0', author: 'local', source: 'local', enabled: false, installedAt: '2026-05-10 08:00:00' },
  ])
  const [showInstall, setShowInstall] = useState(false)
  const [selectedPlugin, setSelectedPlugin] = useState<PluginItem | null>(null)
  const [installSource, setInstallSource] = useState<'npm' | 'clawhub' | 'git' | 'local'>('npm')
  const [packageName, setPackageName] = useState('')
  const [version, setVersion] = useState('')
  const [registryUrl, setRegistryUrl] = useState('')

  const togglePlugin = (id: string) => {
    setPlugins(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p))
    if (selectedPlugin?.id === id) {
      setSelectedPlugin(prev => prev ? { ...prev, enabled: !prev.enabled } : null)
    }
  }

  const deletePlugin = (id: string) => {
    setPlugins(prev => prev.filter(p => p.id !== id))
    if (selectedPlugin?.id === id) setSelectedPlugin(null)
  }

  const handleInstall = () => {
    if (!packageName.trim()) return
    const newPlugin: PluginItem = {
      id: `plugin-${Date.now()}`,
      name: packageName.trim(),
      displayName: packageName.trim(),
      description: '已安装的插件，可在右侧查看详细配置。',
      version: version || 'latest',
      author: 'unknown',
      source: installSource,
      enabled: true,
      installedAt: new Date().toLocaleString('zh-CN'),
    }
    setPlugins(prev => [...prev, newPlugin])
    setShowInstall(false)
    setPackageName('')
    setVersion('')
    setRegistryUrl('')
  }

  const handleBrowseLocal = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({ directory: true, multiple: false, title: '选择本地插件目录' })
      if (selected && typeof selected === 'string') {
        setPackageName(selected)
      }
    } catch {
      const path = prompt('请选择本地插件包路径:')
      if (path) setPackageName(path)
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Plug className="w-5 h-5" />
            插件管理
          </h2>
          <button
            onClick={() => setShowInstall(true)}
            className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            安装插件
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">安装和管理插件，扩展应用功能。</p>

        {plugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Package className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">暂无已安装插件</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">点击右上角"安装插件"开始</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plugins.map((plugin) => (
              <div
                key={plugin.id}
                className={`p-4 rounded-lg border transition-all bg-white dark:bg-gray-800 ${
                  selectedPlugin?.id === plugin.id
                    ? 'border-blue-500'
                    : 'border-gray-200 dark:border-gray-700'
                } hover:border-blue-500 dark:hover:border-blue-500`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className={`w-5 h-5 ${plugin.enabled ? 'text-blue-500' : 'text-gray-400'}`} />
                      <span className="font-semibold text-gray-900 dark:text-white">{plugin.displayName}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{plugin.author}</span>
                      <span className="text-xs text-blue-500">v{plugin.version}</span>
                      <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded">{plugin.source}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{plugin.description}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedPlugin(plugin) }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="查看"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePlugin(plugin.id) }}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        plugin.enabled
                          ? 'bg-purple-500 text-white hover:bg-purple-600'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {plugin.enabled ? '停用' : '应用'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedPlugin(plugin) }}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        plugin.enabled
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-gray-500 text-white hover:bg-gray-600'
                      }`}
                    >
                      {plugin.enabled ? '移除' : '配置'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deletePlugin(plugin.id) }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 插件详情右侧面板 */}
      {selectedPlugin && (
        <div className="w-[560px] border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">插件配置 - {selectedPlugin.displayName}</h2>
            <button
              onClick={() => setSelectedPlugin(null)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">

            {/* ===== 模块 1：启用插件 ===== */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">启用插件</span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">开启或关闭此插件的所有功能</p>
              </div>
              <button
                onClick={() => togglePlugin(selectedPlugin.id)}
                className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                  selectedPlugin.enabled ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    selectedPlugin.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* ===== 模块 2：核心设置 ===== */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                核心设置
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">显示名称</label>
                  <input type="text" defaultValue={selectedPlugin.displayName} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">包名 / 标识符</label>
                  <input type="text" value={selectedPlugin.name} disabled className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">版本号</label>
                  <input type="text" value={selectedPlugin.version} disabled className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">插件描述</label>
                  <textarea defaultValue={selectedPlugin.description} rows={3} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">作者 / 开发者</label>
                  <input type="text" defaultValue={selectedPlugin.author} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">插件图标（可选）</label>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                      <Upload className="w-5 h-5 text-gray-400" />
                    </div>
                    <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">上传图标</button>
                    <span className="text-xs text-gray-400">推荐 128×128 PNG</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* ===== 模块 3：功能配置 ===== */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                功能配置
              </h4>
              <div className="space-y-4">
                <ToggleRow label="自动执行" desc="启动时自动加载此插件" defaultOn={true} />
                <ToggleRow label="后台运行" desc="允许在后台持续运行" defaultOn={false} />
                <ToggleRow label="日志输出" desc="输出详细运行日志" defaultOn={true} />
                <ToggleRow label="异常自动重启" desc="插件崩溃后自动重启服务" defaultOn={true} />
                <ToggleRow label="开机自启" desc="系统开机自动启动插件" defaultOn={false} />
                <ToggleRow label="快捷键触发" desc="允许使用全局快捷键唤起插件" defaultOn={false} />
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* ===== 模块 4：调用与权限配置 ===== */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                调用与权限配置
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">触发关键词</label>
                  <input type="text" placeholder="用于 AI / 专家 Agent 调用指令" className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">调用方式</label>
                  <select className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white">
                    <option>手动调用</option>
                    <option>自动调用</option>
                    <option>关键词触发</option>
                  </select>
                </div>
                <ToggleRow label="终端 Shell 权限" desc="允许执行系统终端命令" defaultOn={true} />
                <ToggleRow label="文件读写权限" desc="允许访问本地文件读写" defaultOn={false} />
                <ToggleRow label="网络访问权限" desc="允许插件联网请求" defaultOn={false} />
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">命令执行白名单</label>
                  <p className="text-xs text-gray-400 mb-1">仅允许列表内的系统命令</p>
                  <textarea placeholder="npm&#10;git&#10;node" rows={3} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white resize-none" />
                </div>
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">绑定可用专家</label>
                  <p className="text-xs text-gray-400 mb-1">选择可调用此插件的专家 Agent</p>
                  <PluginExpertSelector />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* ===== 模块 5：高级参数配置 ===== */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                高级参数配置
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">命令执行超时时间（秒）</label>
                  <input type="number" defaultValue={30} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">最大并发执行数</label>
                  <input type="number" defaultValue={5} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">自定义环境变量</label>
                  <p className="text-xs text-gray-400 mb-1">配置 PATH、代理等系统环境变量</p>
                  <textarea placeholder="PATH=/usr/local/bin:${PATH}&#10;HTTP_PROXY=http://proxy:8080" rows={3} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">日志级别</label>
                  <select className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white">
                    <option>DEBUG</option>
                    <option selected>INFO</option>
                    <option>WARN</option>
                    <option>ERROR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">日志保存路径</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="/var/log/plugins/" className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                    <button className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">浏览</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* ===== 模块 6：依赖与权限信息（只读） ===== */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Info className="w-4 h-4" />
                依赖与权限信息
              </h4>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">运行时依赖</span>
                  <span className="text-gray-900 dark:text-white text-xs font-medium">{selectedPlugin.source === 'npm' ? 'Node.js ≥ 18.0' : selectedPlugin.source === 'git' ? 'Git + Node.js' : 'Python 3.8+'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">所需权限</span>
                  <span className="text-gray-900 dark:text-white text-xs font-medium">{selectedPlugin.id === 'p1' ? '文件系统、网络' : selectedPlugin.id === 'p2' ? '文件系统、网络、Shell' : selectedPlugin.id === 'p3' ? '终端、Shell' : selectedPlugin.id === 'p4' ? 'Git、文件系统' : '文件系统、Shell'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">API 端点</span>
                  <span className="text-gray-900 dark:text-white text-xs font-medium">{selectedPlugin.source === 'npm' ? '—' : selectedPlugin.source === 'clawhub' ? 'https://api.clawhub.com' : selectedPlugin.source === 'git' ? '—' : 'http://localhost:9120'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">内存占用</span>
                  <span className="text-gray-900 dark:text-white text-xs font-medium">{selectedPlugin.id === 'p1' ? '~32 MB' : selectedPlugin.id === 'p2' ? '~48 MB' : selectedPlugin.id === 'p3' ? '~16 MB' : selectedPlugin.id === 'p4' ? '~8 MB' : '~4 MB'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">安装路径</span>
                  <span className="text-gray-900 dark:text-white text-xs font-medium truncate max-w-[240px]">plugins/{selectedPlugin.name}@v{selectedPlugin.version}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">安装时间</span>
                  <span className="text-gray-900 dark:text-white text-xs font-medium">{selectedPlugin.installedAt}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">更新时间</span>
                  <span className="text-gray-900 dark:text-white text-xs font-medium">—</span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* ===== 底部操作按钮 ===== */}
            <div className="flex items-center justify-end gap-3">
              <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1.5">
                <Download className="w-4 h-4" />
                导出配置
              </button>
              <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4" />
                重置默认
              </button>
              <button className="px-5 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                保存设置
              </button>
            </div>

          </div>
        </div>
      )}

      {showInstall && createPortal(
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
          onClick={() => setShowInstall(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-6 w-[520px] max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">安装插件</h3>
              <button
                onClick={() => setShowInstall(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-5">
              {/* 来源 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">来源</label>
                <div className="flex gap-2">
                  {[
                    { value: 'npm', label: 'npm', icon: Package },
                    { value: 'clawhub', label: 'ClawHub', icon: Globe },
                    { value: 'git', label: 'Git', icon: GitBranch },
                    { value: 'local', label: '本地路径', icon: FolderOpen },
                  ].map((source) => {
                    const Icon = source.icon
                    return (
                      <button
                        key={source.value}
                        onClick={() => {
                          setInstallSource(source.value as any)
                          if (source.value === 'local') handleBrowseLocal()
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg border text-sm font-medium transition-all ${
                          installSource === source.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {source.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 包名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">包名</label>
                <input
                  type="text"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="e.g. nsp-clawguard"
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>

              {/* 版本 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">版本</label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="可选，默认latest"
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>

              {/* Registry URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Registry URL</label>
                <input
                  type="text"
                  value={registryUrl}
                  onChange={(e) => setRegistryUrl(e.target.value)}
                  placeholder="可选，默认官方npm registry"
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowInstall(false)}
                className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleInstall}
                disabled={!packageName.trim()}
                className="px-5 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                安装插件
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default function Tools({ projectFolder }: { projectFolder?: string }) {
  const [activeTab, setActiveTab] = useState<ToolTab>('terminal')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const renderContent = () => {
    switch (activeTab) {
      case 'terminal':
        return (
          <div className="h-full w-full">
            <GZAIStudio
              cwd={projectFolder}
              onClose={() => {}}
              embedded={true}
            />
          </div>
        )
      case 'skills':
        return <SkillsView />
      case 'mcp':
        return <MCPView />
      case 'plugins':
        return <PluginsView />
    }
  }

  return (
    <div className="h-full flex bg-gray-50 dark:bg-gray-900">
      <div className={`flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 py-4 overflow-y-auto transition-all duration-300 ${
        sidebarCollapsed ? 'w-0 overflow-hidden px-0' : 'w-48'
      }`}>
        <div className="px-4 mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">工具</h2>
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
            className="p-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors shadow-sm"
            title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>
        {renderContent()}
      </div>
    </div>
  )
}
