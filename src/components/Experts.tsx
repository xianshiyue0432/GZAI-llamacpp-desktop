import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Users,
  X,
  Eye,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronRight,
  Plus,
  Check,
  Upload,
  RefreshCw,
  Search
} from 'lucide-react'

type ExpertTab = 'local' | 'orchestrate' | 'dashboard' | 'market'

const expertTabs: { id: ExpertTab; label: string }[] = [
  { id: 'local', label: '本地专家' },
  { id: 'orchestrate', label: '编排' },
  { id: 'dashboard', label: '协作看板' },
  { id: 'market', label: '专家广场' },
]

const AVATARS = [
  { emoji: '🧑‍💻', gradient: 'from-blue-400 to-purple-500' },
  { emoji: '👩‍🎨', gradient: 'from-pink-400 to-rose-500' },
  { emoji: '🧑‍🔬', gradient: 'from-emerald-400 to-teal-500' },
  { emoji: '👨‍🚀', gradient: 'from-cyan-400 to-blue-500' },
  { emoji: '🧑‍🏫', gradient: 'from-amber-400 to-orange-500' },
  { emoji: '👩‍💼', gradient: 'from-violet-400 to-purple-500' },
  { emoji: '🧑‍⚕️', gradient: 'from-green-400 to-emerald-500' },
  { emoji: '👨‍🍳', gradient: 'from-red-400 to-rose-500' },
  { emoji: '🧑‍🎤', gradient: 'from-fuchsia-400 to-pink-500' },
  { emoji: '👩‍🌾', gradient: 'from-lime-400 to-green-500' },
  { emoji: '🧑‍✈️', gradient: 'from-sky-400 to-indigo-500' },
  { emoji: '👨‍🔧', gradient: 'from-yellow-400 to-amber-500' },
]

const categories = ['全部', '办公类', '金融类', '生活类', '电商外贸类', '设计类', '营销类', '文档管理类', '数据分析类', '娱乐社交类']

interface Expert {
  id: string
  name: string
  avatar: string
  description: string
  category: string
  enabled: boolean
  identity: string
  bio: string
  memory: string
  diary: string
  skills: string[]
  workflow: string
}

const mockExperts: Expert[] = [
  { id: '1', name: 'Python全栈工程师', avatar: '🧑‍💻', description: '精通Python全栈开发，从后端到前端全覆盖', category: '全部', enabled: true, identity: '专业、高效、实用主义', bio: 'Who I Am\n我是Python全栈工程师，精通Django、FastAPI、React等主流框架。擅长从零搭建项目、优化系统性能、编写高质量可维护代码。\n\nHow I Talk\n务实直接，注重代码质量和工程实践。喜欢讨论架构设计和技术选型，给出可落地的方案。\n\nBoundaries\n我不做与编程无关的工作。\n不参与没有明确需求的设计讨论。\n代码审查时我会严格把关但尊重团队决定。', memory: 'MEMORY.md - Long-Term Memory\nCurated memories — the distilled essence, not raw logs.\nOnly loaded in main sessions.', diary: '', skills: ['python-automation', 'api-design', 'code-reviewer', 'database-optimizer'], workflow: '需求分析：理解业务需求，确定技术方案\n    ↓\n架构设计：设计系统架构，划分模块\n    ↓\n编码实现：编写高质量代码\n    ↓\n测试验证：编写单元测试和集成测试\n    ↓\n部署上线：CI/CD流水线部署' },
  { id: '2', name: '安全工程师', avatar: '🧑‍✈️', description: '网络安全专家，精通渗透测试和安全审计', category: '全部', enabled: true, identity: '严谨、细致、攻防兼备', bio: 'Who I Am\n资深安全工程师，专注于Web安全、渗透测试和安全架构设计。\n\nHow I Talk\n用数据说话，注重实际风险评级。', memory: '安全知识库持续更新中...', diary: '', skills: ['security-scanner', 'vuln-analyzer', 'pen-test-toolkit'], workflow: '信息收集：收集目标资产信息\n    ↓\n漏洞扫描：使用自动化工具扫描\n    ↓\n渗透测试：手动验证漏洞\n    ↓\n报告输出：生成安全评估报告' },
  { id: '3', name: '理财规划师', avatar: '👩‍💼', description: '个人理财规划，资产配置和投资建议', category: '金融类', enabled: false, identity: '理性、审慎、长期主义', bio: '我是一名CFP持证人，专注于个人财务规划和资产配置。', memory: '', diary: '', skills: ['financial-analyzer', 'risk-assessment'], workflow: '财务诊断：分析当前财务状况\n    ↓\n目标设定：确定理财目标\n    ↓\n方案设计：制定资产配置方案\n    ↓\n定期复盘：跟踪调整' },
  { id: '4', name: '云原生架构专家', avatar: '👨‍🚀', description: '专业、冷静、实战派，用云原生思维解决每一个架构难题', category: '全部', enabled: true, identity: '专业、冷静、实战派，用云原生思维解决每一个架构难题', bio: 'Who I Am\n我是云原生架构师，精通 Docker、Kubernetes、微服务、CI/CD 和可观测性全栈。我的使命是帮团队从单体平滑迁移到云原生，设计高可用、弹性伸缩的生产系统，实现基础设施即代码。\n\nHow I Talk\n专业但不装腔，喜欢用类比解释复杂概念。聊架构时我会先问现状，再给方案；聊技术时我偏好给可落地的配置和命令，而不是泛泛而谈。我的口头禅是："先跑起来，再优化。"\n\nBoundaries\n我不写业务代码，只专注架构和基础设施\n我不替你做最终决策，但会给你充分的利弊分析\n涉及生产环境变更时，我会强调灰度和回滚策略', memory: 'MEMORY.md - Long-Term Memory\nCurated memories — the distilled essence, not raw logs.\nOnly loaded in main sessions. Review daily files and keep what matters.', diary: '2026-05-22\n今天完成了K8s集群迁移方案设计，采用了原地升级策略，减少了80%的迁移时间。', skills: ['another-them', 'email-skilldocx', 'cloud-upload-b', 'mcporter', 'multi-search-enginepdfxlsx', 'find-skills', '10-云原生架构专家', 'persona-switch'], workflow: '现状评估：分析单体架构，确定迁移优先级和边界\n    ↓\n架构设计：划分微服务边界，设计通信方案和数据一致性策略\n    ↓\n容器化：编写Dockerfile，构建多阶段优化镜像\n    ↓\nK8s编排：编写Deployment/Service/Ingress/ConfigMap等manifest\n    ↓\nHelm打包：将K8s资源打包为Helm Chart，支持多环境部署\n    ↓\nCI/CD搭建：配置GitHub Actions/GitLab CI流水线，实现自动化构建部署\n    ↓\n可观测性接入：部署日志收集、指标监控、链路追踪三件套' },
  { id: '5', name: 'UI/UX设计师', avatar: '👩‍🎨', description: '专注于用户界面设计和交互体验优化', category: '设计类', enabled: false, identity: '创意、细腻、用户至上', bio: '拥有10年设计经验，擅长Figma、Sketch等设计工具。', memory: '', diary: '', skills: ['ui-generator', 'prototype-tool'], workflow: '需求分析\n    ↓\n原型设计\n    ↓\n视觉设计\n    ↓\n交互评审\n    ↓\n交付开发' },
  { id: '6', name: '数据分析师', avatar: '🧑‍🔬', description: '擅长数据挖掘、统计分析和大数据处理', category: '数据分析类', enabled: true, identity: '客观、严谨、数据驱动', bio: '资深数据分析师，精通SQL、Python、Tableau等工具。', memory: '', diary: '', skills: ['data-analyzer', 'chart-generator', 'sql-optimizer'], workflow: '数据采集\n    ↓\n数据清洗\n    ↓\n数据分析\n    ↓\n可视化呈现\n    ↓\n报告输出' },
]

function WorkflowFlow({ content, editing, editValue, onEditChange, onSave, onCancel }: {
  content: string; editing: boolean; editValue: string; onEditChange: (v: string) => void; onSave: () => void; onCancel: () => void
}) {
  const steps = content.split('↓').map(s => s.trim()).filter(Boolean)

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea value={editValue} onChange={(e) => onEditChange(e.target.value)} rows={8} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-blue-500 rounded-lg text-xs text-gray-700 dark:text-gray-300 focus:outline-none resize-none font-sans" autoFocus />
        <p className="text-xs text-gray-400 dark:text-gray-500">提示：每行写一个步骤，用英文的 <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">↓</code> 符号分隔步骤，系统会自动识别为流程图</p>
        <div className="flex gap-2">
          <button onClick={onSave} className="px-3 py-1 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600">保存</button>
          <button onClick={onCancel} className="px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-500">取消</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={i}>
          <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{i + 1}</div>
            <span className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{step}</span>
          </div>
          {i < steps.length - 1 && (
            <div className="flex justify-center py-1">
              <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ExpertDetailPanel({ expert, onClose, onToggle, onDelete }: { expert: Expert; onClose: () => void; onToggle: () => void; onDelete: () => void }) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [showSkillModal, setShowSkillModal] = useState(false)
  const avatarPickerRef = useRef<HTMLDivElement>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    bio: true, memory: true, diary: true, skills: true, workflow: true
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (avatarPickerRef.current && !avatarPickerRef.current.contains(e.target as Node)) {
        setShowAvatarPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleUploadImage = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        multiple: false,
        title: '选择头像图片',
        filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] }]
      })
      if (selected) {
        console.log('Selected avatar:', selected)
        setShowAvatarPicker(false)
      }
    } catch {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/png,image/jpeg,image/gif,image/svg+xml,image/webp'
      input.onchange = () => {
        if (input.files?.[0]) {
          console.log('Selected avatar:', input.files[0].name)
          setShowAvatarPicker(false)
        }
      }
      input.click()
    }
  }

  const allSkills = ['another-them', 'email-skilldocx', 'cloud-upload-b', 'mcporter', 'multi-search-enginepdfxlsx', 'find-skills', '10-云原生架构专家', 'persona-switch', 'python-automation', 'api-design', 'code-reviewer', 'database-optimizer', 'security-scanner', 'vuln-analyzer', 'pen-test-toolkit', 'financial-analyzer', 'risk-assessment', 'ui-generator', 'prototype-tool', 'data-analyzer', 'chart-generator', 'sql-optimizer']

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const startEdit = (field: string, value: string) => {
    setEditingField(field)
    setEditValue(value)
  }

  const cancelEdit = () => setEditingField(null)

  return (
    <div className="w-[580px] border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto">
      <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">专家配置</h2>
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* 头像 + 名称 + 身份描述 */}
        <div className="flex items-start gap-4">
          <div className="relative group">
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${AVATARS.find(a => a.emoji === expert.avatar)?.gradient || 'from-blue-400 to-purple-500'} flex items-center justify-center text-xl`}>
              {expert.avatar}
            </div>
            <button onClick={() => setShowAvatarPicker(!showAvatarPicker)} className="absolute -bottom-1 -right-1 w-6 h-6 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center text-gray-500 hover:text-blue-500 shadow-sm transition-colors">
              <Edit3 className="w-3 h-3" />
            </button>
            {showAvatarPicker && (
              <div ref={avatarPickerRef} className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 z-20 w-60">
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {AVATARS.map((a) => (
                    <button key={a.emoji} onClick={() => setShowAvatarPicker(false)} className={`w-11 h-11 rounded-full bg-gradient-to-br ${a.gradient} flex items-center justify-center text-base hover:ring-2 hover:ring-blue-500 transition-all ${expert.avatar === a.emoji ? 'ring-2 ring-blue-500 scale-110' : ''}`}>{a.emoji}</button>
                  ))}
                </div>
                <button onClick={handleUploadImage} className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <Upload className="w-3 h-3" />
                  上传图片
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {editingField === 'name' ? (
              <div className="space-y-1">
                <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-blue-500 rounded text-sm font-semibold text-gray-900 dark:text-white focus:outline-none" autoFocus />
                <div className="flex gap-1">
                  <button onClick={() => setEditingField(null)} className="px-2 py-0.5 bg-green-500 text-white rounded text-xs">保存</button>
                  <button onClick={cancelEdit} className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded text-xs">取消</button>
                </div>
              </div>
            ) : (
              <div className="group flex items-start gap-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{expert.name}</h3>
                <button onClick={() => startEdit('name', expert.name)} className="p-0.5 text-gray-300 group-hover:text-blue-500 transition-colors"><Edit3 className="w-3 h-3" /></button>
              </div>
            )}
            {editingField === 'identity' ? (
              <div className="space-y-1 mt-1">
                <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-blue-500 rounded text-xs text-gray-600 dark:text-gray-400 focus:outline-none" autoFocus />
                <div className="flex gap-1">
                  <button onClick={() => setEditingField(null)} className="px-2 py-0.5 bg-green-500 text-white rounded text-xs">保存</button>
                  <button onClick={cancelEdit} className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded text-xs">取消</button>
                </div>
              </div>
            ) : (
              <div className="group flex items-start gap-1 mt-0.5">
                <p className="text-xs text-gray-500 dark:text-gray-400">{expert.identity}</p>
                <button onClick={() => startEdit('identity', expert.identity)} className="p-0.5 text-gray-300 group-hover:text-blue-500 transition-colors"><Edit3 className="w-3 h-3" /></button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onToggle} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${expert.enabled ? 'bg-purple-500 text-white hover:bg-purple-600' : 'bg-green-500 text-white hover:bg-green-600'}`}>{expert.enabled ? '停用' : '启用'}</button>
          <button onClick={onDelete} className="px-3 py-1.5 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 transition-colors flex items-center gap-1"><Trash2 className="w-3 h-3" />删除</button>
        </div>

        {/* 5 个可折叠编辑区域 */}
        <CollapsibleSection title="专家简介" expanded={expandedSections.bio} onToggle={() => toggleSection('bio')} content={expert.bio} fieldKey="bio" editingField={editingField} editValue={editValue} onStartEdit={startEdit} onEditChange={setEditValue} onSaveEdit={() => setEditingField(null)} onCancelEdit={cancelEdit} placeholder="编辑专家简介..." />

        <CollapsibleSection title="记忆" expanded={expandedSections.memory} onToggle={() => toggleSection('memory')} content={expert.memory} fieldKey="memory" editingField={editingField} editValue={editValue} onStartEdit={startEdit} onEditChange={setEditValue} onSaveEdit={() => setEditingField(null)} onCancelEdit={cancelEdit} placeholder="暂无记忆内容" />

        <CollapsibleSection title="日记" expanded={expandedSections.diary} onToggle={() => toggleSection('diary')} content={expert.diary || '暂无日记'} fieldKey="diary" editingField={editingField} editValue={editValue} onStartEdit={startEdit} onEditChange={setEditValue} onSaveEdit={() => setEditingField(null)} onCancelEdit={cancelEdit} placeholder="暂无日记" />

        {/* 技能 */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button onClick={() => toggleSection('skills')} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <span className="text-sm font-medium text-gray-900 dark:text-white">技能</span>
            <div className="flex items-center gap-2">
              <div onClick={(e) => { e.stopPropagation(); setShowSkillModal(true) }} className="p-1 text-gray-400 hover:text-blue-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors" title="新增技能"><Plus className="w-3.5 h-3.5" /></div>
              {expandedSections.skills ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </div>
          </button>
          {expandedSections.skills && (
            <div className="px-4 py-3">
              <div className="flex flex-wrap gap-1.5">
                {expert.skills.map((skill) => (
                  <span key={skill} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">{skill}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 工作流程 */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button onClick={() => toggleSection('workflow')} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <span className="text-sm font-medium text-gray-900 dark:text-white">工作流程</span>
            <div className="flex items-center gap-2">
              <div onClick={(e) => { e.stopPropagation(); startEdit('workflow', expert.workflow) }} className="p-1 text-gray-400 hover:text-blue-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors" title="编辑"><Edit3 className="w-3.5 h-3.5" /></div>
              {expandedSections.workflow ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </div>
          </button>
          {expandedSections.workflow && (
            <div className="px-4 py-3">
              <WorkflowFlow
                content={expert.workflow}
                editing={editingField === 'workflow'}
                editValue={editValue}
                onEditChange={setEditValue}
                onSave={() => setEditingField(null)}
                onCancel={() => setEditingField(null)}
              />
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">取消</button>
          <button onClick={onClose} className="px-5 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm flex items-center gap-1.5"><Check className="w-4 h-4" />保存</button>
        </div>
      </div>

      {showSkillModal && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" onClick={() => setShowSkillModal(false)}>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-5 w-[420px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">选择技能</h3>
              <button onClick={() => setShowSkillModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              <label className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">全选</span>
              </label>
              <div className="border-t border-gray-200 dark:border-gray-700" />
              {allSkills.map((skill) => (
                <label key={skill} className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                  <input type="checkbox" checked={expert.skills.includes(skill)} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{skill}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowSkillModal(false)} className="px-4 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">取消</button>
              <button onClick={() => setShowSkillModal(false)} className="px-4 py-1.5 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 transition-colors">添加</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function CollapsibleSection({ title, expanded, onToggle, content, fieldKey, editingField, editValue, onStartEdit, onEditChange, onSaveEdit, onCancelEdit, placeholder }: {
  title: string; expanded: boolean; onToggle: () => void; content: string; fieldKey: string; editingField: string | null; editValue: string; onStartEdit: (f: string, v: string) => void; onEditChange: (v: string) => void; onSaveEdit: () => void; onCancelEdit: () => void; placeholder: string
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        <span className="text-sm font-medium text-gray-900 dark:text-white">{title}</span>
        <div className="flex items-center gap-2">
          <div onClick={(e) => { e.stopPropagation(); onStartEdit(fieldKey, content) }} className="p-1 text-gray-400 hover:text-blue-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors" title="编辑"><Edit3 className="w-3.5 h-3.5" /></div>
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 py-3">
          {editingField === fieldKey ? (
            <div className="space-y-2">
              <textarea value={editValue} onChange={(e) => onEditChange(e.target.value)} rows={8} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-blue-500 rounded-lg text-xs text-gray-700 dark:text-gray-300 focus:outline-none resize-none" autoFocus />
              <div className="flex gap-2">
                <button onClick={onSaveEdit} className="px-3 py-1 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600">保存</button>
                <button onClick={onCancelEdit} className="px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-500">取消</button>
              </div>
            </div>
          ) : (
            <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">{content || placeholder}</pre>
          )}
        </div>
      )}
    </div>
  )
}

function ExpertMarketView() {
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
    { name: 'minimax-Agent', url: 'https://agent.minimaxi.com/experts' },
  ])

  const mockMarketExperts = [
    { name: '代码架构师', author: 'openclaw', version: 'v1.2.0', desc: '负责系统架构设计和代码结构优化，精通微服务、DDD等架构模式。' },
    { name: '调试专家', author: 'openclaw', version: 'v1.1.3', desc: '精通代码调试和错误排查，支持多语言运行时分析。' },
    { name: 'UI 设计师', author: 'openclaw', version: 'v0.9.5', desc: '专注用户界面设计和交互体验，擅长Figma、Sketch等工具。' },
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
      const path = await save({ title: '保存专家Agent文件', filters: [{ name: 'Agent包', extensions: ['zip', 'tar.gz'] }] })
      if (path) console.log('Save to:', path)
    } catch {
      console.log('Download triggered')
    }
  }

  const handleInstall = () => {
    console.log('Install expert agent')
  }

  return (
    <div className="flex h-full w-full">
      <div className="w-56 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">专家市场</h3>
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

      <div className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{selectedSite} - 专家 Agent 列表</h2>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="搜索专家 Agent..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
        </div>
        <div className="space-y-2">
          {mockMarketExperts.filter(e => e.name.includes(searchQuery)).map((agent) => (
            <div key={agent.name} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{agent.name}</span>
                    <span className="text-xs text-gray-500">{agent.author}</span>
                    <span className="text-xs text-blue-500">{agent.version}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{agent.desc}</p>
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

      {contextMenu && (
        <div ref={contextMenuRef} className="fixed z-[200]" style={{ left: contextMenu.x, top: contextMenu.y }} onContextMenu={(e) => e.preventDefault()}>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 w-40">
            <button onClick={() => copyUrl(contextMenu.url)} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">复制网址</button>
          </div>
        </div>
      )}

      {showAddSite && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" onClick={() => setShowAddSite(false)}>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-5 w-[420px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">添加专家市场</h3>
            <input type="text" placeholder="输入专家市场网址" value={newSiteUrl} onChange={(e) => setNewSiteUrl(e.target.value)} className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white mb-4" />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setShowAddSite(false)} className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 transition-colors">取消</button>
              <button onClick={() => { setShowAddSite(false); setNewSiteUrl('') }} className="px-4 py-1.5 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 transition-colors">添加</button>
            </div>
          </div>
        </div>
      )}

      {copyToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">{copyToast}</div>
      )}
    </div>
  )
}

export default function Experts() {
  const [activeTab, setActiveTab] = useState<ExpertTab>('local')
  const [selectedCategory, setSelectedCategory] = useState('全部')
  const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null)
  const [experts, setExperts] = useState<Expert[]>(mockExperts)

  const toggleExpert = (id: string) => {
    setExperts(prev => prev.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e))
    if (selectedExpert?.id === id) setSelectedExpert(prev => prev ? { ...prev, enabled: !prev.enabled } : null)
  }

  const deleteExpert = (id: string) => {
    setExperts(prev => prev.filter(e => e.id !== id))
    if (selectedExpert?.id === id) setSelectedExpert(null)
  }

  const filteredExperts = experts.filter(e => selectedCategory === '全部' || e.category === selectedCategory)

  const renderLocalExperts = () => (
    <div className="flex h-full">
      {/* 左侧：类别列表 */}
      <div className="w-40 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-3 overflow-y-auto">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">专家类别</h3>
        <div className="space-y-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 中间：专家列表 */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{selectedCategory}专家 ({filteredExperts.length})</h2>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" placeholder="搜索专家..." className="w-full pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
          </div>
        </div>
        <div className="space-y-2">
          {filteredExperts.map((expert) => (
            <div key={expert.id} className={`p-3 rounded-lg border transition-all bg-white dark:bg-gray-800 ${selectedExpert?.id === expert.id ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'} hover:border-blue-500 dark:hover:border-blue-500`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${AVATARS.find(a => a.emoji === expert.avatar)?.gradient || 'from-blue-400 to-purple-500'} flex items-center justify-center text-base flex-shrink-0`}>{expert.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{expert.name}</span>
                      <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] rounded">{expert.category}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{expert.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 ml-3">
                  <button onClick={() => setSelectedExpert(expert)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors" title="查看"><Eye className="w-3.5 h-3.5" /></button>
                  <button onClick={() => toggleExpert(expert.id)} className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${expert.enabled ? 'bg-purple-500 text-white hover:bg-purple-600' : 'bg-green-500 text-white hover:bg-green-600'}`}>{expert.enabled ? '停用' : '启用'}</button>
                  <button onClick={() => setSelectedExpert(expert)} className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${expert.enabled ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-500 text-white hover:bg-gray-600'}`}>{expert.enabled ? '移除' : '配置'}</button>
                  <button onClick={() => deleteExpert(expert.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧：专家详情 */}
      {selectedExpert && (
        <ExpertDetailPanel expert={selectedExpert} onClose={() => setSelectedExpert(null)} onToggle={() => toggleExpert(selectedExpert.id)} onDelete={() => deleteExpert(selectedExpert.id)} />
      )}
    </div>
  )

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* 顶部标签栏 */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {expertTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelectedExpert(null) }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'local' && renderLocalExperts()}
        {activeTab === 'orchestrate' && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium">编排</p>
              <p className="text-xs text-gray-400 mt-1">编排功能正在开发中...</p>
            </div>
          </div>
        )}
        {activeTab === 'dashboard' && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium">协作看板</p>
              <p className="text-xs text-gray-400 mt-1">协作看板功能正在开发中...</p>
            </div>
          </div>
        )}
        {activeTab === 'market' && (
          <ExpertMarketView />
        )}
      </div>
    </div>
  )
}
