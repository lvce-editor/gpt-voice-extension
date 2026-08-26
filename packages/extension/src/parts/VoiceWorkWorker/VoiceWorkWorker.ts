import type {
  FunctionToolDefinition,
  VoiceWorkConfiguration,
  VoiceWorkResult,
  VoiceWorkToolCallEvent,
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
type ToolCallListener = (event: VoiceWorkToolCallEvent) => Promise<void>

const toolCallListeners = new Map<number, ToolCallListener>()

export const state: {
  createRpc: CreateRpc
  nextWorkId: number
  rpcPromise: Promise<Rpc> | undefined
} = {
  createRpc,
  nextWorkId: 1,
  rpcPromise: undefined,
}

const reportToolCall = async (
  workId: number,
  event: VoiceWorkToolCallEvent,
): Promise<void> => {
  await toolCallListeners.get(workId)?.(event)
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
      'VoiceWorkHost.reportToolCall': reportToolCall,
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
  onToolCall: ToolCallListener,
): Promise<VoiceWorkResult> => {
  const workId = state.nextWorkId++
  toolCallListeners.set(workId, onToolCall)
  try {
    const [rpc, tools] = await Promise.all([
      getRpc(),
      VoiceFunctionCallingWorker.getWorkTools(),
    ])
    return (await rpc.invoke('VoiceWork.execute', {
      configuration,
      task,
      tools,
      workId,
    })) as VoiceWorkResult
  } finally {
    toolCallListeners.delete(workId)
  }
}
