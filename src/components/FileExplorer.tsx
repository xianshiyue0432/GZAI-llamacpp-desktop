import { useState, useEffect, useCallback } from 'react'
import {
  Folder,
  File,
  ChevronDown,
  ChevronRight,
  FileText,
  FileCode,
  FileJson,
  FileImage,
  FolderOpen,
  Plus,
  Search,
  RefreshCw,
  Upload,
  X,
  AlertCircle,
  Server
} from 'lucide-react'
import type { FileTreeItem } from '../utils/selectFolder'

type FileNode = {
  name: string
  path: string
  type: 'folder' | 'file'
  extension?: string
  children?: FileNode[]
}

function FileIcon({ extension }: { extension?: string }) {
  switch (extension) {
    case 'py':
      return <FileCode className="w-4 h-4 text-yellow-500" />
    case 'json':
      return <FileJson className="w-4 h-4 text-yellow-600" />
    case 'md':
      return <FileText className="w-4 h-4 text-gray-600" />
    case 'toml':
    case 'lockb':
      return <File className="w-4 h-4 text-gray-500" />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
      return <FileImage className="w-4 h-4 text-green-500" />
    default:
      return <File className="w-4 h-4 text-gray-400" />
  }
}

function convertFileTreeItems(items: FileTreeItem[]): FileNode[] {
  return items.map(item => ({
    name: item.name,
    path: item.name,
    type: item.type,
    extension: item.extension,
    children: item.children ? convertFileTreeItems(item.children) : undefined,
  }))
}

function FileTree({ items, depth = 0 }: { items: FileNode[]; depth?: number }) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [dirChildren, setDirChildren] = useState<Record<string, FileNode[]>>({})
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set())

  const toggleFolder = async (node: FileNode) => {
    if (expandedFolders.has(node.path)) {
      setExpandedFolders(prev => {
        const next = new Set(prev)
        next.delete(node.path)
        return next
      })
      return
    }

    setExpandedFolders(prev => {
      const next = new Set(prev)
      next.add(node.path)
      return next
    })

    if (node.children === undefined && !dirChildren[node.path]) {
      setLoadingDirs(prev => new Set(prev).add(node.path))
      try {
        const { readDir } = await import('@tauri-apps/plugin-fs')
        const entries = await readDir(node.path)
        const nodes: FileNode[] = entries
          .filter(e => e.name)
          .map(entry => {
            const isDir = entry.isDirectory
            const n: FileNode = {
              name: entry.name,
              path: node.path.endsWith('\\') || node.path.endsWith('/')
                ? node.path + entry.name
                : node.path + (node.path.includes('\\') ? '\\' : '/') + entry.name,
              type: isDir ? 'folder' : 'file',
            }
            if (!isDir) {
              const dot = entry.name.lastIndexOf('.')
              n.extension = dot > 0 ? entry.name.slice(dot + 1).toLowerCase() : ''
            }
            return n
          })
        nodes.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        setDirChildren(prev => ({ ...prev, [node.path]: nodes }))
      } catch {
        setDirChildren(prev => ({ ...prev, [node.path]: [] }))
      }
      setLoadingDirs(prev => {
        const next = new Set(prev)
        next.delete(node.path)
        return next
      })
    }
  }

  return (
    <div className="space-y-0.5">
      {items.map((item) => {
        const isExpanded = expandedFolders.has(item.path)
        const children = item.children || dirChildren[item.path]
        const isLoading = loadingDirs.has(item.path)
        return (
          <div key={item.name + item.type}>
            <button
              onClick={() => item.type === 'folder' && toggleFolder(item)}
              className="w-full flex items-center gap-1 px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              {item.type === 'folder' && (
                isLoading ? (
                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                ) : isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                )
              )}
              {item.type === 'file' && <span className="w-3 flex-shrink-0" />}

              {item.type === 'folder' ? (
                isExpanded ? (
                  <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 text-blue-500 flex-shrink-0" />
                )
              ) : (
                <FileIcon extension={item.extension} />
              )}

              <span className="truncate">{item.name}</span>
            </button>

            {item.type === 'folder' && isExpanded && children && children.length > 0 && (
              <div className="ml-4">
                <FileTree items={children} depth={depth + 1} />
              </div>
            )}

            {item.type === 'folder' && isExpanded && children && children.length === 0 && (
              <div className="ml-8 py-1 text-xs text-gray-400">空目录</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface FileExplorerProps {
  selectedFolder?: string
  fileTree?: FileTreeItem[] | null
  onClose?: () => void
}

export default function FileExplorer({ selectedFolder, fileTree, onClose }: FileExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [nativeFiles, setNativeFiles] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nativeAvailable, setNativeAvailable] = useState<boolean | null>(null)

  const loadNativeRoot = useCallback(async (folderPath: string) => {
    if (!folderPath || folderPath === '选择项目...') {
      setNativeFiles([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { readDir } = await import('@tauri-apps/plugin-fs')
      const entries = await readDir(folderPath)
      setNativeAvailable(true)

      const nodes: FileNode[] = entries
        .filter(e => e.name)
        .map(entry => {
          const isDir = entry.isDirectory
          const n: FileNode = {
            name: entry.name,
            path: folderPath.endsWith('\\') || folderPath.endsWith('/')
              ? folderPath + entry.name
              : folderPath + (folderPath.includes('\\') ? '\\' : '/') + entry.name,
            type: isDir ? 'folder' : 'file',
          }
          if (!isDir) {
            const dot = entry.name.lastIndexOf('.')
            n.extension = dot > 0 ? entry.name.slice(dot + 1).toLowerCase() : ''
          }
          return n
        })
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      setNativeFiles(nodes)
    } catch {
      setNativeAvailable(false)
      setNativeFiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNativeRoot(selectedFolder || '')
  }, [selectedFolder, loadNativeRoot])

  const hasFolder = selectedFolder && selectedFolder !== '选择项目...'

  const useNative = nativeAvailable === true
  const useFileTree = nativeAvailable === false && fileTree !== null && fileTree !== undefined

  const rootFiles: FileNode[] = useNative
    ? nativeFiles
    : useFileTree
      ? convertFileTreeItems(fileTree!)
      : []

  return (
    <div className="h-full bg-white dark:bg-gray-800 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">文件</h3>
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="刷新"
            onClick={() => selectedFolder && loadNativeRoot(selectedFolder)}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors" title="上传">
            <Upload className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors" title="新建">
            <Plus className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:bg-red-100 dark:hover:bg-red-700 rounded transition-colors"
            title="关闭面板"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {hasFolder && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850">
          <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0" />
          <span className="text-xs text-gray-600 dark:text-gray-400 truncate" title={selectedFolder}>
            {selectedFolder}
          </span>
        </div>
      )}

      {useFileTree && (
        <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-850 border-b border-gray-200 dark:border-gray-700">
          <Server className="w-3 h-3" />
          <span>文件列表基于文件夹选择时的快照</span>
        </div>
      )}

      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索文件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {!hasFolder && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Folder className="w-8 h-8 mb-2" />
            <p className="text-xs">请选择一个任务文件夹</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <AlertCircle className="w-8 h-8 mb-2 text-red-400" />
            <p className="text-xs text-center px-4">读取文件夹失败</p>
          </div>
        )}

        {hasFolder && !loading && !error && rootFiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Folder className="w-8 h-8 mb-2" />
            <p className="text-xs">暂无文件</p>
          </div>
        )}

        {hasFolder && !loading && !error && rootFiles.length > 0 && (
          <FileTree items={rootFiles} />
        )}
      </div>
    </div>
  )
}
