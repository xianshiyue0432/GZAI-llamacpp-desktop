export interface FileTreeItem {
  id: string
  name: string
  type: 'folder' | 'file'
  extension?: string
  children?: FileTreeItem[]
}

let treeIdCounter = 0
function nextTreeId(): string {
  return `ft-${++treeIdCounter}`
}

function getExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

function buildFileTree(files: FileList): FileTreeItem[] {
  const root: FileTreeItem[] = []
  const map = new Map<string, FileTreeItem>()

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const relativePath = file.webkitRelativePath
    if (!relativePath) continue

    const parts = relativePath.split('/')

    for (let j = 0; j < parts.length; j++) {
      const isLast = j === parts.length - 1
      const currentPath = parts.slice(0, j + 1).join('/')
      const name = parts[j]

      if (map.has(currentPath)) continue

      const item: FileTreeItem = {
        id: nextTreeId(),
        name,
        type: isLast ? 'file' : 'folder',
      }

      if (isLast) {
        item.extension = getExtension(name)
      } else {
        item.children = []
      }

      map.set(currentPath, item)

      if (j === 0) {
        root.push(item)
      } else {
        const parentPath = parts.slice(0, j).join('/')
        const parent = map.get(parentPath)
        if (parent && parent.children) {
          parent.children.push(item)
        }
      }
    }
  }

  function sortItems(items: FileTreeItem[]) {
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const item of items) {
      if (item.children) sortItems(item.children)
    }
  }

  sortItems(root)
  return root
}

export interface FolderSelection {
  folderPath: string
  tree: FileTreeItem[]
}

export async function selectFolder(title: string = '选择文件夹'): Promise<string | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true, multiple: false, title })
    if (selected) return selected
    return null
  } catch {
  }

  return new Promise<string | null>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.style.display = 'none'
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')

    input.addEventListener('change', () => {
      const files = input.files
      if (files && files.length > 0) {
        const file = files[0]
        const path = (file as any).path || file.webkitRelativePath
        const sep = path.includes('\\') ? '\\' : '/'
        const dirEnd = path.lastIndexOf(sep)
        const folderPath = dirEnd !== -1 ? path.substring(0, dirEnd) : path
        resolve(folderPath)
      } else {
        resolve(null)
      }
      document.body.removeChild(input)
    })

    input.addEventListener('cancel', () => {
      resolve(null)
      document.body.removeChild(input)
    })

    document.body.appendChild(input)
    input.click()
  })
}

export async function selectFolderWithTree(title: string = '选择文件夹'): Promise<FolderSelection | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true, multiple: false, title })
    if (selected) {
      return { folderPath: selected, tree: [] }
    }
    return null
  } catch {
  }

  return new Promise<FolderSelection | null>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.style.display = 'none'
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')

    input.addEventListener('change', () => {
      const files = input.files
      if (files && files.length > 0) {
        const file = files[0]
        const path = (file as any).path || file.webkitRelativePath
        const sep = path.includes('\\') ? '\\' : '/'
        const dirEnd = path.lastIndexOf(sep)
        const folderPath = dirEnd !== -1 ? path.substring(0, dirEnd) : path
        const tree = buildFileTree(files)
        resolve({ folderPath, tree })
      } else {
        resolve(null)
      }
      document.body.removeChild(input)
    })

    input.addEventListener('cancel', () => {
      resolve(null)
      document.body.removeChild(input)
    })

    document.body.appendChild(input)
    input.click()
  })
}
