import { createNodeRpc, getPreference } from '@lvce-editor/api'

interface Rpc {
  readonly invoke: (
    method: string,
    ...params: readonly unknown[]
  ) => Promise<unknown>
}

interface ComputerUseTool {
  readonly description?: string
  readonly inputSchema: Readonly<Record<string, unknown>>
  readonly name: string
}

type CreateNodeRpc = (options: { readonly id: string }) => Promise<Rpc>

export const computerUseLinuxEnabledPreference =
  'gptvoice.tools.computerUseLinux.enabled'

export const state: {
  createNodeRpc: CreateNodeRpc
  getPreference: (key: string) => Promise<unknown>
  rpcPromise: Promise<Rpc> | undefined
} = {
  createNodeRpc,
  getPreference,
  rpcPromise: undefined,
}

const getRpc = (): Promise<Rpc> => {
  const { createNodeRpc, rpcPromise } = state
  if (rpcPromise) return rpcPromise
  const newRpcPromise = createNodeRpc({ id: 'builtin.gpt-voice.terminal-node' })
  state.rpcPromise = newRpcPromise
  return newRpcPromise
}

export const isEnabled = async (): Promise<boolean> => {
  const { getPreference } = state
  return (await getPreference(computerUseLinuxEnabledPreference)) === true
}

export const getTools = async (): Promise<readonly ComputerUseTool[]> => {
  if (!(await isEnabled())) return []
  try {
    const rpc = await getRpc()
    return (await rpc.invoke(
      'ComputerUse.getTools',
    )) as readonly ComputerUseTool[]
  } catch (error) {
    return [
      {
        description: `Computer use is unavailable: ${error instanceof Error ? error.message : String(error)}`,
        inputSchema: {
          additionalProperties: false,
          properties: {},
          type: 'object',
        },
        name: 'unavailable',
      },
    ]
  }
}

export const callTool = async (
  name: string,
  argumentsValue: Readonly<Record<string, unknown>>,
): Promise<unknown> => {
  if (!(await isEnabled())) {
    const rpc = await getRpc()
    await rpc.invoke('ComputerUse.stop')
    throw new Error(
      `Computer-use access is disabled. Enable ${computerUseLinuxEnabledPreference} to allow desktop control.`,
    )
  }
  const rpc = await getRpc()
  return rpc.invoke('ComputerUse.callTool', name, argumentsValue)
}
