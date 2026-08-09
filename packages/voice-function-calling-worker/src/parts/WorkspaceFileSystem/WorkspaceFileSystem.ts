import * as Rpc from '../Rpc/Rpc.ts'

interface FileSystemDirent {
  readonly name: string
  readonly type: number
}

export interface WorkspaceFileSystemApi {
  readonly exists: (uri: string) => Promise<boolean>
  readonly getWorkspaceUri: () => Promise<string>
  readonly readDirWithFileTypes: (
    uri: string,
  ) => Promise<readonly FileSystemDirent[]>
  readonly readFile: (uri: string) => Promise<string>
  readonly writeFile: (uri: string, content: string) => Promise<void>
}

const defaultApi: WorkspaceFileSystemApi = {
  exists: (uri) => Rpc.invoke<boolean>('WorkspaceFileSystem.exists', uri),
  getWorkspaceUri: () =>
    Rpc.invoke<string>('WorkspaceFileSystem.getWorkspaceUri'),
  readDirWithFileTypes: (uri) =>
    Rpc.invoke<readonly FileSystemDirent[]>(
      'WorkspaceFileSystem.readDirWithFileTypes',
      uri,
    ),
  readFile: (uri) => Rpc.invoke<string>('WorkspaceFileSystem.readFile', uri),
  writeFile: (uri, content) =>
    Rpc.invoke<void>('WorkspaceFileSystem.writeFile', uri, content),
}

const uriSchemeRegex = /^[A-Za-z][A-Za-z\d+.-]*:/
const windowsAbsolutePathRegex = /^[A-Za-z]:[\\/]/
const pathSeparatorRegex = /[\\/]+/

const getPathSegments = (
  relativePath: string,
  pathKind: 'directory' | 'file',
  allowWorkspaceRoot = false,
): readonly string[] => {
  const trimmedPath = relativePath.trim()
  if (!trimmedPath) {
    throw new Error(`Workspace ${pathKind} path is required.`)
  }
  if (
    trimmedPath.startsWith('/') ||
    trimmedPath.startsWith('\\') ||
    uriSchemeRegex.test(trimmedPath) ||
    windowsAbsolutePathRegex.test(trimmedPath)
  ) {
    throw new Error(`Workspace ${pathKind} path must be relative.`)
  }
  const segments = trimmedPath
    .split(pathSeparatorRegex)
    .filter((segment) => segment && segment !== '.')
  if (segments.includes('..')) {
    throw new Error(
      `Workspace ${pathKind} path cannot leave the opened workspace.`,
    )
  }
  if (segments.length === 0 && !allowWorkspaceRoot) {
    throw new Error(`Workspace ${pathKind} path is required.`)
  }
  return segments
}

const resolveWorkspaceUri = (
  workspaceUri: string,
  relativePath: string,
  pathKind: 'directory' | 'file',
  allowWorkspaceRoot = false,
): string => {
  if (!workspaceUri) {
    throw new Error('No workspace folder is currently open.')
  }
  if (!uriSchemeRegex.test(workspaceUri)) {
    throw new Error(
      'The opened workspace does not provide a valid filesystem URI.',
    )
  }
  const segments = getPathSegments(relativePath, pathKind, allowWorkspaceRoot)
  if (segments.length === 0) {
    return workspaceUri
  }
  const workspaceRoot = workspaceUri.endsWith('/')
    ? workspaceUri
    : `${workspaceUri}/`
  try {
    return new URL(
      segments.map((segment) => encodeURIComponent(segment)).join('/'),
      workspaceRoot,
    ).href
  } catch {
    throw new Error(
      'The opened workspace does not provide a valid filesystem URI.',
    )
  }
}

export const resolveWorkspaceFileUri = (
  workspaceUri: string,
  relativePath: string,
): string => {
  return resolveWorkspaceUri(workspaceUri, relativePath, 'file')
}

export const resolveWorkspaceDirectoryUri = (
  workspaceUri: string,
  relativePath: string,
): string => {
  return resolveWorkspaceUri(workspaceUri, relativePath, 'directory', true)
}

type WorkspaceDirectoryEntryType =
  | 'block-device'
  | 'character-device'
  | 'directory'
  | 'fifo'
  | 'file'
  | 'socket'
  | 'symbolic-link'
  | 'unknown'

interface WorkspaceDirectoryEntry {
  readonly name: string
  readonly type: WorkspaceDirectoryEntryType
}

const directoryEntryTypes = new Set([3, 4, 5, 11])
const fileEntryTypes = new Set([7, 10])
const ignoredSearchDirectoryNames = new Set(['.git', 'node_modules'])
const maximumConcurrentDirectoryReads = 16
const maximumSearchDirectoryCount = 5000
const maximumSearchMatchCount = 50
const searchTermRegex = /[\p{L}\p{N}]+/gu

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error)
}

const getDirectoryEntryType = (type: number): WorkspaceDirectoryEntryType => {
  switch (type) {
    case 1:
      return 'block-device'
    case 10:
      return 'file'
    case 11:
      return 'directory'
    case 2:
      return 'character-device'
    case 3:
    case 4:
    case 5:
      return 'directory'
    case 6:
      return 'fifo'
    case 7:
      return 'file'
    case 8:
      return 'socket'
    case 9:
      return 'symbolic-link'
    default:
      return 'unknown'
  }
}

export const listWorkspaceDirectory = async (
  relativePath: string,
  api: WorkspaceFileSystemApi = defaultApi,
): Promise<
  Readonly<{
    entries: readonly WorkspaceDirectoryEntry[]
    path: string
  }>
> => {
  const workspaceUri = await api.getWorkspaceUri()
  const directoryUri = resolveWorkspaceDirectoryUri(workspaceUri, relativePath)
  let dirents: readonly FileSystemDirent[]
  try {
    dirents = await api.readDirWithFileTypes(directoryUri)
  } catch (error) {
    throw new Error(
      `Failed to list workspace directory "${relativePath}": ${getErrorMessage(error)}`,
    )
  }
  const entries = dirents
    .map<WorkspaceDirectoryEntry>((dirent) => ({
      name: dirent.name,
      type: getDirectoryEntryType(dirent.type),
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name))
  return {
    entries,
    path: relativePath,
  }
}

const getSearchTerms = (query: string): readonly string[] => {
  const trimmedQuery = query.trim().toLocaleLowerCase()
  if (!trimmedQuery) {
    throw new Error('Workspace file search query is required.')
  }
  const terms = trimmedQuery.match(searchTermRegex) || []
  if (terms.length === 0) {
    throw new Error(
      'Workspace file search query must contain a letter or number.',
    )
  }
  return terms
}

const joinWorkspacePath = (directoryPath: string, name: string): string => {
  return directoryPath === '.' ? name : `${directoryPath}/${name}`
}

const matchesSearchTerms = (
  relativePath: string,
  terms: readonly string[],
): boolean => {
  const normalizedPath = relativePath.toLocaleLowerCase()
  return terms.every((term) => normalizedPath.includes(term))
}

interface SearchDirectoryResult {
  readonly directoryPath: string
  readonly dirents: readonly FileSystemDirent[]
}

const readSearchDirectory = async (
  workspaceUri: string,
  directoryPath: string,
  api: WorkspaceFileSystemApi,
): Promise<SearchDirectoryResult> => {
  const directoryUri = resolveWorkspaceDirectoryUri(workspaceUri, directoryPath)
  try {
    const dirents = await api.readDirWithFileTypes(directoryUri)
    return { directoryPath, dirents }
  } catch (error) {
    if (directoryPath === '.') {
      throw new Error(
        `Failed to search workspace files: ${getErrorMessage(error)}`,
      )
    }
    return { directoryPath, dirents: [] }
  }
}

const collectSearchBatch = (
  batchResults: readonly SearchDirectoryResult[],
  terms: readonly string[],
): Readonly<{
  directories: readonly string[]
  matches: readonly string[]
}> => {
  const directories: string[] = []
  const matches: string[] = []
  for (const { directoryPath, dirents } of batchResults) {
    for (const dirent of dirents) {
      const relativePath = joinWorkspacePath(directoryPath, dirent.name)
      if (
        directoryEntryTypes.has(dirent.type) &&
        !ignoredSearchDirectoryNames.has(dirent.name)
      ) {
        directories.push(relativePath)
      } else if (
        fileEntryTypes.has(dirent.type) &&
        matchesSearchTerms(relativePath, terms)
      ) {
        matches.push(relativePath)
      }
    }
  }
  return { directories, matches }
}

export const searchWorkspaceFiles = async (
  query: string,
  api: WorkspaceFileSystemApi = defaultApi,
): Promise<
  Readonly<{
    matches: readonly string[]
    query: string
    truncated: boolean
  }>
> => {
  const terms = getSearchTerms(query)
  const workspaceUri = await api.getWorkspaceUri()
  const pendingDirectories = ['.']
  const matches: string[] = []
  let nextDirectoryIndex = 0
  let searchedDirectoryCount = 0

  while (
    nextDirectoryIndex < pendingDirectories.length &&
    searchedDirectoryCount < maximumSearchDirectoryCount &&
    matches.length < maximumSearchMatchCount
  ) {
    const batchSize = Math.min(
      maximumConcurrentDirectoryReads,
      maximumSearchDirectoryCount - searchedDirectoryCount,
      pendingDirectories.length - nextDirectoryIndex,
    )
    const batch = pendingDirectories.slice(
      nextDirectoryIndex,
      nextDirectoryIndex + batchSize,
    )
    nextDirectoryIndex += batchSize
    searchedDirectoryCount += batchSize
    const batchResults = await Promise.all(
      batch.map((directoryPath) =>
        readSearchDirectory(workspaceUri, directoryPath, api),
      ),
    )
    const batchEntries = collectSearchBatch(batchResults, terms)
    pendingDirectories.push(...batchEntries.directories)
    const remainingMatchCount = maximumSearchMatchCount - matches.length
    matches.push(...batchEntries.matches.slice(0, remainingMatchCount))
  }

  return {
    matches: matches.toSorted((a, b) => a.localeCompare(b)),
    query,
    truncated:
      nextDirectoryIndex < pendingDirectories.length ||
      matches.length === maximumSearchMatchCount,
  }
}

export const ensureWorkspaceFileExists = async (
  workspaceUri: string,
  relativePath: string,
  api: WorkspaceFileSystemApi = defaultApi,
): Promise<void> => {
  const fileUri = resolveWorkspaceFileUri(workspaceUri, relativePath)
  let fileExists: boolean
  try {
    fileExists = await api.exists(fileUri)
  } catch (error) {
    throw new Error(
      `Failed to check workspace file "${relativePath}": ${getErrorMessage(error)}`,
    )
  }
  if (!fileExists) {
    throw new Error(`Workspace file "${relativePath}" was not found.`)
  }
}

export const readWorkspaceFile = async (
  relativePath: string,
  api: WorkspaceFileSystemApi = defaultApi,
): Promise<Readonly<{ content: string; path: string }>> => {
  const workspaceUri = await api.getWorkspaceUri()
  const fileUri = resolveWorkspaceFileUri(workspaceUri, relativePath)
  let content: string
  try {
    content = await api.readFile(fileUri)
  } catch (error) {
    throw new Error(
      `Failed to read workspace file "${relativePath}": ${getErrorMessage(error)}`,
    )
  }
  return {
    content,
    path: relativePath,
  }
}

export const writeWorkspaceFile = async (
  relativePath: string,
  content: string,
  api: WorkspaceFileSystemApi = defaultApi,
): Promise<Readonly<{ path: string; written: boolean }>> => {
  const workspaceUri = await api.getWorkspaceUri()
  const fileUri = resolveWorkspaceFileUri(workspaceUri, relativePath)
  try {
    await api.writeFile(fileUri, content)
  } catch (error) {
    throw new Error(
      `Failed to write workspace file "${relativePath}": ${getErrorMessage(error)}`,
    )
  }
  return {
    path: relativePath,
    written: true,
  }
}
