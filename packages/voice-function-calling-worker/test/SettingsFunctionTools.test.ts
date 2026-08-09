import { expect, jest, test } from '@jest/globals'
import {
  executeSettingsFunctionToolCall,
  settingsFunctionTools,
} from '../src/parts/SettingsFunctionTools/SettingsFunctionTools.ts'

interface TestApi {
  readonly openSettings: () => Promise<void>
}

const createApi = (): TestApi => ({
  openSettings: jest.fn<() => Promise<void>>(async () => undefined),
})

test('defines the open settings tool', () => {
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
