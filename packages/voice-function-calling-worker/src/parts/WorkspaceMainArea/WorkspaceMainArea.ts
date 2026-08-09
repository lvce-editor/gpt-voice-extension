import * as Rpc from '../Rpc/Rpc.ts'
import {
  ensureWorkspaceFileExists,
  resolveWorkspaceFileUri,
  type WorkspaceFileSystemApi,
} from '../WorkspaceFileSystem/WorkspaceFileSystem.ts'

export interface WorkspaceMainAreaApi {
  readonly closeUri: (uri: string) => Promise<void>
  readonly getWorkspaceUri: () => Promise<string>
  readonly openUri: (uri: string) => Promise<void>
  readonly setQuickPickValue: (value: string) => Promise<void>
  readonly showFileQuickPick: () => Promise<void>
}

const defaultApi: WorkspaceMainAreaApi = {
  closeUri: (uri) => Rpc.invoke<void>('WorkspaceMainArea.closeUri', uri),
  getWorkspaceUri: () =>
    Rpc.invoke<string>('WorkspaceMainArea.getWorkspaceUri'),
  openUri: (uri) => Rpc.invoke<void>('WorkspaceMainArea.openUri', uri),
  setQuickPickValue: (value) =>
    Rpc.invoke<void>('WorkspaceMainArea.setQuickPickValue', value),
  showFileQuickPick: () =>
    Rpc.invoke<void>('WorkspaceMainArea.showFileQuickPick'),
}

export const setQuickPickValue = async (
  value: string,
  api: WorkspaceMainAreaApi = defaultApi,
): Promise<Readonly<{ updated: boolean; value: string }>> => {
  await api.setQuickPickValue(value)
  return { updated: true, value }
}

export const showFileQuickPick = async (
  api: WorkspaceMainAreaApi = defaultApi,
): Promise<Readonly<{ shown: boolean }>> => {
  await api.showFileQuickPick()
  return { shown: true }
}

export const closeWorkspaceFile = async (
  relativePath: string,
  api: WorkspaceMainAreaApi = defaultApi,
): Promise<Readonly<{ closed: boolean; path: string }>> => {
  const workspaceUri = await api.getWorkspaceUri()
  const uri = resolveWorkspaceFileUri(workspaceUri, relativePath)
  await api.closeUri(uri)
  return {
    closed: true,
    path: relativePath,
  }
}

export const openWorkspaceFile = async (
  relativePath: string,
  api: WorkspaceMainAreaApi = defaultApi,
  fileSystemApi?: WorkspaceFileSystemApi,
): Promise<Readonly<{ opened: boolean; path: string }>> => {
  const workspaceUri = await api.getWorkspaceUri()
  const uri = resolveWorkspaceFileUri(workspaceUri, relativePath)
  await ensureWorkspaceFileExists(workspaceUri, relativePath, fileSystemApi)
  await api.openUri(uri)
  return {
    opened: true,
    path: relativePath,
  }
}
