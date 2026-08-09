import type { FunctionToolDefinition } from '../FunctionToolRegistry/FunctionToolRegistry.ts'
import * as Rpc from '../Rpc/Rpc.ts'

interface ProcessExplorerApi {
  readonly openProcessExplorer: () => Promise<void>
}

const defaultApi: ProcessExplorerApi = {
  openProcessExplorer: () => Rpc.invoke<void>('ProcessExplorer.open'),
}

export const processExplorerFunctionTools: readonly FunctionToolDefinition[] = [
  {
    description: 'Open the LVCE Editor process explorer.',
    name: 'open_process_explorer',
    parameters: {
      additionalProperties: false,
      properties: {},
      type: 'object',
    },
    type: 'function',
  },
]

interface FunctionCallArguments {
  readonly callId: string
}

const parseFunctionCall = (
  event: unknown,
): FunctionCallArguments | undefined => {
  if (!event || typeof event !== 'object') {
    return undefined
  }
  const item =
    'type' in event &&
    event.type === 'response.output_item.done' &&
    'item' in event
      ? event.item
      : event
  if (
    !item ||
    typeof item !== 'object' ||
    !('type' in item) ||
    (item.type !== 'response.function_call_arguments.done' &&
      item.type !== 'function_call') ||
    !('call_id' in item) ||
    typeof item.call_id !== 'string' ||
    !('name' in item) ||
    item.name !== 'open_process_explorer' ||
    !('arguments' in item) ||
    typeof item.arguments !== 'string'
  ) {
    return undefined
  }
  return { callId: item.call_id }
}

const createToolOutputMessage = (callId: string, output: unknown): string => {
  return JSON.stringify({
    item: {
      call_id: callId,
      output: JSON.stringify(output),
      type: 'function_call_output',
    },
    type: 'conversation.item.create',
  })
}

export const executeProcessExplorerFunctionToolCall = async (
  event: unknown,
  api: ProcessExplorerApi = defaultApi,
): Promise<readonly string[] | undefined> => {
  const functionCall = parseFunctionCall(event)
  if (!functionCall) {
    return undefined
  }
  let output: unknown
  try {
    await api.openProcessExplorer()
    output = { opened: true }
  } catch (error) {
    output = {
      error: error instanceof Error ? error.message : String(error),
      hint: 'Try opening the process explorer again.',
      tool: 'open_process_explorer',
    }
  }
  return [
    createToolOutputMessage(functionCall.callId, output),
    JSON.stringify({ type: 'response.create' }),
  ]
}
