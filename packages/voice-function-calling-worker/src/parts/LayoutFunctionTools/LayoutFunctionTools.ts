import type { FunctionToolDefinition } from '../FunctionToolRegistry/FunctionToolRegistry.ts'
import * as Rpc from '../Rpc/Rpc.ts'

interface FunctionCallArguments {
  readonly argumentsValue: string
  readonly callId: string
  readonly name: LayoutToolName
}

interface LayoutApi {
  readonly closeSideBar: () => Promise<void>
  readonly toggleSideBarPosition: () => Promise<void>
}

const defaultApi: LayoutApi = {
  closeSideBar: () => Rpc.invoke<void>('Layout.closeSideBar'),
  toggleSideBarPosition: () => Rpc.invoke<void>('Layout.toggleSideBarPosition'),
}

const layoutToolNames = ['close_sidebar', 'toggle_sidebar_position'] as const

type LayoutToolName = (typeof layoutToolNames)[number]

export const layoutFunctionTools: readonly FunctionToolDefinition[] = [
  {
    description:
      'Close and hide the LVCE Editor primary sidebar. Use this when the user asks to close, hide, or dismiss the sidebar; do not move it to the other side.',
    name: 'close_sidebar',
    parameters: {
      additionalProperties: false,
      properties: {},
      type: 'object',
    },
    type: 'function',
  },
  {
    description:
      'Move the LVCE Editor primary sidebar to the opposite side of the window. Use this only when the user asks to move, switch, or change the sidebar position; do not use it to close or hide the sidebar.',
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
    !layoutToolNames.includes(item.name as LayoutToolName) ||
    !('arguments' in item) ||
    typeof item.arguments !== 'string'
  ) {
    return undefined
  }
  return {
    argumentsValue: item.arguments,
    callId: item.call_id,
    name: item.name as LayoutToolName,
  }
}

const validateArguments = (name: LayoutToolName, value: string): void => {
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
    throw new TypeError(`The ${name} tool does not accept arguments.`)
  }
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

export const executeLayoutFunctionToolCall = async (
  functionCallEvent: unknown,
  api: LayoutApi = defaultApi,
): Promise<readonly string[] | undefined> => {
  const functionCall = parseFunctionCall(functionCallEvent)
  if (!functionCall) {
    return undefined
  }
  validateArguments(functionCall.name, functionCall.argumentsValue)
  let output: unknown
  if (functionCall.name === 'close_sidebar') {
    await api.closeSideBar()
    output = { closed: true }
  } else {
    await api.toggleSideBarPosition()
    output = { toggled: true }
  }
  return [
    createToolOutputMessage(functionCall.callId, output),
    JSON.stringify({ type: 'response.create' }),
  ]
}
