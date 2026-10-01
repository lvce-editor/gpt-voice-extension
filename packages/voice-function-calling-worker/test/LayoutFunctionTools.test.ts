import { expect, jest, test } from '@jest/globals'
import {
  executeLayoutFunctionToolCall,
  layoutFunctionTools,
} from '../src/parts/LayoutFunctionTools/LayoutFunctionTools.ts'

interface TestApi {
  readonly closeSideBar: () => Promise<void>
  readonly openSideBarView: (view: string) => Promise<void>
  readonly toggleSideBarPosition: () => Promise<void>
}

const createApi = (): TestApi => ({
  closeSideBar: jest.fn<() => Promise<void>>(async () => undefined),
  openSideBarView: jest.fn<(view: string) => Promise<void>>(
    async () => undefined,
  ),
  toggleSideBarPosition: jest.fn<() => Promise<void>>(async () => undefined),
})

test('defines sidebar layout tools with distinct descriptions', () => {
  expect(layoutFunctionTools).toEqual([
    {
      description: expect.stringContaining('different from Process Explorer'),
      name: 'open_sidebar_view',
      parameters: {
        additionalProperties: false,
        properties: {
          view: {
            description: 'The primary sidebar view to show.',
            enum: [
              'Explorer',
              'Extensions',
              'Run And Debug',
              'Search',
              'Source Control',
            ],
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
  ])
})

test.each([
  'Explorer',
  'Search',
  'Source Control',
  'Run And Debug',
  'Extensions',
])('opens and selects the %s sidebar view', async (view) => {
  const api = createApi()

  const messages = await executeLayoutFunctionToolCall(
    {
      arguments: JSON.stringify({ view }),
      call_id: 'layout-call',
      name: 'open_sidebar_view',
      type: 'response.function_call_arguments.done',
    },
    api,
  )

  expect(api.openSideBarView).toHaveBeenCalledWith(view)
  expect(api.closeSideBar).not.toHaveBeenCalled()
  expect(api.toggleSideBarPosition).not.toHaveBeenCalled()
  expect(messages).toEqual([
    JSON.stringify({
      item: {
        call_id: 'layout-call',
        output: JSON.stringify({ opened: true, view }),
        type: 'function_call_output',
      },
      type: 'conversation.item.create',
    }),
    JSON.stringify({ type: 'response.create' }),
  ])
})

test('closes the sidebar and returns response messages', async () => {
  const api = createApi()

  const messages = await executeLayoutFunctionToolCall(
    {
      arguments: '{}',
      call_id: 'layout-call',
      name: 'close_sidebar',
      type: 'response.function_call_arguments.done',
    },
    api,
  )

  expect(api.closeSideBar).toHaveBeenCalledWith()
  expect(api.toggleSideBarPosition).not.toHaveBeenCalled()
  expect(messages).toEqual([
    JSON.stringify({
      item: {
        call_id: 'layout-call',
        output: JSON.stringify({ closed: true }),
        type: 'function_call_output',
      },
      type: 'conversation.item.create',
    }),
    JSON.stringify({ type: 'response.create' }),
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

  expect(api.closeSideBar).not.toHaveBeenCalled()
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

test.each([
  ['close_sidebar', 1, 0],
  ['toggle_sidebar_position', 0, 1],
] as const)(
  'supports completed output items for %s',
  async (name, closeCallCount, toggleCallCount) => {
    const api = createApi()

    await executeLayoutFunctionToolCall(
      {
        item: {
          arguments: '{}',
          call_id: 'layout-call',
          name,
          type: 'function_call',
        },
        type: 'response.output_item.done',
      },
      api,
    )

    expect(api.closeSideBar).toHaveBeenCalledTimes(closeCallCount)
    expect(api.toggleSideBarPosition).toHaveBeenCalledTimes(toggleCallCount)
  },
)

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
  ['close_sidebar', '{', 'Function tool arguments must be valid JSON.'],
  ['close_sidebar', '[]', 'Function tool arguments must be a JSON object.'],
  [
    'close_sidebar',
    '{"unexpected":true}',
    'The close_sidebar tool does not accept arguments.',
  ],
  [
    'toggle_sidebar_position',
    '{"unexpected":true}',
    'The toggle_sidebar_position tool does not accept arguments.',
  ],
  [
    'open_sidebar_view',
    '{}',
    'The open_sidebar_view tool requires a supported view: Explorer, Extensions, Run And Debug, Search, Source Control.',
  ],
  [
    'open_sidebar_view',
    '{"view":"ProcessExplorer"}',
    'The open_sidebar_view tool requires a supported view: Explorer, Extensions, Run And Debug, Search, Source Control.',
  ],
  [
    'open_sidebar_view',
    '{"view":"Explorer","extra":true}',
    'The open_sidebar_view tool only accepts the view argument.',
  ],
] as const)(
  'rejects invalid arguments for %s: %s',
  async (name, argumentsValue, message) => {
    await expect(
      executeLayoutFunctionToolCall({
        arguments: argumentsValue,
        call_id: 'layout-call',
        name,
        type: 'response.function_call_arguments.done',
      }),
    ).rejects.toThrow(message)
  },
)
