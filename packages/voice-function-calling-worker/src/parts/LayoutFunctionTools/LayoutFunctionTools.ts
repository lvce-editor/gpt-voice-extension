import type { FunctionToolDefinition } from '../FunctionToolRegistry/FunctionToolRegistry.ts'
import * as Rpc from '../Rpc/Rpc.ts'

interface FunctionCallArguments {
  readonly argumentsValue: string
  readonly callId: string
  readonly name: LayoutToolName
  readonly view: SideBarView | undefined
}

interface LayoutApi {
  readonly closeSideBar: () => Promise<void>
  readonly openSideBarView: (view: SideBarView) => Promise<void>
  readonly toggleSideBarPosition: () => Promise<void>
}

const sideBarViews = {
  Explorer: 'Explorer',
  Extensions: 'Extensions',
  'Run And Debug': 'Run And Debug',
  Search: 'Search',
  'Source Control': 'Source Control',
} as const

type SideBarView = keyof typeof sideBarViews

const defaultApi: LayoutApi = {
  closeSideBar: () => Rpc.invoke<void>('Layout.closeSideBar'),
  openSideBarView: (view) => Rpc.invoke<void>('Layout.openSideBarView', view),
  toggleSideBarPosition: () => Rpc.invoke<void>('Layout.toggleSideBarPosition'),
}

const layoutToolNames = [
  'close_sidebar',
  'open_sidebar_view',
  'toggle_sidebar_position',
] as const

type LayoutToolName = (typeof layoutToolNames)[number]

export const layoutFunctionTools: readonly FunctionToolDefinition[] = [
  {
    description:
      'Open and select a view in the LVCE Editor primary sidebar. Use this for the file Explorer sidebar or another listed sidebar view; this is different from Process Explorer and the file quick pick. The sidebar is shown if hidden and switches to the requested view if another view is open.',
    name: 'open_sidebar_view',
    parameters: {
      additionalProperties: false,
      properties: {
        view: {
          description: 'The primary sidebar view to show.',
          enum: Object.keys(sideBarViews),
          type: 'string',
        },
      },
      required: ['view'],
      type: 'object',
    },
    type: 'function',
  },
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
  let view: SideBarView | undefined
  if (item.name === 'open_sidebar_view') {
    try {
      const argumentsValue: unknown = JSON.parse(item.arguments)
      if (
        argumentsValue &&
        typeof argumentsValue === 'object' &&
        !Array.isArray(argumentsValue) &&
        'view' in argumentsValue &&
        typeof argumentsValue.view === 'string' &&
        Object.hasOwn(sideBarViews, argumentsValue.view)
      ) {
        view = argumentsValue.view as SideBarView
      }
    } catch {
      // Argument validation reports malformed JSON with a useful tool error.
    }
  }
  return {
    argumentsValue: item.arguments,
    callId: item.call_id,
    name: item.name as LayoutToolName,
    view,
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
  if (name === 'open_sidebar_view') {
    if (
      !('view' in parsed) ||
      typeof parsed.view !== 'string' ||
      !Object.hasOwn(sideBarViews, parsed.view)
    ) {
      throw new TypeError(
        `The open_sidebar_view tool requires a supported view: ${Object.keys(sideBarViews).join(', ')}.`,
      )
    }
    if (Object.keys(parsed).length !== 1) {
      throw new TypeError(
        'The open_sidebar_view tool only accepts the view argument.',
      )
    }
    return
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
  } else if (functionCall.name === 'toggle_sidebar_position') {
    await api.toggleSideBarPosition()
    output = { toggled: true }
  } else {
    await api.openSideBarView(functionCall.view!)
    output = { opened: true, view: functionCall.view }
  }
  return [
    createToolOutputMessage(functionCall.callId, output),
    JSON.stringify({ type: 'response.create' }),
  ]
}
