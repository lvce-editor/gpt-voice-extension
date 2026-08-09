import { expect, jest, test } from '@jest/globals'
import {
  executeLayoutFunctionToolCall,
  layoutFunctionTools,
} from '../src/parts/LayoutFunctionTools/LayoutFunctionTools.ts'

interface TestApi {
  readonly toggleSideBarPosition: () => Promise<void>
}

const createApi = (): TestApi => ({
  toggleSideBarPosition: jest.fn<() => Promise<void>>(async () => undefined),
})

test('defines the toggle sidebar position tool', () => {
  expect(layoutFunctionTools).toEqual([
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
  ])
})

test('toggles the sidebar position and returns response messages', async () => {
  const api = createApi()

  const messages = await executeLayoutFunctionToolCall(
    {
      arguments: '{}',
      call_id: 'layout-call',
      name: 'toggle_sidebar_position',
      type: 'response.function_call_arguments.done',
    },
    api,
  )

  expect(api.toggleSideBarPosition).toHaveBeenCalledWith()
  expect(messages).toEqual([
    JSON.stringify({
      item: {
        call_id: 'layout-call',
        output: JSON.stringify({ toggled: true }),
        type: 'function_call_output',
      },
      type: 'conversation.item.create',
    }),
    JSON.stringify({ type: 'response.create' }),
  ])
})

test('supports completed output items', async () => {
  const api = createApi()

  await executeLayoutFunctionToolCall(
    {
      item: {
        arguments: '{}',
        call_id: 'layout-call',
        name: 'toggle_sidebar_position',
        type: 'function_call',
      },
      type: 'response.output_item.done',
    },
    api,
  )

  expect(api.toggleSideBarPosition).toHaveBeenCalledWith()
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
    await expect(executeLayoutFunctionToolCall(event)).resolves.toBeUndefined()
  },
)

test.each([
  ['{', 'Function tool arguments must be valid JSON.'],
  ['[]', 'Function tool arguments must be a JSON object.'],
  [
    '{"unexpected":true}',
    'The toggle_sidebar_position tool does not accept arguments.',
  ],
])('rejects invalid arguments: %s', async (argumentsValue, message) => {
  await expect(
    executeLayoutFunctionToolCall({
      arguments: argumentsValue,
      call_id: 'layout-call',
      name: 'toggle_sidebar_position',
      type: 'response.function_call_arguments.done',
    }),
  ).rejects.toThrow(message)
})
