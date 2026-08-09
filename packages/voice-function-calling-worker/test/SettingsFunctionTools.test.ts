import { expect, jest, test } from '@jest/globals'
import {
  executeSettingsFunctionToolCall,
  settingsFunctionTools,
} from '../src/parts/SettingsFunctionTools/SettingsFunctionTools.ts'

interface TestApi {
  readonly openSettings: () => Promise<void>
  readonly setSettingsSearchValue: (value: string) => Promise<void>
}

const createApi = (): TestApi => ({
  openSettings: jest.fn<() => Promise<void>>(async () => undefined),
  setSettingsSearchValue: jest.fn<(value: string) => Promise<void>>(
    async () => undefined,
  ),
})

test('defines the settings tools', () => {
  expect(settingsFunctionTools).toEqual([
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
  ])
})

test('opens settings and returns response messages', async () => {
  const api = createApi()

  const messages = await executeSettingsFunctionToolCall(
    {
      arguments: '{}',
      call_id: 'settings-call',
      name: 'open_settings',
      type: 'response.function_call_arguments.done',
    },
    api,
  )

  expect(api.openSettings).toHaveBeenCalledWith()
  expect(messages).toEqual([
    JSON.stringify({
      item: {
        call_id: 'settings-call',
        output: JSON.stringify({ opened: true }),
        type: 'function_call_output',
      },
      type: 'conversation.item.create',
    }),
    JSON.stringify({ type: 'response.create' }),
  ])
})

test('sets the settings search value and returns response messages', async () => {
  const api = createApi()

  const messages = await executeSettingsFunctionToolCall(
    {
      arguments: '{"value":"font size"}',
      call_id: 'settings-search-call',
      name: 'set_settings_search_value',
      type: 'response.function_call_arguments.done',
    },
    api,
  )

  expect(api.setSettingsSearchValue).toHaveBeenCalledWith('font size')
  expect(messages).toEqual([
    JSON.stringify({
      item: {
        call_id: 'settings-search-call',
        output: JSON.stringify({ updated: true, value: 'font size' }),
        type: 'function_call_output',
      },
      type: 'conversation.item.create',
    }),
    JSON.stringify({ type: 'response.create' }),
  ])
})

test('supports completed output items', async () => {
  const api = createApi()

  await executeSettingsFunctionToolCall(
    {
      item: {
        arguments: '{}',
        call_id: 'settings-call',
        name: 'open_settings',
        type: 'function_call',
      },
      type: 'response.output_item.done',
    },
    api,
  )

  expect(api.openSettings).toHaveBeenCalledWith()
})

test.each([
  undefined,
  null,
  {},
  {
    arguments: '{}',
    call_id: 'call',
    name: 'other',
    type: 'response.function_call_arguments.done',
  },
] as const)(
  'ignores unrelated events',
  async (event: Readonly<Record<string, unknown>> | null | undefined) => {
    await expect(
      executeSettingsFunctionToolCall(event),
    ).resolves.toBeUndefined()
  },
)

test.each([
  ['{', 'Function tool arguments must be valid JSON.'],
  ['[]', 'Function tool arguments must be a JSON object.'],
  ['{"unexpected":true}', 'The open_settings tool does not accept arguments.'],
])('rejects invalid arguments: %s', async (argumentsValue, message) => {
  await expect(
    executeSettingsFunctionToolCall({
      arguments: argumentsValue,
      call_id: 'settings-call',
      name: 'open_settings',
      type: 'response.function_call_arguments.done',
    }),
  ).rejects.toThrow(message)
})

test.each(['{}', '{"value":1}', '{"value":"font","extra":true}'])(
  'rejects invalid search value arguments: %s',
  async (argumentsValue) => {
    await expect(
      executeSettingsFunctionToolCall({
        arguments: argumentsValue,
        call_id: 'settings-search-call',
        name: 'set_settings_search_value',
        type: 'response.function_call_arguments.done',
      }),
    ).rejects.toThrow(
      'The set_settings_search_value tool requires only a string value.',
    )
  },
)
