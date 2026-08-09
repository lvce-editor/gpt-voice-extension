import type { FunctionToolDefinition } from '../FunctionToolRegistry/FunctionToolRegistry.ts'
import * as Rpc from '../Rpc/Rpc.ts'

interface FunctionCallArguments {
  readonly argumentsValue: string
  readonly callId: string
}

interface LayoutApi {
  readonly toggleSideBarPosition: () => Promise<void>
}

const defaultApi: LayoutApi = {
  toggleSideBarPosition: () => Rpc.invoke<void>('Layout.toggleSideBarPosition'),
}

export const layoutFunctionTools: readonly FunctionToolDefinition[] = [
  {
    description:
      'Toggle the LVCE Editor primary sidebar between the left and right sides of the window.',
    name: 'toggle_sidebar_position',
    parameters: {
      additionalProperties: false,
      properties: {},
      type: 'object',
    },
    type: 'function',
  },
]

const parseFunctionCall = (
  parsed: unknown,
): FunctionCallArguments | undefined => {
  if (!parsed || typeof parsed !== 'object') {
    return undefined
  }
  let item: unknown
  if (
    'type' in parsed &&
    parsed.type === 'response.function_call_arguments.done'
  ) {
    item = parsed
  } else if (
    'type' in parsed &&
    parsed.type === 'response.output_item.done' &&
    'item' in parsed
  ) {
    const { item: outputItem } = parsed
    item = outputItem
  } else {
    return undefined
  }
  if (
    !item ||
    typeof item !== 'object' ||
    ('type' in item && item !== parsed && item.type !== 'function_call') ||
    !('call_id' in item) ||
    typeof item.call_id !== 'string' ||
    !('name' in item) ||
    item.name !== 'toggle_sidebar_position' ||
    !('arguments' in item) ||
    typeof item.arguments !== 'string'
  ) {
    return undefined
  }
  return {
    argumentsValue: item.arguments,
    callId: item.call_id,
  }
}

const validateArguments = (value: string): void => {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new TypeError('Function tool arguments must be valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Function tool arguments must be a JSON object.')
  }
  if (Object.keys(parsed).length > 0) {
    throw new TypeError(
      'The toggle_sidebar_position tool does not accept arguments.',
    )
  }
}

const createToolOutputMessage = (callId: string): string => {
  return JSON.stringify({
    item: {
      call_id: callId,
      output: JSON.stringify({ toggled: true }),
      type: 'function_call_output',
    },
    type: 'conversation.item.create',
  })
}

export const executeLayoutFunctionToolCall = async (
  functionCallEvent: unknown,
  api: LayoutApi = defaultApi,
): Promise<readonly string[] | undefined> => {
  const functionCall = parseFunctionCall(functionCallEvent)
  if (!functionCall) {
    return undefined
  }
  validateArguments(functionCall.argumentsValue)
  await api.toggleSideBarPosition()
  return [
    createToolOutputMessage(functionCall.callId),
    JSON.stringify({ type: 'response.create' }),
  ]
}
