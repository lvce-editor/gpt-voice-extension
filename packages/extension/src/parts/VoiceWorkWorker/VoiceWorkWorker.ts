import type {
  FunctionToolDefinition,
  VoiceWorkConfiguration,
  VoiceWorkResult,
} from 'voice-shared'
import { createRpc } from '@lvce-editor/api'
import * as VoiceFunctionCallingWorker from '../VoiceFunctionCallingWorker/VoiceFunctionCallingWorker.ts'

interface Rpc {
  readonly invoke: (
    method: string,
    ...params: readonly unknown[]
  ) => Promise<unknown>
}

type CreateRpc = typeof createRpc

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
    commandMap: {
      'VoiceWorkHost.executeFunctionTool':
        VoiceFunctionCallingWorker.executeFunctionTool,
    },
    id: 'builtin.gpt-voice.voice-work-worker',
  }) as Promise<Rpc>
  state.rpcPromise = newRpcPromise
  return newRpcPromise
}

export const getToolDefinition = async (): Promise<FunctionToolDefinition> => {
  const rpc = await getRpc()
  return rpc.invoke(
    'VoiceWork.getToolDefinition',
  ) as Promise<FunctionToolDefinition>
}

export const execute = async (
  task: string,
  configuration: VoiceWorkConfiguration,
): Promise<VoiceWorkResult> => {
  const [rpc, tools] = await Promise.all([
    getRpc(),
    VoiceFunctionCallingWorker.getWorkTools(),
  ])
  return rpc.invoke('VoiceWork.execute', {
    configuration,
    task,
    tools,
  }) as Promise<VoiceWorkResult>
}
