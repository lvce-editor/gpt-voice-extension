import type { FunctionToolDefinition } from 'voice-shared'
import {
  closeUri,
  createRpc,
  executeCommand,
  exists,
  focusNextTab,
  focusPreviousTab,
  formatDocument,
  getDiagnostics,
  getEditorSelections,
  getRecentlyOpenedWorkspaceUris,
  getWorkspaceUri,
  openDebugConsole,
  openOutputView,
  openProblemsView,
  openProcessExplorer,
  openSettings,
  openUri,
  readDirWithFileTypes,
  readFile,
  setEditorSelections,
  setSettingsSearchValue,
  setWorkspaceUri,
  showCompletions,
  showFileQuickPick,
  writeFile,
} from '@lvce-editor/api'
import * as TerminalNode from '../TerminalNode/TerminalNode.ts'
import {
  readOpenTextDocument,
  writeOpenTextDocument,
} from '../WorkspaceTextEditor/WorkspaceTextEditor.ts'

export type { FunctionToolDefinition } from 'voice-shared'

interface Rpc {
  readonly invoke: (
    method: string,
    ...params: readonly unknown[]
  ) => Promise<unknown>
}

interface WebWorkerRpcOptions {
  readonly commandMap?: Readonly<Record<string, unknown>>
  readonly contentSecurityPolicy?: string
  readonly name?: string
  readonly url: string
}

type CreateRpc = (options: WebWorkerRpcOptions) => Promise<Rpc>

const closePanel = async (): Promise<void> => {
  await executeCommand('Layout.hidePanel')
}

const openPanel = async (view?: string): Promise<void> => {
  if (view === undefined) {
    await executeCommand('Layout.showPanel')
    return
  }
  await executeCommand('Layout.showPanel', view)
}

const setQuickPickValue = async (value: string): Promise<void> => {
  await executeCommand('QuickPick.setValue', value)
}

const closeAllEditors = async (): Promise<void> => {
  await executeCommand('Main.closeAllEditors')
}

const getOpenEditorUris = async (): Promise<unknown> => {
  return executeCommand('GetActiveEditor.getOpenEditorUris')
}

const closeSideBar = async (): Promise<void> => {
  await executeCommand('Layout.hideSideBar')
}

const toggleSideBarPosition = async (): Promise<void> => {
  await executeCommand('Layout.toggleSideBarPosition')
}

const openPreview = async (uri: string): Promise<void> => {
  await executeCommand('Layout.showPreview', uri)
}

const closePreview = async (): Promise<void> => {
  await executeCommand('Layout.hidePreview')
}

const getPreviewRuntimeDiagnostics = async (): Promise<unknown> => {
  return executeCommand('Preview.getRuntimeDiagnostics')
}

const commandMap = {
  'Editor.formatDocument': formatDocument,
  'Editor.getDiagnostics': getDiagnostics,
  'Editor.getSelections': getEditorSelections,
  'Editor.setSelections': setEditorSelections,
  'Editor.showCompletions': showCompletions,
  'Layout.closeSideBar': closeSideBar,
  'Layout.toggleSideBarPosition': toggleSideBarPosition,
  'MainArea.closeAllEditors': closeAllEditors,
  'MainArea.focusNextTab': focusNextTab,
  'MainArea.focusPreviousTab': focusPreviousTab,
  'MainArea.getOpenEditorUris': getOpenEditorUris,
  'Panel.close': closePanel,
  'Panel.open': openPanel,
  'PanelView.openDebugConsole': openDebugConsole,
  'PanelView.openOutputView': openOutputView,
  'PanelView.openProblemsView': openProblemsView,
  'Preview.close': closePreview,
  'Preview.getRuntimeDiagnostics': getPreviewRuntimeDiagnostics,
  'Preview.open': openPreview,
  'ProcessExplorer.open': openProcessExplorer,
  'Settings.openSettings': openSettings,
  'Settings.setSearchValue': setSettingsSearchValue,
  'Terminal.executeBash': TerminalNode.executeBash,
  'Terminal.runInTerminal': TerminalNode.runInTerminal,
  'Workspace.getRecentlyOpenedWorkspaceUris': getRecentlyOpenedWorkspaceUris,
  'Workspace.setWorkspaceUri': setWorkspaceUri,
  'WorkspaceFileSystem.exists': exists,
  'WorkspaceFileSystem.getWorkspaceUri': getWorkspaceUri,
  'WorkspaceFileSystem.readDirWithFileTypes': readDirWithFileTypes,
  'WorkspaceFileSystem.readFile': readFile,
  'WorkspaceFileSystem.writeFile': writeFile,
  'WorkspaceMainArea.closeUri': closeUri,
  'WorkspaceMainArea.getWorkspaceUri': getWorkspaceUri,
  'WorkspaceMainArea.openUri': openUri,
  'WorkspaceMainArea.readOpenTextDocument': readOpenTextDocument,
  'WorkspaceMainArea.setQuickPickValue': setQuickPickValue,
  'WorkspaceMainArea.showFileQuickPick': showFileQuickPick,
  'WorkspaceMainArea.writeOpenTextDocument': writeOpenTextDocument,
}

export const state: {
  createRpc: CreateRpc
  rpcPromise: Promise<Rpc> | undefined
} = {
  createRpc,
  rpcPromise: undefined,
}

const getRpc = (): Promise<Rpc> => {
  const { createRpc, rpcPromise } = state
  if (rpcPromise) {
    return rpcPromise
  }
  const newRpcPromise = createRpc({
    commandMap,
    contentSecurityPolicy: "default-src 'none'; script-src 'self'",
    name: 'Voice Function Calling Worker',
    url: new URL('voiceFunctionCallingWorkerMain.js', import.meta.url).href,
  })
  state.rpcPromise = newRpcPromise
  return newRpcPromise
}

export const getRegisteredTools = async (): Promise<
  readonly FunctionToolDefinition[]
> => {
  const rpc = await getRpc()
  const terminalEnabled = await TerminalNode.isEnabled()
  return rpc.invoke(
    'VoiceFunctionCalling.getRegisteredTools',
    terminalEnabled,
  ) as Promise<readonly FunctionToolDefinition[]>
}

export const executeFunctionToolCall = async (
  functionCallEvent: unknown,
): Promise<readonly string[]> => {
  const rpc = await getRpc()
  return rpc.invoke(
    'VoiceFunctionCalling.executeFunctionToolCall',
    functionCallEvent,
  ) as Promise<readonly string[]>
}
