import {
  createNodeRpc,
  executeCommand,
  getPreference,
  getWorkspaceUri,
} from '@lvce-editor/api'

interface Rpc {
  readonly invoke: (
    method: string,
    ...params: readonly unknown[]
  ) => Promise<unknown>
}

type CreateNodeRpc = (options: { readonly id: string }) => Promise<Rpc>

export interface TerminalCommandResult {
  readonly exitCode: number | null
  readonly stderr: string
  readonly stdout: string
  readonly timedOut: boolean
}

export interface IntegratedTerminalCommandResult {
  readonly command: string
  readonly success: true
}

export const terminalToolEnabledPreference = 'gptvoice.tools.terminal.enabled'

export const state: {
  createNodeRpc: CreateNodeRpc
  getPreference: (key: string) => Promise<unknown>
  getWorkspaceUri: () => Promise<string>
  rpcPromise: Promise<Rpc> | undefined
} = {
  createNodeRpc,
  getPreference,
  getWorkspaceUri,
  rpcPromise: undefined,
}

export const isEnabled = async (): Promise<boolean> => {
  const { getPreference } = state
  return (await getPreference(terminalToolEnabledPreference)) === true
}

const getRpc = (): Promise<Rpc> => {
  const { createNodeRpc, rpcPromise } = state
  if (rpcPromise) {
    return rpcPromise
  }
  const newRpcPromise = createNodeRpc({
    id: 'builtin.gpt-voice.terminal-node',
  })
  state.rpcPromise = newRpcPromise
  return newRpcPromise
}

export const executeBash = async (
  command: string,
): Promise<TerminalCommandResult> => {
  if (!(await isEnabled())) {
    throw new Error(
      `Terminal tool access is disabled. Enable ${terminalToolEnabledPreference} to allow Bash command execution.`,
    )
  }
  const { getWorkspaceUri } = state
  const workspaceUri = await getWorkspaceUri()
  if (!workspaceUri) {
    throw new Error('Open a local workspace before executing a Bash command.')
  }
  const rpc = await getRpc()
  return rpc.invoke(
    'Terminal.executeBash',
    command,
    workspaceUri,
  ) as Promise<TerminalCommandResult>
}

export const runInTerminal = async (
  command: string,
): Promise<IntegratedTerminalCommandResult> => {
  if (!(await isEnabled())) {
    throw new Error(
      `Terminal tool access is disabled. Enable ${terminalToolEnabledPreference} to allow terminal command execution.`,
    )
  }
  if (typeof command !== 'string' || !command.trim()) {
    throw new TypeError('Terminal command must be a non-empty string.')
  }
  await executeCommand('Layout.showPanel', 'Terminals')
  await executeCommand('Terminals.sendText', `${command}\r`)
  return { command, success: true }
}
