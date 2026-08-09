import {
  closeUri,
  createRpc,
  executeCommand,
  exists,
  formatDocument,
  getDiagnostics,
  getWorkspaceUri,
  openDebugConsole,
  openOutputView,
  openProblemsView,
  openProcessExplorer,
  openSettings,
  openUri,
  readDirWithFileTypes,
  readFile,
  setWorkspaceUri,
  showCompletions,
  showFileQuickPick,
  writeFile,
} from '@lvce-editor/api'
import * as TerminalNode from '../TerminalNode/TerminalNode.ts'

export interface FunctionToolDefinition {
  readonly description: string
  readonly name: string
  readonly parameters: Readonly<Record<string, unknown>>
  readonly type: 'function'
}

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

const commandMap = {
  'Editor.formatDocument': formatDocument,
  'Editor.getDiagnostics': getDiagnostics,
  'Editor.showCompletions': showCompletions,
  'Panel.close': closePanel,
  'Panel.open': openPanel,
  'PanelView.openDebugConsole': openDebugConsole,
  'PanelView.openOutputView': openOutputView,
  'PanelView.openProblemsView': openProblemsView,
  'ProcessExplorer.open': openProcessExplorer,
  'Settings.openSettings': openSettings,
  'Terminal.executeBash': TerminalNode.executeBash,
  'Workspace.setWorkspaceUri': setWorkspaceUri,
  'WorkspaceFileSystem.exists': exists,
  'WorkspaceFileSystem.getWorkspaceUri': getWorkspaceUri,
  'WorkspaceFileSystem.readDirWithFileTypes': readDirWithFileTypes,
  'WorkspaceFileSystem.readFile': readFile,
  'WorkspaceFileSystem.writeFile': writeFile,
  'WorkspaceMainArea.closeUri': closeUri,
  'WorkspaceMainArea.getWorkspaceUri': getWorkspaceUri,
  'WorkspaceMainArea.openUri': openUri,
  'WorkspaceMainArea.setQuickPickValue': setQuickPickValue,
  'WorkspaceMainArea.showFileQuickPick': showFileQuickPick,
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
