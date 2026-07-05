import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Editor, { loader } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import type { Terminal as XTermTerminal } from '@xterm/xterm'
import type { FitAddon as XTermFitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { FolderOpen, Search } from 'lucide-react'
import { terminalApi } from '../api/terminal'

const MONACO_CDN = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs'
if (typeof window !== 'undefined') {
  const isTauri = '__TAURI_INTERNALS__' in window || !window.location.protocol.startsWith('http')
  if (isTauri) {
    loader.config({ paths: { vs: MONACO_CDN } })
  } else {
    ;(window as any).MonacoEnvironment = {
      getWorkerUrl: function (_moduleId: string, label: string) {
        if (label === 'json') return new URL(/* @vite-ignore */ 'monaco-editor/esm/vs/language/json/json.worker?worker', import.meta.url).href
        if (label === 'css' || label === 'scss' || label === 'less') return new URL(/* @vite-ignore */ 'monaco-editor/esm/vs/language/css/css.worker?worker', import.meta.url).href
        if (label === 'html' || label === 'handlebars' || label === 'razor') return new URL(/* @vite-ignore */ 'monaco-editor/esm/vs/language/html/html.worker?worker', import.meta.url).href
        if (label === 'typescript' || label === 'javascript') return new URL(/* @vite-ignore */ 'monaco-editor/esm/vs/language/typescript/ts.worker?worker', import.meta.url).href
        return new URL(/* @vite-ignore */ 'monaco-editor/esm/vs/editor/editor.worker?worker', import.meta.url).href
      },
    }
  }
}

type TerminalType = 'powershell' | 'cmd' | 'bash' | 'python' | 'nodejs' | 'wsl' | 'git' | 'docker' | 'ssh' | 'java' | 'cli' | 'terminal'
type TerminalTabType = 'console' | 'problems' | 'output' | 'debug' | 'terminal'
type ModuleType = 'editor' | 'terminal' | 'document' | 'browser' | 'git' | 'figma' | 'agent' | 'mcp' | 'settings'

interface ModuleTab { id: string; type: ModuleType; name: string; icon: string }
interface OpenFile { id: string; name: string; path: string; content: string; language: string; modified: boolean }
interface TerminalInstance { id: number; name: string; type: TerminalType; active: boolean }
interface FileNode { name: string; path: string; type: 'file' | 'directory'; children?: FileNode[] }

interface GZAIStudioProps { cwd?: string; onClose: () => void; embedded?: boolean }

const IGNORED_DIR_NAMES = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', '.next', '.nuxt',
  '__pycache__', '.cache', '.turbo', '.output',
  'coverage', '.pytest_cache', '.mypy_cache', '.venv', 'venv',
  '.DS_Store', 'Thumbs.db', '.idea', '.vscode',
])

const directoryCache = new Map<string, FileNode[]>()
const loadingPaths = new Set<string>()

async function readDirEntries(dirPath: string): Promise<FileNode[]> {
  if (directoryCache.has(dirPath)) return directoryCache.get(dirPath)!
  if (loadingPaths.has(dirPath)) {
    let attempts = 0
    while (loadingPaths.has(dirPath) && attempts < 50) { await new Promise(r => setTimeout(r, 50)); attempts++ }
    return directoryCache.get(dirPath) || []
  }
  loadingPaths.add(dirPath)
  try {
    const { readDir } = await import('@tauri-apps/plugin-fs')
    const entries = await readDir(dirPath)
    const nodes: FileNode[] = []
    for (const entry of entries) {
      if (!entry.name || IGNORED_DIR_NAMES.has(entry.name)) continue
      if (entry.name.startsWith('.')) continue
      const nodePath = dirPath + (dirPath.endsWith('\\') || dirPath.endsWith('/') ? '' : '/') + entry.name
      nodes.push({ name: entry.name, path: nodePath, type: entry.isDirectory ? 'directory' : 'file', children: undefined })
    }
    nodes.sort((a, b) => { if (a.type !== b.type) return a.type === 'directory' ? -1 : 1; return a.name.localeCompare(b.name) })
    directoryCache.set(dirPath, nodes)
    return nodes
  } catch { return [] }
  finally { loadingPaths.delete(dirPath) }
}

async function buildFileTreeFromPath(dirPath: string, depth = 1): Promise<FileNode[]> {
  const entries = await readDirEntries(dirPath)
  const result: FileNode[] = []
  if (depth <= 1) {
    const dirEntries = entries.filter(e => e.type === 'directory')
    const fileEntries = entries.filter(e => e.type === 'file')
    const dirResults = await Promise.all(dirEntries.map(async (entry) => {
      try { const children = await readDirEntries(entry.path); return { ...entry, children } }
      catch { return { ...entry, children: [] } }
    }))
    result.push(...dirResults, ...fileEntries)
  } else {
    for (const entry of entries) {
      result.push(entry.type === 'directory' ? { ...entry, children: undefined } : entry)
    }
  }
  result.sort((a, b) => { if (a.type !== b.type) return a.type === 'directory' ? -1 : 1; return a.name.localeCompare(b.name) })
  return result
}

function clearDirectoryCache() { directoryCache.clear() }

const MODULE_META: Record<string, { name: string; icon: string; color: string }> = {
  editor: { name: '编辑器', icon: '</>', color: 'text-green-400' },
  terminal: { name: '终端', icon: '>_', color: 'text-cyan-400' },
  document: { name: '文档', icon: '\u{1F4C4}', color: 'text-purple-400' },
  browser: { name: '浏览器', icon: '\u{1F310}', color: 'text-blue-400' },
  git: { name: '代码版本', icon: '\u{1F516}', color: 'text-orange-400' },
  figma: { name: 'Figma', icon: '\u{1FA77}', color: 'text-pink-400' },
  agent: { name: '智能体', icon: '\u{1F9E0}', color: 'text-indigo-400' },
  mcp: { name: 'MCP', icon: '\u2699', color: 'text-yellow-400' },
  settings: { name: '设置', icon: '\u2699', color: 'text-gray-400' },
}

const MODULE_MENU_ITEMS: ModuleType[] = ['editor','terminal','document','browser','git','figma','agent','mcp','settings']

const TERMINAL_TYPE_LABELS: Record<string, string> = {
  powershell: 'PowerShell', cmd: 'CMD', bash: 'Bash', python: 'Python',
  nodejs: 'Node.js', wsl: 'WSL', git: 'Git', docker: 'Docker',
  ssh: 'SSH', java: 'Java', cli: 'CLI', terminal: 'Terminal',
}

const TERMINAL_TYPE_ICONS: Record<string, string> = {
  powershell: '\u{1F4BB}', cmd: '\u{1F4BB}', bash: '\u{1F411}', python: '\u{1F40D}',
  nodejs: '\u22C9', wsl: '\u{1F433}', git: '\u{1F516}', docker: '\u{1F433}',
  ssh: '\u{1F511}', java: '\u2615', cli: '\u2756', terminal: '\u{1F5A5}',
}

const LANGUAGES = ['JavaScript', 'TypeScript', 'Python', 'JSON', 'HTML', 'CSS', 'Markdown', 'Shell', 'Rust', 'Go', 'Java', 'Plain Text']

const LANG_MAP: Record<string, string> = {
  js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript',
  py: 'python', rs: 'rust', go: 'go', java: 'java', json: 'json',
  html: 'html', css: 'css', md: 'markdown', sh: 'shell', bash: 'shell',
  yaml: 'yaml', yml: 'yaml', toml: 'toml', xml: 'xml', sql: 'sql',
  vue: 'html', svelte: 'html', c: 'c', cpp: 'cpp', h: 'c',
}

function getFileIcon(language: string): string {
  const icons: Record<string, string> = {
    typescript: 'code', javascript: 'code', python: 'code', rust: 'code',
    go: 'code', json: 'data_object', markdown: 'article', css: 'palette',
    html: 'html', yaml: 'settings', shell: 'terminal', sql: 'database',
    java: 'code', cpp: 'code', c: 'code', xml: 'code',
  }
  return icons[language] || 'description'
}

function updateNodeChildren(nodes: FileNode[], path: string, children: FileNode[]): FileNode[] {
  return nodes.map(node => {
    if (node.path === path) return { ...node, children }
    if (node.children) return { ...node, children: updateNodeChildren(node.children, path, children) }
    return node
  })
}

export default function GZAIStudio({ cwd, embedded = false }: GZAIStudioProps) {
  const [sidebarWidth, setSidebarWidth] = useState(220)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [terminalMode, setTerminalMode] = useState<'full' | 'panel' | 'hidden'>('panel')
  const [editorHeightPct, setEditorHeightPct] = useState(65)

  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeFileId, setActiveFileId] = useState<string>('')
  const [editorVimMode, setEditorVimMode] = useState(false)
  const [terminalVimMode, setTerminalVimMode] = useState(false)
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [newFileCounter, setNewFileCounter] = useState(1)

  const [showEditorSearch, setShowEditorSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ file: string; path: string; line: number; text: string }>>([])

  const [showMinimap, setShowMinimap] = useState(true)
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('off')
  const [fontSize, setFontSize] = useState(13)

  const [newTermMenuPos, setNewTermMenuPos] = useState({ top: 0, left: 0 })
  const [settingsMenuPos, setSettingsMenuPos] = useState({ top: 0, left: 0 })

  const [terminalTab, setTerminalTab] = useState<TerminalTabType>('terminal')
  const [terminals, setTerminals] = useState<TerminalInstance[]>([
    { id: 1, name: 'PowerShell 1', type: 'powershell', active: true },
  ])
  const [activeTerminalId, setActiveTerminalId] = useState(1)
  const [nextTerminalId, setNextTerminalId] = useState(2)

  const [showSettings, setShowSettings] = useState(false)
  const [showNewTermMenu, setShowNewTermMenu] = useState(false)
  const [showNewModuleMenu, setShowNewModuleMenu] = useState(false)
  const [logLevels, setLogLevels] = useState({ error: true, warning: true, info: true })

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [workspacePath, setWorkspacePath] = useState(cwd || 'C:\\')

  const [modules, setModules] = useState<ModuleTab[]>([
    { id: 'mod-1', type: 'editor', name: '编辑器', icon: '</>' },
    { id: 'mod-2', type: 'terminal', name: '终端', icon: '>_' },
  ])
  const [activeModuleId, setActiveModuleId] = useState('mod-1')

  const termRefs = useRef<Map<number, { el: HTMLDivElement; fit: XTermFitAddon; term: XTermTerminal }>>(new Map())
  const childRefs = useRef<Map<number, { write: (data: string) => Promise<void>; kill: () => Promise<void> }>>(new Map())
  const unlistenRefs = useRef<Map<number, (() => void)[]>>(new Map())
  const newTermBtnRef = useRef<HTMLButtonElement>(null)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)
  const newModuleBtnRef = useRef<HTMLButtonElement>(null)
  const filePickerRef = useRef<HTMLDivElement>(null)

  const ds = useRef({ mode: '' as '' | 'v-split' | 'h-split', startX: 0, startY: 0, startSidebarW: 0, startEditorPct: 0 })
  const sideWRef = useRef(sidebarWidth)
  const editorPctRef = useRef(editorHeightPct)
  useEffect(() => { sideWRef.current = sidebarWidth }, [sidebarWidth])
  useEffect(() => { editorPctRef.current = editorHeightPct }, [editorHeightPct])

  const activeFile = openFiles.find(f => f.id === activeFileId)
  const activeModuleType = modules.find(m => m.id === activeModuleId)?.type || 'editor'
  const isEditorActive = activeModuleType === 'editor'
  const isTerminalActive = activeModuleType === 'terminal'

  useEffect(() => {
    if (!workspacePath) return
    buildFileTreeFromPath(workspacePath).then(tree => {
      setFileTree(tree)
      const rootPaths = new Set<string>(tree.map(n => n.path))
      setExpandedDirs(rootPaths)
    }).catch(() => {})
  }, [workspacePath])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!ds.current.mode) return
      if (ds.current.mode === 'v-split') {
        const dx = e.clientX - ds.current.startX
        setSidebarWidth(Math.max(120, Math.min(450, ds.current.startSidebarW + dx)))
      } else if (ds.current.mode === 'h-split') {
        const containerH = window.innerHeight - 130
        const dy = e.clientY - ds.current.startY
        const deltaPct = (dy / Math.max(200, containerH)) * 100
        setEditorHeightPct(Math.max(20, Math.min(80, ds.current.startEditorPct + deltaPct)))
      }
    }
    const onMouseUp = () => {
      if (!ds.current.mode) return
      ds.current.mode = ''
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp) }
  }, [])

  const closeAllMenus = useCallback((e: MouseEvent) => {
    const target = e.target as Node
    if (showNewTermMenu && !document.getElementById('new-term-menu')?.contains(target) && newTermBtnRef.current && !newTermBtnRef.current.contains(target)) setShowNewTermMenu(false)
    if (showNewModuleMenu && !document.getElementById('new-module-menu')?.contains(target) && newModuleBtnRef.current && !newModuleBtnRef.current.contains(target)) setShowNewModuleMenu(false)
    if (showSettings && !document.getElementById('settings-menu')?.contains(target) && settingsBtnRef.current && !settingsBtnRef.current.contains(target)) setShowSettings(false)
    if (showFilePicker && filePickerRef.current && !filePickerRef.current.contains(target) && !(target as HTMLElement).closest?.('[data-file-picker-btn]')) setShowFilePicker(false)
  }, [showNewTermMenu, showNewModuleMenu, showSettings, showFilePicker])

  useEffect(() => {
    if (!showNewTermMenu && !showNewModuleMenu && !showSettings && !showFilePicker) return
    document.addEventListener('mousedown', closeAllMenus)
    return () => document.removeEventListener('mousedown', closeAllMenus)
  }, [closeAllMenus, showNewTermMenu, showNewModuleMenu, showSettings, showFilePicker])

  useEffect(() => {
    if (!showNewTermMenu || !newTermBtnRef.current) return
    const rect = newTermBtnRef.current.getBoundingClientRect()
    const menuWidth = 180, menuHeight = 280
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8
    let top: number
    if (spaceBelow >= menuHeight || spaceBelow >= spaceAbove) top = rect.bottom + 4
    else top = Math.max(4, rect.top - menuHeight)
    const left = Math.max(4, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 4))
    setNewTermMenuPos({ top, left })
  }, [showNewTermMenu])

  useEffect(() => {
    if (!showSettings || !settingsBtnRef.current) return
    const rect = settingsBtnRef.current.getBoundingClientRect()
    const menuWidth = 200, menuHeight = 280
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8
    let top: number
    if (spaceBelow >= menuHeight || spaceBelow >= spaceAbove) top = rect.bottom + 4
    else top = Math.max(4, rect.top - menuHeight)
    const left = Math.max(4, Math.min(rect.left, window.innerWidth - menuWidth - 4))
    setSettingsMenuPos({ top, left })
  }, [showSettings])

  const handleVSplitDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    ds.current = { mode: 'v-split', startX: e.clientX, startY: 0, startSidebarW: sidebarWidth, startEditorPct: editorHeightPct }
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'
  }, [sidebarWidth, editorHeightPct])

  const handleHSplitDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    ds.current = { mode: 'h-split', startX: e.clientX, startY: e.clientY, startSidebarW: sidebarWidth, startEditorPct: editorHeightPct }
    document.body.style.cursor = 'row-resize'; document.body.style.userSelect = 'none'
  }, [sidebarWidth, editorHeightPct])

  const toggleDir = useCallback(async (path: string) => {
    if (expandedDirs.has(path)) {
      setExpandedDirs(prev => { const n = new Set(prev); n.delete(path); return n })
      return
    }
    let needsLoading = false
    const checkNode = (nodes: FileNode[]): boolean => {
      for (const node of nodes) {
        if (node.path === path) return node.children === undefined || node.children.length === 0
        if (node.children && checkNode(node.children)) return true
      }
      return false
    }
    needsLoading = checkNode(fileTree)
    if (needsLoading) {
      try { const children = await readDirEntries(path); setFileTree(prev => updateNodeChildren(prev, path, children)) }
      catch {}
    }
    setExpandedDirs(prev => { const n = new Set(prev); n.add(path); return n })
  }, [expandedDirs, fileTree])

  const openFileInEditor = useCallback(async (node: FileNode) => {
    if (node.type !== 'file') return
    const ext = node.path.split('.').pop()?.toLowerCase() || ''
    const existing = openFiles.find(f => f.path === node.path)
    if (existing) { setActiveFileId(existing.id); const m = modules.find(m => m.type === 'editor'); if (m) setActiveModuleId(m.id); return }
    let content = ''
    try {
      const { readTextFile } = await import('@tauri-apps/plugin-fs')
      content = await readTextFile(node.path)
    } catch { content = '// ' + node.name + '\n// File: ' + node.path + '\n\n' }
    const nf: OpenFile = { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, name: node.name, path: node.path, content, language: LANG_MAP[ext] || 'Plain Text', modified: false }
    setOpenFiles(p => [...p, nf]); setActiveFileId(nf.id)
    const editorMod = modules.find(m => m.type === 'editor')
    if (editorMod) setActiveModuleId(editorMod.id)
  }, [openFiles, modules])

  const handleFileChange = useCallback((fileId: string, value: string | undefined) => {
    if (!fileId || value === undefined) return
    setOpenFiles(prev => prev.map(f => f.id === fileId ? { ...f, content: value, modified: true } : f))
  }, [])

  const handleSave = useCallback(async (fileId?: string) => {
    const id = fileId || activeFileId
    const file = openFiles.find(f => f.id === id)
    if (!file) return
    try {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      await writeTextFile(file.path, file.content)
      setOpenFiles(prev => prev.map(f => f.id === id ? { ...f, modified: false } : f))
    } catch { setOpenFiles(prev => prev.map(f => f.id === id ? { ...f, modified: false } : f)) }
  }, [activeFileId, openFiles])

  const closeFile = useCallback((fileId: string) => {
    setOpenFiles(prev => {
      const next = prev.filter(f => f.id !== fileId)
      if (fileId === activeFileId && next.length > 0) setActiveFileId(next[next.length - 1].id)
      else if (next.length === 0) setActiveFileId('')
      return next
    })
  }, [activeFileId])

  const handleNewFile = useCallback(() => {
    const name = `untitled-${newFileCounter}`
    const nf: OpenFile = { id: `${Date.now()}-new`, name, path: `/${name}`, content: '', language: 'Plain Text', modified: false }
    setNewFileCounter(c => c + 1)
    setOpenFiles(p => [...p, nf]); setActiveFileId(nf.id)
  }, [newFileCounter])

  const handleRefreshFile = useCallback(() => {
    if (!activeFile) return
    const ext = activeFile.name.split('.').pop()?.toLowerCase() || ''
    const defaultContent = ext === 'py' ? '# -*- coding: utf-8 -*-\n"""\nDescription:\nAuthor:\nDate: ' + new Date().toISOString().slice(0,10) + '\n"""\n\n'
      : ext === 'ts' || ext === 'tsx' ? '// TypeScript\n// Created: ' + new Date().toISOString() + '\n\n'
      : ext === 'js' || ext === 'jsx' ? '// JavaScript\n// Created: ' + new Date().toISOString() + '\n\n'
      : ext === 'html' ? '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n  <meta charset="UTF-8">\n  <title>Document</title>\n</head>\n<body>\n\n</body>\n</html>\n'
      : ext === 'css' ? '/* Styles */\n\n'
      : ext === 'json' ? '{\n  \n}\n'
      : ext === 'md' ? '# ' + activeFile.name.replace(/\.md$/,'') + '\n\n'
      : '// ' + activeFile.name + '\n'
    setOpenFiles(p => p.map(f => f.id === activeFileId ? { ...f, content: defaultContent, modified: false } : f))
  }, [activeFile, activeFileId])

  const handleSelectFile = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({ multiple: false, filters: [{ name: 'All Files', extensions: ['*'] }, { name: 'Code Files', extensions: ['ts','tsx','js','jsx','py','java','go','rs','json','html','css','md','sh','yaml','yml','toml','xml','sql'] }] })
      if (!selected || Array.isArray(selected)) return
      const pathStr = selected as string
      const fileName = pathStr.split(/[\\/]/).pop() || 'unknown'
      const ext = fileName.split('.').pop()?.toLowerCase() || ''
      const existing = openFiles.find(f => f.path === pathStr)
      if (existing) { setActiveFileId(existing.id); return }
      let content = ''
      try { const { readTextFile } = await import('@tauri-apps/plugin-fs'); content = await readTextFile(pathStr) } catch { content = '' }
      const nf: OpenFile = { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, name: fileName, path: pathStr, content, language: LANG_MAP[ext] || 'Plain Text', modified: false }
      setOpenFiles(p => [...p, nf]); setActiveFileId(nf.id)
      setShowFilePicker(false)
      const editorMod = modules.find(m => m.type === 'editor')
      if (editorMod) setActiveModuleId(editorMod.id)
    } catch { setShowFilePicker(v => !v) }
  }, [openFiles, modules])

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !workspacePath) return
    try {
      const { readDir, readTextFile } = await import('@tauri-apps/plugin-fs')
      const results: Array<{ file: string; path: string; line: number; text: string }> = []
      const searchInDir = async (dir: string) => {
        try {
          const entries = await readDir(dir)
          for (const entry of entries) {
            const entryPath = `${dir}/${entry.name}`
            if (entry.isDirectory) { if (!['node_modules','.git','dist','build','.next','__pycache__','target'].includes(entry.name || '')) await searchInDir(entryPath) }
            else {
              const ext = entry.name?.split('.').pop()?.toLowerCase() || ''
              if (['ts','tsx','js','jsx','py','rs','go','json','md','css','html','yaml','yml','toml','sql','sh','xml','java','c','cpp','h','txt','svelte','vue'].includes(ext)) {
                try { const content = await readTextFile(entryPath); const lines = content.split('\n'); lines.forEach((line, idx) => { if (line.toLowerCase().includes(searchQuery.toLowerCase())) results.push({ file: entry.name || '', path: entryPath, line: idx + 1, text: line.trim().slice(0, 120) }) }) } catch {}
              }
            }
          }
        } catch {}
      }
      await searchInDir(workspacePath)
      setSearchResults(results.slice(0, 100))
    } catch {}
  }, [searchQuery, workspacePath])

  const toggleSplit = useCallback((fileId?: string) => {
    setSplitView(prev => prev === 'none' ? 'right' : 'none')
    if (splitView === 'none' && fileId) setSplitFileId(fileId)
    else if (splitView === 'none') setSplitFileId(activeFileId)
  }, [activeFileId])

  const [splitView, setSplitView] = useState<'none' | 'right'>('none')
  const [splitFileId, setSplitFileId] = useState<string>('')
  const splitFile = openFiles.find(f => f.id === splitFileId)

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const secondEditorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)

  const handleEditorMount = useCallback((editor: MonacoEditor.IStandaloneCodeEditor, monaco: any) => {
    editorRef.current = editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { if (activeFileId) handleSave(activeFileId) })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => editor.getAction('actions.find')?.run())
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => editor.getAction('editor.action.startFindReplaceAction')?.run())
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, () => editor.getAction('editor.action.gotoLine')?.run())
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => setShowEditorSearch(s => !s))
    editor.focus()
  }, [activeFileId, handleSave])

  const handleSecondEditorMount = useCallback((editor: MonacoEditor.IStandaloneCodeEditor, monaco: any) => {
    secondEditorRef.current = editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { if (splitFileId) handleSave(splitFileId) })
  }, [splitFileId, handleSave])

  const handlePickDirectory = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({ directory: true, multiple: false })
      if (!selected || Array.isArray(selected)) return
      const dirPath = selected as string
      clearDirectoryCache()
      setWorkspacePath(dirPath)
      const newTree = await buildFileTreeFromPath(dirPath)
      setFileTree(newTree)
      const rootPaths = new Set<string>(newTree.map(n => n.path))
      setExpandedDirs(rootPaths)
    } catch {}
  }, [])

  const handleRefreshFileTree = useCallback(async () => {
    if (!workspacePath) { handlePickDirectory(); return }
    clearDirectoryCache()
    const newTree = await buildFileTreeFromPath(workspacePath)
    setFileTree(newTree)
    const rootPaths = new Set<string>(newTree.map(n => n.path))
    setExpandedDirs(rootPaths)
  }, [workspacePath, handlePickDirectory])

  const addTerminal = useCallback((t?: TerminalType) => {
    const type = t || terminals.find(t => t.active)?.type || 'powershell'
    const id = nextTerminalId
    setNextTerminalId(p => p + 1)
    setTerminals(p => p.map(t => ({...t, active: false})).concat({ id, name: `${TERMINAL_TYPE_LABELS[type]} ${id}`, type, active: true }))
    setActiveTerminalId(id); setShowNewTermMenu(false)
  }, [terminals, nextTerminalId])

  const removeTerminal = useCallback((id: number) => {
    const el = document.getElementById(`xterm-${id}`)
    if (el) { try { (el as any).__cleanup?.() } catch {} }
    childRefs.current.delete(id)
    termRefs.current.delete(id)
    setTerminals(p => {
      const r = p.filter(t => t.id !== id)
      if (r.length && activeTerminalId === id) { const na = r[r.length - 1]; if (na) { setActiveTerminalId(na.id); return r.map(t => ({...t, active: t.id === na.id})) } }
      if (!r.length) setShowSettings(false)
      return r
    })
  }, [activeTerminalId])

  const restartTerminal = useCallback((id: number) => {
    const el = document.getElementById(`xterm-${id}`)
    if (!el) return
    try { (el as any).__cleanup?.() } catch {}
    delete (el as any).__cleanup
    el.dataset.inited = ''
    childRefs.current.delete(id)
    termRefs.current.delete(id)
    void initXtermForTid(id)
  }, [workspacePath])

  const initXtermForTid = useCallback(async (tid: number, shellCwd?: string) => {
    const el = document.getElementById(`xterm-${tid}`)
    if (!el || el.dataset.inited === 'true') return

    try {
      const [{ Terminal }, { FitAddon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')])

      const terminal = new Terminal({
        cursorBlink: true, fontSize: 12, lineHeight: 1.25,
        fontFamily: "Consolas, 'Courier New', monospace",
        theme: { background: '#0e0e12', foreground: '#d7d2d0', cursor: '#ffb59f', selectionBackground: '#5f4a40', black: '#1f1f1f', red: '#ff6d67', green: '#7ef18a', yellow: '#f8c55f', blue: '#77a8ff', magenta: '#d699ff', cyan: '#61d6d6', white: '#d7d2d0', brightBlack: '#8f8683', brightRed: '#ff8a85', brightGreen: '#9ff7a7', brightYellow: '#ffdd7a', brightBlue: '#a6c5ff', brightMagenta: '#e3b8ff', brightCyan: '#8ceeee', brightWhite: '#ffffff' },
      })
      const fit = new FitAddon()
      terminal.loadAddon(fit)
      terminal.open(el as HTMLElement)
      setTimeout(() => { try { fit.fit() } catch {} }, 50)
      el.dataset.inited = 'true'
      termRefs.current.set(tid, { el: el as HTMLDivElement, fit, term: terminal })

      const cwdPath = shellCwd || workspacePath || 'C:\\'
      try {
        const result = await terminalApi.spawn({ cols: 80, rows: 24, cwd: cwdPath })
        childRefs.current.set(tid, {
          write: async (data: string) => { await terminalApi.write(result.session_id, data) },
          kill: async () => { await terminalApi.kill(result.session_id) },
        })
        const unlistenOut = await terminalApi.onOutput((payload) => {
          if (payload.session_id === result.session_id) terminal.write(payload.data)
        })
        const unlistenExit = await terminalApi.onExit((payload) => {
          if (payload.session_id === result.session_id) {
            terminal.writeln('\r\n\x1b[33m[进程已退出，代码: ' + payload.code + ']\x1b[0m')
            childRefs.current.delete(tid)
          }
        })
        unlistenRefs.current.set(tid, [unlistenOut, unlistenExit])
        terminal.onData((data) => { terminalApi.write(result.session_id, data).catch(() => {}) })
      } catch {
        try {
          const { Command } = await import('@tauri-apps/plugin-shell')
          const command = Command.create('powershell', [], { cwd: cwdPath })
          const child = await command.spawn()
          childRefs.current.set(tid, { write: async (data: string) => { await child.write(data) }, kill: async () => { await child.kill() } })
          command.stdout.on('data', (data: string) => terminal.write(data))
          command.stderr.on('data', (data: string) => terminal.write(data))
          command.on('close', () => { terminal.writeln('\r\n[process exited]'); childRefs.current.delete(tid) })
          command.on('error', (err: string) => { terminal.writeln('\r\n\x1b[31mError: ' + err + '\x1b[0m') })
          terminal.onData((data) => { const c = childRefs.current.get(tid); if (c) c.write(data).catch(() => {}) })
        } catch {
          terminal.writeln('\r\n\x1b[32m终端就绪 (cwd: ' + cwdPath + ')\x1b[0m\r\n')
          terminal.onData((data) => terminal.write(data))
        }
      }

      ;(el as any).__cleanup = () => {
        try { terminal.dispose() } catch {}
        const unlisteners = unlistenRefs.current.get(tid)
        if (unlisteners) unlisteners.forEach(u => u())
        unlistenRefs.current.delete(tid)
        termRefs.current.delete(tid)
        childRefs.current.delete(tid)
      }
    } catch (initErr) {
      console.error('xterm init error:', initErr)
    }
  }, [workspacePath])

  useEffect(() => {
    const tids = terminals.map(t => t.id)
    const timer = setTimeout(() => {
      for (const tid of tids) {
        const el = document.getElementById(`xterm-${tid}`)
        if (el && !el.dataset.inited) void initXtermForTid(tid)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [terminals.length, workspacePath, initXtermForTid])

  useEffect(() => {
    const ref = termRefs.current.get(activeTerminalId)
    if (ref) {
      requestAnimationFrame(() => { try { ref.fit.fit() } catch {} })
      setTimeout(() => { try { ref.fit.fit() } catch {} }, 100)
    }
  }, [sidebarWidth, activeTerminalId])

  const handleAddModule = useCallback((type: ModuleType) => {
    const meta = MODULE_META[type]
    const existing = modules.find(m => m.type === type)
    if (existing) { setActiveModuleId(existing.id); setShowNewModuleMenu(false); return }
    const newMod: ModuleTab = { id: `mod-${Date.now()}`, type, name: meta.name, icon: meta.icon }
    setModules(p => [...p, newMod]); setActiveModuleId(newMod.id); setShowNewModuleMenu(false)
  }, [modules])

  const handleCloseModule = useCallback((id: string) => {
    if (modules.length <= 1) return
    const mod = modules.find(m => m.id === id)
    if (mod?.type === 'terminal') setTerminalMode('hidden')
    setModules(p => p.filter(m => m.id !== id))
    setActiveModuleId(prev => prev === id ? (modules.find(m => m.id !== id)?.id || modules[0]?.id || 'mod-1') : prev)
  }, [modules])

  const handleEditorClose = useCallback(() => {
    setOpenFiles([]); setActiveFileId('')
    const editorMods = modules.filter(m => m.type === 'editor')
    if (editorMods[0]) handleCloseModule(editorMods[0].id)
  }, [modules, handleCloseModule])

  const editorOptions: MonacoEditor.IStandaloneEditorConstructionOptions = {
    minimap: { enabled: showMinimap }, fontSize, wordWrap, automaticLayout: true,
    scrollBeyondLastLine: false, renderLineHighlight: 'all', bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true }, suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on', tabSize: 2, insertSpaces: true, formatOnPaste: true,
    formatOnType: true, smoothScrolling: true, cursorSmoothCaretAnimation: 'on',
    padding: { top: 8 }, lineNumbers: 'on', glyphMargin: true, folding: true,
    links: true, colorDecorators: true, contextmenu: true,
    find: { addExtraSpaceOnTop: true, autoFindInSelection: 'never' },
  }

  function renderOtherModuleView() {
    const meta = MODULE_META[activeModuleType as ModuleType]
    return (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#131128]">
        <span className={`text-4xl ${meta?.color || 'text-gray-400'}`}>{meta?.icon || '\u{1F4DD}'}</span>
        <span className="text-sm font-medium text-gray-300">{meta?.name || 'Module'} Module</span>
        <span className="max-w-[300px] text-center text-[11px] text-gray-500 leading-relaxed">
          {activeModuleType === 'agent' && 'AI Agent Workbench'}
          {activeModuleType === 'mcp' && 'MCP Service Connection & Management'}
          {activeModuleType === 'settings' && 'Global Settings: Theme, Shortcuts, Plugins'}
        </span>
        <button className="mt-2 rounded-lg border border-indigo-600/40 bg-indigo-600/15 px-4 py-1.5 text-[11px] text-indigo-300 hover:bg-indigo-600/25 transition-colors">Coming Soon...</button>
      </div>
    )
  }

  function renderTreeNode(n: FileNode, d = 0) {
    const ex = expandedDirs.has(n.path)
    return (
      <div key={n.path}>
        <div className={`group flex cursor-pointer items-center gap-1 px-1 py-[1.5px] text-xs ${n.type === 'directory' ? 'hover:bg-white/8' : 'hover:bg-blue-400/10 hover:text-blue-300'}`}
          style={{ paddingLeft: `${d * 14 + 4}px` }}
          onClick={() => n.type !== 'file' ? toggleDir(n.path) : openFileInEditor(n)}
          onDoubleClick={() => { if (n.type === 'file') openFileInEditor(n) }}>
          <span className="shrink-0 text-[10px] leading-none text-gray-500 w-3">{n.type === 'directory' ? (ex ? '\u25BC' : '\u25B6') : ''}</span>
          <span className="shrink-0 text-[11px]">{n.type === 'directory' ? (ex ? '\u{1F4C2}' : '\u{1F4C1}') : '\u{1F4C4}'}</span>
          <span className="truncate text-[11px] text-gray-300 group-hover:text-gray-100" title={n.name}>{n.name}</span>
        </div>
        {n.type === 'directory' && ex && n.children?.map(c => renderTreeNode(c, d + 1))}
      </div>
    )
  }

  function renderPickNode(node: FileNode, depth = 0) {
    return (
      <div key={node.path}>
        <div style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className={`group flex cursor-pointer items-center gap-1.5 px-1.5 py-1 text-[11px] ${node.type === 'directory' ? 'hover:bg-white/8 text-yellow-300/90' : 'hover:bg-blue-400/10 text-gray-300 hover:text-blue-300'}`}
          onClick={() => { if (node.type === 'file') { openFileInEditor(node); setShowFilePicker(false) } }}>
          <span className="shrink-0 text-[10px]">{node.type === 'directory' ? '\u{1F4C1}' : '\u{1F4C4}'}</span>
          <span className="truncate">{node.name}</span>
        </div>
        {node.type === 'directory' && node.children?.map(c => renderPickNode(c, depth + 1))}
      </div>
    )
  }

  return (
    <div className={`flex flex-col bg-[#131128] text-gray-200 ${embedded ? 'h-full w-full' : 'h-screen w-screen'}`}>
      {/* TITLE BAR */}
      <div className="flex shrink-0 cursor-default items-center justify-between border-b border-[#2d2652] bg-gradient-to-r from-[#1e1850] via-[#241e48] to-[#1e1850] px-3 py-1.5 select-none">
        <div className="flex items-center gap-2">
          <span>&#128187;</span>
          <span className="text-[11px] font-semibold tracking-wide text-indigo-200/90">GZAIStudio</span>
        </div>
      </div>

      {/* MODULE TAB BAR */}
      <div className="flex shrink-0 items-center border-b border-[#231e42] bg-[#161330] px-1 py-0 gap-0.5">
        {modules.map(mod => {
          const meta = MODULE_META[mod.type]
          const active = mod.id === activeModuleId
          return (
            <button key={mod.id}
              onClick={() => { setActiveModuleId(mod.id); if (mod.type === 'terminal') setTerminalMode('full') }}
              className={`group flex shrink-0 cursor-pointer items-center gap-1 rounded-t px-2.5 py-1 text-[11px] transition-colors ${active ? 'bg-[#282350] text-white font-medium' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
              <span className={`${meta.color} ${active ? '' : 'opacity-70'}`}>{meta.icon}</span>
              <span className="truncate max-w-[100px]">{meta.name}</span>
              <button onClick={e => { e.stopPropagation(); handleCloseModule(mod.id) }}
                className="ml-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] opacity-40 transition-all hover:!opacity-100 hover:bg-red-500/30 hover:text-red-300">&#215;</button>
            </button>
          )
        })}
        <div className="relative ml-auto mr-1">
          <button ref={newModuleBtnRef} onClick={() => setShowNewModuleMenu(v => !v)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-white/10 hover:text-white text-[16px] font-light">+</button>
          {showNewModuleMenu && (
            <div id="new-module-menu" className="absolute top-full right-0 z-50 mt-1 w-[180px] rounded-lg border border-[#3a3466] bg-[#1c1938] py-1 shadow-xl">
              {MODULE_MENU_ITEMS.map(type => {
                const m = MODULE_META[type]
                const exists = modules.some(mod => mod.type === type)
                return (
                  <button key={type} onClick={() => handleAddModule(type)} disabled={exists}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[11px] transition-colors ${exists ? 'text-gray-600 cursor-default' : 'text-gray-300 hover:bg-indigo-600/25 hover:text-white'}`}>
                    <span className={m.color}>{m.icon}</span><span>{m.name}</span>
                    {exists && <span className="ml-auto text-[9px] text-gray-600">Open</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* WORKSPACE PATH BAR */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-[#231e42] bg-[#161330] px-3 py-1">
        <input readOnly value={workspacePath} onClick={handlePickDirectory}
          className="h-6 flex-1 min-w-0 rounded border border-[#3a3466] bg-[#12101f] px-2.5 text-[11px] text-gray-300 outline-none cursor-pointer hover:border-indigo-500/60 transition-colors truncate"
          placeholder="选择工作区目录..." />
        <button onClick={handlePickDirectory} className="flex h-6 shrink-0 items-center gap-1 rounded bg-indigo-600/40 px-2.5 text-[10px] font-medium text-indigo-200 hover:bg-indigo-600/60 transition-colors">
          <FolderOpen className="h-3 w-3" />
          选择目录
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* LEFT SIDEBAR */}
        {sidebarVisible && (
          <div style={{ width: sidebarWidth, minWidth: 140, maxWidth: 450 }} className="flex shrink-0 flex-col overflow-hidden border-r border-[#252045]">
            <div className="flex shrink-0 items-center gap-2 border-b border-[#2d2652] bg-gradient-to-r from-[#1a1838] to-[#181533] px-3 py-1">
              <button onClick={() => setSidebarVisible(false)} className="flex h-4 w-4 items-center justify-center rounded text-gray-500 hover:text-white text-[10px]">&#9664;</button>
              <div className="flex items-center gap-1.5">
                <button onClick={handlePickDirectory} className="flex h-4 w-4 items-center justify-center rounded text-gray-500 hover:text-cyan-300 text-[11px]" title="选择工作区目录">&#128193;</button>
                <span className="text-[10px] font-bold tracking-wider text-amber-300/90 uppercase">文件资源管理器</span>
                <button onClick={handleRefreshFileTree} className="flex h-4 w-4 items-center justify-center rounded text-gray-500 hover:text-cyan-300 text-[10px]" title="刷新文件树">&#8635;</button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1.5 scrollbar-thin scrollbar-thumb-[#2a2555]">
              {workspacePath ? fileTree.map(n => renderTreeNode(n)) : (
                <div className="flex flex-col items-center justify-center py-10 text-gray-500 text-xs gap-2">
                  <FolderOpen className="h-8 w-8 text-gray-600" />
                  <span>请选择工作区目录</span>
                </div>
              )}
            </div>
          </div>
        )}

        {!sidebarVisible && (
          <div className="flex w-6 items-start justify-center pt-3 bg-[#131128]/80">
            <button onClick={() => setSidebarVisible(true)} className="rounded px-0.5 py-0.5 text-[10px] text-gray-500 hover:text-white hover:bg-white/10">&#9654;</button>
          </div>
        )}

        {sidebarVisible && (
          <div onMouseDown={handleVSplitDown} className="flex w-[4px] cursor-col-resize items-center justify-center bg-[#1c1838] hover:bg-indigo-600/30 group transition-colors">
            <div className="h-10 w-[3px] rounded-full bg-indigo-500/15 group-hover:bg-indigo-400/40" />
          </div>
        )}

        {/* EDITOR + TERMINAL AREA */}
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* OTHER MODULE VIEW (browser/document/git/figma/agent/mcp/settings) */}
          {(activeModuleType !== 'editor' && activeModuleType !== 'terminal') && renderOtherModuleView()}

          {/* EDITOR VIEW */}
          {(isEditorActive || (!isEditorActive && !isTerminalActive)) && (
            <div style={{ height: !isTerminalActive ? (terminalMode === 'panel' ? `${editorHeightPct}%` : '100%') : undefined }}
              className={`flex min-h-0 flex-col overflow-hidden ${!isEditorActive ? 'hidden' : ''}`}>
              {/* Editor header */}
              <div className="flex shrink-0 items-center gap-2 border-b border-[#2d2652] bg-gradient-to-r from-[#1e1850] to-[#211b45] px-3 py-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold tracking-wider text-indigo-300 uppercase">编辑器</span>
                  {activeFile?.modified && <span className="ml-1 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[9px] text-orange-400 font-medium">已修改</span>}
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <button onClick={handleNewFile} className="flex h-5 w-5 items-center justify-center rounded bg-indigo-600/60 text-white hover:bg-indigo-500/70 active:scale-90 transition-transform text-[13px]" title="新建文件 (+)">+</button>
                  <button onClick={handleRefreshFile} className={`flex h-5 w-5 items-center justify-center rounded text-white text-[12px] transition-colors ${activeFile ? 'bg-sky-700/50 hover:bg-sky-600/60 active:scale-90' : 'bg-sky-700/30 hover:bg-sky-600/40'}`} title="刷新">&#8635;</button>
                  <button onClick={() => handleSave()} className={`flex h-5 w-5 items-center justify-center rounded text-white text-[12px] transition-colors ${activeFile?.modified ? 'bg-green-700/50 hover:bg-green-600/60 active:scale-90' : 'bg-green-700/30 hover:bg-green-600/40'}`} title="保存">&#128190;</button>
                  <button onClick={handleEditorClose} className="flex h-5 w-5 items-center justify-center rounded bg-red-500/70 text-white hover:bg-red-400/80 text-[10px] font-bold transition-colors" title="关闭编辑器">&#10005;</button>
                </div>
              </div>

              {/* Editor toolbar */}
              <div className="flex shrink-0 items-center gap-1 border-b border-[#231e42] bg-[#181532] px-2.5 py-1 relative">
                <button onClick={() => setShowMinimap(v => !v)} title={showMinimap ? '隐藏缩略图' : '显示缩略图'}
                  className="rounded px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-white/5 hover:text-gray-200">&#128207;</button>
                <button onClick={() => setWordWrap(v => v === 'on' ? 'off' : 'on')} title={wordWrap === 'on' ? '关闭自动换行' : '开启自动换行'}
                  className="rounded px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-white/5 hover:text-gray-200">&#8636;</button>
                <button onClick={() => setFontSize(s => Math.min(24, s + 1))} title="增大字号"
                  className="rounded px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-white/5 hover:text-gray-200">A+</button>
                <button onClick={() => setFontSize(s => Math.max(8, s - 1))} title="减小字号"
                  className="rounded px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-white/5 hover:text-gray-200">A-</button>
                <div className="mx-1 h-3 w-px bg-gray-700" />
                <button onClick={() => toggleSplit()} title={splitView === 'none' ? '分屏对比' : '关闭分屏'}
                  className={`rounded px-1.5 py-0.5 text-[10px] ${splitView !== 'none' ? 'text-indigo-300 bg-indigo-600/20' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}>&#8741;</button>
                <button onClick={() => setShowEditorSearch(s => !s)} title="搜索文件 (Ctrl+P)"
                  className="rounded px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-white/5 hover:text-gray-200">
                  <Search className="h-3 w-3" />
                </button>
                <div className="mx-1 h-3 w-px bg-gray-700" />
                <select defaultValue={activeFile?.language || 'JavaScript'} onChange={(e) => { if (activeFile) setOpenFiles(p => p.map(f => f.id === activeFileId ? { ...f, language: e.target.value } : f)) }}
                  className="h-6 rounded border border-[#3a3466] bg-[#12101f] px-2 text-[11px] text-gray-300 outline-none cursor-pointer">
                  {LANGUAGES.map(l => <option key={l}>{l}</option>)}
                </select>
                <input readOnly value={activeFile?.path || '（无文件）'} className="h-6 flex-1 min-w-0 rounded border border-[#323058] bg-[#12101f] px-2.5 text-[11px] text-gray-400 outline-none truncate" />
                <div className="relative" ref={filePickerRef}>
                  <button data-file-picker-btn onClick={handleSelectFile} className="flex h-6 shrink-0 items-center gap-1 rounded border border-[#3a3466] bg-[#1e1b38] px-2 text-[10px] text-indigo-300 hover:border-indigo-500 active:bg-indigo-600/20 transition-colors">
                    <FolderOpen className="h-3 w-3" />
                    选择文件
                  </button>
                  {showFilePicker && (
                    <div className="absolute top-full left-0 z-50 mt-1 w-[260px] max-h-[280px] rounded-lg border border-[#3a3466] bg-[#161330] shadow-xl overflow-hidden">
                      <div className="flex items-center gap-1.5 border-b border-[#2d2652] px-2.5 py-1.5 bg-gradient-to-r from-[#1e1850]/80 to-[#1c1840]/80">
                        <span className="text-[10px] font-semibold text-amber-300/90 uppercase tracking-wider">从工作区选择文件</span>
                        <button onClick={() => setShowFilePicker(false)} className="ml-auto flex h-4 w-4 items-center justify-center rounded text-[10px] text-gray-500 hover:text-white">&#215;</button>
                      </div>
                      <div className="max-h-[240px] overflow-y-auto py-1">{fileTree.map(n => renderPickNode(n))}</div>
                    </div>
                  )}
                </div>
                <button onClick={() => setEditorVimMode(v => !v)} className={`flex h-6 shrink-0 items-center gap-1 rounded border px-2 text-[10px] transition-colors ${editorVimMode ? 'border-green-600/60 bg-green-900/30 text-green-400' : 'border-[#3a3466] bg-[#1e1b38] text-gray-400 hover:border-indigo-500'}`} title="Vim 模式">{editorVimMode ? '\u2713' : ' '}Vim</button>
              </div>

              {/* Search panel */}
              {showEditorSearch && (
                <div className="border-b border-indigo-600/20 bg-[#0d0b1f]/80 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      placeholder="搜索文件内容... (Enter 搜索)" className="flex-1 rounded border border-indigo-600/30 bg-[#1e1b3a] px-2 py-1 text-[11px] text-gray-200 outline-none focus:border-indigo-400/50" />
                    <button onClick={handleSearch} className="rounded bg-indigo-600/30 px-2 py-1 text-[10px] text-indigo-200 hover:bg-indigo-600/40">搜索</button>
                    <button onClick={() => { setShowEditorSearch(false); setSearchResults([]) }} className="rounded px-2 py-1 text-[10px] text-gray-400 hover:bg-white/5">关闭</button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-auto">
                      {searchResults.map((r, i) => (
                        <div key={i} onClick={() => {
                          const openFile = openFiles.find(f => f.path === r.path)
                          if (openFile) { setActiveFileId(openFile.id); return }
                          openFileInEditor({ name: r.file, path: r.path, type: 'file' })
                        }} className="flex items-center gap-2 rounded px-2 py-0.5 text-[10px] hover:bg-white/5 cursor-pointer">
                          <span className="text-indigo-300">{r.file}</span>
                          <span className="text-gray-600">:{r.line}</span>
                          <span className="flex-1 truncate text-gray-400">{r.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* File tabs */}
              {openFiles.length > 0 && (
                <div className="flex shrink-0 items-center border-b border-[#231e42] bg-[#181532] overflow-x-auto">
                  {openFiles.map(f => (
                    <div key={f.id}
                      className={`group flex shrink-0 items-center gap-1 border-r border-[#231e42] px-2.5 py-1 text-[11px] cursor-pointer transition-colors ${f.id === activeFileId ? 'bg-[#282350] text-indigo-200 border-b-2 border-b-indigo-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                      onClick={() => setActiveFileId(f.id)}>
                      <span className="material-symbols-outlined text-[12px]">{getFileIcon(f.language)}</span>
                      <span>{f.name}</span>
                      {f.modified && <span className="text-[8px] text-yellow-400">&#9679;</span>}
                      <button onClick={e => { e.stopPropagation(); closeFile(f.id) }}
                        className="ml-0.5 rounded p-0.5 text-[10px] text-gray-600 opacity-0 hover:bg-white/10 hover:text-gray-300 group-hover:opacity-100">&#10005;</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Code area */}
              <div className="min-h-0 flex-1 overflow-hidden bg-[#0c0a18]">
                {activeFile ? (
                  <div className="flex h-full">
                    <div className={`flex flex-col ${splitView !== 'none' ? 'w-1/2 border-r border-indigo-600/20' : 'flex-1'}`}>
                      <Editor height="100%" language={activeFile.language} value={activeFile.content}
                        onChange={(value) => handleFileChange(activeFileId, value)}
                        onMount={handleEditorMount} theme="vs-dark" options={editorOptions} path={`/editor/${activeFile.name}`} />
                    </div>
                    {splitView === 'right' && splitFile && (
                      <div className="flex w-1/2 flex-col">
                        <div className="flex items-center gap-1 border-b border-indigo-600/15 bg-[#0d0b1f]/40 px-2 py-0.5">
                          <span className="text-[10px] text-gray-500">{splitFile.name}</span>
                          <button onClick={() => setSplitView('none')} className="ml-auto rounded px-1 py-0.5 text-[10px] text-gray-500 hover:bg-white/5 hover:text-gray-300">关闭</button>
                        </div>
                        <Editor height="100%" language={splitFile.language} value={splitFile.content}
                          onChange={(value) => handleFileChange(splitFileId, value)}
                          onMount={handleSecondEditorMount} theme="vs-dark" options={editorOptions} path={`/editor/${splitFile.name}`} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-gray-600">双击文件资源管理器中的文件即可在编辑器中打开</div>
                )}
              </div>

              {/* Status bar */}
              <div className="flex items-center gap-3 border-t border-indigo-600/20 bg-[#0d0b1f] px-3 py-0.5">
                <span className="text-[10px] text-gray-500">{activeFile?.language || 'plaintext'}</span>
                <span className="text-[10px] text-gray-600">UTF-8</span>
                <span className="text-[10px] text-gray-600">空格: 2</span>
                <span className="text-[10px] text-gray-600">字号: {fontSize}</span>
                {activeFile?.modified && <span className="text-[10px] text-yellow-400">已修改</span>}
              </div>
            </div>
          )}

          {/* H-SPLITTER */}
          {isEditorActive && terminalMode === 'panel' && (
            <div onMouseDown={handleHSplitDown} className="flex shrink-0 h-[5px] cursor-row-resize items-center justify-center bg-[#1c1838] hover:bg-indigo-600/30 group transition-colors z-10 relative">
              <div className="w-10 h-[3px] rounded-full bg-indigo-500/20 group-hover:bg-indigo-400/50 transition-colors" />
              <span className="absolute text-[8px] text-gray-600 group-hover:text-gray-400 transition-colors select-none">&#8744;</span>
            </div>
          )}

          {/* TERMINAL VIEW */}
          {(isTerminalActive || terminalMode === 'panel') && (
            <div style={{
              height: isTerminalActive ? '100%' : terminalMode === 'panel' ? `${100 - editorHeightPct}%` : '0%',
              display: terminalMode === 'hidden' && !isTerminalActive ? 'none' : 'flex',
              minHeight: terminalMode === 'panel' && !isTerminalActive ? '80px' : undefined,
            }} className={`flex min-h-0 flex-col overflow-hidden border-t border-[#231e42] transition-all duration-150 ${isTerminalActive ? '!border-t-0' : ''}`}>
              {/* Terminal header */}
              <div className="flex shrink-0 items-center gap-2 border-b border-[#2d2652] bg-gradient-to-r from-[#151840] to-[#18163a] px-3 py-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold tracking-wider text-cyan-300 uppercase">终端</span>
                  <span className="text-[10px] text-cyan-400/50">命令执行</span>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <button onClick={() => setTerminalVimMode(v => !v)} className={`flex h-6 shrink-0 items-center gap-1 rounded border px-2 text-[10px] transition-colors ${terminalVimMode ? 'border-green-600/60 bg-green-900/30 text-green-400' : 'border-[#3a3466] bg-[#1e1b38] text-gray-400 hover:border-indigo-500'}`} title="Vim 模式">{terminalVimMode ? '\u2713' : ' '}Vim</button>
                  <button onClick={() => { if (isTerminalActive) setTerminalMode('panel'); else { setTerminalMode('full'); const tMod = modules.find(m => m.type === 'terminal'); if (tMod) setActiveModuleId(tMod.id) }}}
                    className={`rounded px-2 text-[10px] transition-colors ${terminalMode !== 'panel' || isTerminalActive ? 'bg-[#252048] text-gray-400 hover:text-cyan-300' : 'bg-cyan-800/50 text-cyan-300'}`} title="最小化">-</button>
                  <button onClick={() => setTerminalMode(isTerminalActive && terminalMode === 'full' ? 'panel' : 'full')}
                    className="flex items-center gap-1 rounded px-2 text-[10px] transition-colors bg-[#252048] text-gray-400 hover:text-cyan-300" title="最大化">&#9650;</button>
                  <button onClick={() => { setTerminalMode('hidden'); if (isTerminalActive) { const nonTermMod = modules.find(m => m.type !== 'terminal'); if (nonTermMod) setActiveModuleId(nonTermMod.id) }}}
                    className="rounded px-2 text-[10px] bg-[#252048] text-gray-400 hover:text-cyan-300" title="隐藏">&#215;</button>
                </div>
              </div>

              {/* Terminal sub-tabs */}
              <div className="flex shrink-0 items-center border-b border-[#231e42] bg-[#181532] px-1.5">
                {(['console','problems','output','debug','terminal'] as TerminalTabType[]).map(tab => {
                  const lbl: Record<string, string> = { console: '控制台', problems: '问题', output: '输出', debug: '调试', terminal: '终端' }
                  return (
                    <button key={tab} onClick={() => { setTerminalTab(tab); setShowSettings(false); setShowNewTermMenu(false) }}
                      className={`relative shrink-0 rounded-t px-2.5 py-1 text-[10px] transition-colors ${terminalTab === tab ? 'bg-[#282350] text-white font-medium' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
                      {lbl[tab]}
                      {(tab === 'console' || tab === 'problems') && <span className="absolute right-1 top-1.5 h-1.5 w-1.5 rounded-full bg-red-400" />}
                    </button>)
                })}
                <div className="ml-auto flex items-center gap-0.5">
                  <div className="relative">
                    <button ref={newTermBtnRef} onClick={() => { setShowNewTermMenu(v => !v); setShowSettings(false) }}
                      className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-white/10 hover:text-white text-[15px] font-light" title="新建终端">+</button>
                    {showNewTermMenu && createPortal(
                      <div id="new-term-menu" className="fixed z-[99999] min-w-[180px] rounded-lg border border-[#3a3466] bg-[#1c1938] py-1 shadow-xl"
                        style={{ top: newTermMenuPos.top, left: newTermMenuPos.left }}>
                        {(Object.entries(TERMINAL_TYPE_LABELS) as [TerminalType, string][]).map(([k, l]) =>
                          <button key={k} onClick={() => addTerminal(k)} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[11px] text-gray-300 hover:bg-indigo-600/25 hover:text-white">
                            <span>{TERMINAL_TYPE_ICONS[k]}</span><span>{l}</span>
                          </button>)}
                      </div>, document.body)}
                  </div>
                  <div className="relative">
                    <button ref={settingsBtnRef} onClick={() => { setShowSettings(v => !v); setShowNewTermMenu(false) }}
                      className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-white/10 hover:text-white text-[13px]" title="问题日志设置">&#9881;</button>
                    {showSettings && createPortal(
                      <div id="settings-menu" className="fixed z-[99999] w-[200px] rounded-lg border border-[#3a3466] bg-[#1c1938] py-1.5 px-3 shadow-xl"
                        style={{ top: settingsMenuPos.top, left: settingsMenuPos.left }}>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">日志级别</div>
                        {[{k:'error',i:'\u274C',l:'错误',c:'text-red-400'},{k:'warning',i:'\u26A0',l:'警告',c:'text-yellow-400'},{k:'info',i:'\u2139',l:'信息',c:'text-cyan-400'}].map(it =>
                          <label key={it.k} className="flex cursor-pointer items-center gap-2 py-1.5 text-[11px]">
                            <input type="checkbox" checked={logLevels[it.k as keyof typeof logLevels]} onChange={e => setLogLevels(p => ({...p, [it.k]: e.target.checked}))} className="h-3 w-3 rounded accent-indigo-500" />
                            <span className={it.c}>{it.i}</span><span className="text-gray-300">{it.l}</span>
                          </label>)}
                        <div className="border-t border-[#3a3466] my-1.5 pt-1.5">
                          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">终端操作</div>
                          <button onClick={() => { const ref = termRefs.current.get(activeTerminalId); if (ref) { try { ref.term.clear() } catch {} }; setShowSettings(false) }}
                            className="flex w-full items-center gap-2 py-1.5 text-[11px] text-gray-300 hover:text-white hover:bg-indigo-600/25 rounded px-1 transition-colors">
                            <span>{'\u{1F5D1}'}</span><span>清空终端</span>
                          </button>
                          <button onClick={() => { const ref = termRefs.current.get(activeTerminalId); if (ref) { try { ref.fit.fit() } catch {} }; setShowSettings(false) }}
                            className="flex w-full items-center gap-2 py-1.5 text-[11px] text-gray-300 hover:text-white hover:bg-indigo-600/25 rounded px-1 transition-colors">
                            <span>{'\u{1F4D0}'}</span><span>重新适配大小</span>
                          </button>
                          <button onClick={() => { removeTerminal(activeTerminalId); setShowSettings(false) }}
                            className="flex w-full items-center gap-2 py-1.5 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-600/15 rounded px-1 transition-colors">
                            <span>&#10005;</span><span>关闭当前终端</span>
                          </button>
                        </div>
                      </div>, document.body)}
                  </div>
                </div>
              </div>

              {/* Terminal body */}
              <div className="flex min-h-0 flex-1 overflow-hidden bg-[#0a0914]">
                {terminalTab === 'terminal' && (
                  <>
                    <div className="min-h-0 flex-1 overflow-hidden relative">
                      {terminals.map(t => (
                        <div key={t.id} id={`xterm-${t.id}`} className="h-full w-full absolute inset-0"
                          style={{ display: t.id === activeTerminalId ? 'block' : 'none' }} />
                      ))}
                    </div>
                    {terminals.length > 1 && (
                      <div className="flex w-[160px] shrink-0 flex-col border-l border-[#252045] bg-[#111024]">
                        {terminals.map(t =>
                          <div key={t.id} onClick={() => { setActiveTerminalId(t.id); setTerminals(p => p.map(x => ({...x, active: x.id === t.id}))) }}
                            className={`group flex cursor-pointer items-center gap-1.5 border-b border-[#1e1a35] px-2 py-1.5 text-[10px] transition-colors ${t.active ? 'bg-indigo-600/25 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}>
                            <span className="shrink-0 text-[12px]">{TERMINAL_TYPE_ICONS[t.type]}</span>
                            <span className="min-w-0 flex-1 truncate">{t.name}</span>
                            <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                              <button onClick={e => { e.stopPropagation(); restartTerminal(t.id) }} className="flex h-4 w-4 items-center justify-center rounded hover:bg-white/10 text-[9px] text-green-400" title="刷新终端">&#8635;</button>
                              <button onClick={e => { e.stopPropagation(); removeTerminal(t.id) }} className="flex h-4 w-4 items-center justify-center rounded hover:bg-red-500/30 text-[9px] text-red-400" title="关闭终端">&#215;</button>
                            </div>
                          </div>)}
                      </div>
                    )}
                  </>
                )}
                {terminalTab === 'console' && (
                  <div className="flex-1 overflow-auto p-4 font-mono text-[11px] text-gray-300">
                    <div className="text-gray-500 mb-2">=== 控制台输出 ===</div>
                    <div className="text-green-400">[INFO] 系统初始化完成</div>
                    <div className="text-green-400">[INFO] 终端服务已启动</div>
                    <div className="text-blue-400">[DEBUG] 工作目录: {workspacePath || '未设置'}</div>
                    <div className="text-gray-400">{`>`} 等待命令输入...</div>
                  </div>
                )}
                {terminalTab === 'problems' && (
                  <div className="flex-1 overflow-auto p-4 font-mono text-[11px] text-gray-300">
                    <div className="text-gray-500 mb-2">=== 问题面板 ===</div>
                    <div className="text-green-400">当前无错误或警告。</div>
                  </div>
                )}
                {terminalTab === 'output' && (
                  <div className="flex-1 overflow-auto p-4 font-mono text-[11px] text-gray-300">
                    <div className="text-gray-500 mb-2">=== 任务输出 ===</div>
                    <div className="text-gray-400">没有正在运行的任务。</div>
                  </div>
                )}
                {terminalTab === 'debug' && (
                  <div className="flex-1 overflow-auto p-4 font-mono text-[11px] text-gray-300">
                    <div className="text-gray-500 mb-2">=== 调试控制台 ===</div>
                    <div className="text-gray-400">调试会话未启动。</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
