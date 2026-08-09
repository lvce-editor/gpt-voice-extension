import type { FunctionToolDefinition } from '../FunctionToolRegistry/FunctionToolRegistry.ts'
import * as Rpc from '../Rpc/Rpc.ts'

interface FunctionCallArguments {
  readonly argumentsValue: string
  readonly callId: string
  readonly name: 'open_settings' | 'set_settings_search_value'
}

interface SettingsApi {
  readonly openSettings: () => Promise<void>
  readonly setSettingsSearchValue: (value: string) => Promise<void>
}

const defaultApi: SettingsApi = {
  openSettings: () => Rpc.invoke<void>('Settings.openSettings'),
  setSettingsSearchValue: (value) =>
    Rpc.invoke<void>('Settings.setSearchValue', value),
}

export const settingsFunctionTools: readonly FunctionToolDefinition[] = [
  {
    description:
      'Open the LVCE Editor settings UI when the user asks to open or show settings.',
    name: 'open_settings',
    parameters: {
      additionalProperties: false,
      properties: {},
      type: 'object',
    },
    type: 'function',
  },
  {
    description:
      'Set the search input in the open LVCE Editor settings UI so the user does not need to type the query.',
    name: 'set_settings_search_value',
    parameters: {
      additionalProperties: false,
      properties: {
        value: {
          description: 'Exact settings search query to enter',
          type: 'string',
        },
      },
      required: ['value'],
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
    (item.name !== 'open_settings' && item.name !== 'set_settings_search_value')
  ) {
    return undefined
  }
  if (!('arguments' in item) || typeof item.arguments !== 'string') {
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

const validateOpenSettingsArguments = (
  parsed: Readonly<Record<string, unknown>>,
): void => {
  if (Object.keys(parsed).length > 0) {
    throw new TypeError('The open_settings tool does not accept arguments.')
  }
}

const getSearchValue = (parsed: Readonly<Record<string, unknown>>): string => {
  if (Object.keys(parsed).length !== 1 || typeof parsed.value !== 'string') {
    throw new TypeError(
      'The set_settings_search_value tool requires only a string value.',
    )
  }
  return parsed.value
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

export const executeSettingsFunctionToolCall = async (
  functionCallEvent: unknown,
  api: SettingsApi = defaultApi,
): Promise<readonly string[] | undefined> => {
  const functionCall = parseFunctionCall(functionCallEvent)
  if (!functionCall) {
    return undefined
  }
  const argumentsValue = parseArguments(functionCall.argumentsValue)
  let output: unknown
  if (functionCall.name === 'open_settings') {
    validateOpenSettingsArguments(argumentsValue)
    await api.openSettings()
    output = { opened: true }
  } else {
    const value = getSearchValue(argumentsValue)
    await api.setSettingsSearchValue(value)
    output = { updated: true, value }
  }
  return [
    createToolOutputMessage(functionCall.callId, output),
    JSON.stringify({ type: 'response.create' }),
  ]
}
