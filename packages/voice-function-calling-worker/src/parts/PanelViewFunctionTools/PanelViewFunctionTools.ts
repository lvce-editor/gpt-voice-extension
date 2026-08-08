import type { FunctionToolDefinition } from '../FunctionToolRegistry/FunctionToolRegistry.ts'
import * as Rpc from '../Rpc/Rpc.ts'

interface FunctionCallArguments {
  readonly argumentsValue: string
  readonly callId: string
  readonly name: PanelViewToolName
}

interface PanelViewApi {
  readonly openDebugConsole: (options: {
    readonly input?: string
  }) => Promise<void>
  readonly openOutputView: (options: {
    readonly channel?: string
  }) => Promise<void>
  readonly openProblemsView: (options: {
    readonly filter?: string
  }) => Promise<void>
}

const defaultApi: PanelViewApi = {
  openDebugConsole: (options) =>
    Rpc.invoke<void>('PanelView.openDebugConsole', options),
  openOutputView: (options) =>
    Rpc.invoke<void>('PanelView.openOutputView', options),
  openProblemsView: (options) =>
    Rpc.invoke<void>('PanelView.openProblemsView', options),
}

const outputChannelIds: Readonly<Record<string, string>> = {
  'main-process': 'MainProcess',
  'shared-process': 'SharedProcess',
  window: 'Window',
}

const panelViewToolNames = [
  'open_debug_console',
  'open_output_view',
  'open_problems_view',
] as const
type PanelViewToolName = (typeof panelViewToolNames)[number]

export const panelViewFunctionTools: readonly FunctionToolDefinition[] = [
  {
    description:
      'Open the LVCE Editor Problems view, optionally with an initial text filter.',
    name: 'open_problems_view',
    parameters: {
      additionalProperties: false,
      properties: {
        filter: {
          description:
            'Initial Problems view filter. Omit to preserve the current filter.',
          type: 'string',
        },
      },
      type: 'object',
    },
    type: 'function',
  },
  {
    description:
      'Open the LVCE Editor Output view, optionally selecting an output channel.',
    name: 'open_output_view',
    parameters: {
      additionalProperties: false,
      properties: {
        channel: {
          description:
            'Output channel to select: "main-process", "shared-process", "window", or an exact extension output channel id. Omit to preserve the current channel.',
          type: 'string',
        },
      },
      type: 'object',
    },
    type: 'function',
  },
  {
    description:
      'Open the LVCE Editor Debug Console, optionally with initial input text.',
    name: 'open_debug_console',
    parameters: {
      additionalProperties: false,
      properties: {
        input: {
          description:
            'Initial Debug Console input. Omit to preserve the current input.',
          type: 'string',
        },
      },
      type: 'object',
    },
    type: 'function',
  },
]

const isPanelViewToolName = (value: unknown): value is PanelViewToolName => {
  return (
    typeof value === 'string' &&
    panelViewToolNames.includes(value as PanelViewToolName)
  )
}

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
    !isPanelViewToolName(item.name) ||
    !('arguments' in item) ||
    typeof item.arguments !== 'string'
  ) {
    return undefined
  }
  return {
    argumentsValue: item.arguments,
    callId: item.call_id,
    name: item.name,
  }
}

const parseArguments = (value: string): Readonly<Record<string, unknown>> => {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new TypeError('Function tool arguments must be valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Function tool arguments must be a JSON object.')
  }
  return parsed as Readonly<Record<string, unknown>>
}

const getOptionalString = (
  argumentsValue: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined => {
  const value = argumentsValue[key]
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string') {
    throw new TypeError(`Function tool argument "${key}" must be a string.`)
  }
  return value
}

const execute = async (
  name: PanelViewToolName,
  argumentsValue: Readonly<Record<string, unknown>>,
  api: PanelViewApi,
): Promise<Readonly<Record<string, unknown>>> => {
  if (name === 'open_problems_view') {
    const filter = getOptionalString(argumentsValue, 'filter')
    await api.openProblemsView(filter === undefined ? {} : { filter })
    return filter === undefined ? { opened: true } : { filter, opened: true }
  }
  if (name === 'open_output_view') {
    const channel = getOptionalString(argumentsValue, 'channel')
    const channelId =
      channel === undefined ? undefined : outputChannelIds[channel] || channel
    await api.openOutputView(
      channelId === undefined ? {} : { channel: channelId },
    )
    return channel === undefined ? { opened: true } : { channel, opened: true }
  }
  const input = getOptionalString(argumentsValue, 'input')
  await api.openDebugConsole(input === undefined ? {} : { input })
  return input === undefined ? { opened: true } : { input, opened: true }
}

const createToolOutputMessage = (callId: string, output: string): string => {
  return JSON.stringify({
    item: {
      call_id: callId,
      output,
      type: 'function_call_output',
    },
    type: 'conversation.item.create',
  })
}

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error)
}

export const executePanelViewFunctionToolCall = async (
  functionCallEvent: unknown,
  api: PanelViewApi = defaultApi,
): Promise<readonly string[] | undefined> => {
  const functionCall = parseFunctionCall(functionCallEvent)
  if (!functionCall) {
    return undefined
  }
  let output: unknown
  try {
    output = await execute(
      functionCall.name,
      parseArguments(functionCall.argumentsValue),
      api,
    )
  } catch (error) {
    output = {
      error: getErrorMessage(error),
      hint: 'Pass an object with an optional string option supported by this panel view tool.',
      tool: functionCall.name,
    }
  }
  return [
    createToolOutputMessage(functionCall.callId, JSON.stringify(output)),
    JSON.stringify({ type: 'response.create' }),
  ]
}
