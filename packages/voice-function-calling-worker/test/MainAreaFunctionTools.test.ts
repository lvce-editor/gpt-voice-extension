import { expect, jest, test } from '@jest/globals'
import {
  closeAllEditors,
  executeMainAreaFunctionToolCall,
  getOpenEditorTabs,
  mainAreaFunctionTools,
  type MainAreaApi,
} from '../src/parts/MainAreaFunctionTools/MainAreaFunctionTools.ts'

const createApi = (): MainAreaApi => ({
  closeAllEditors: jest.fn(async () => undefined),
  focusNextTab: jest.fn(async () => undefined),
  focusPreviousTab: jest.fn(async () => undefined),
  getOpenEditorUris: jest.fn(async () => [
    'file:///workspace/src/index.ts',
    'settings://',
    'file:///workspace/src/hello%20world.ts',
  ]),
  getWorkspaceUri: jest.fn(async () => 'file:///workspace'),
})

const getToolOutput = (messages: readonly string[]): unknown => {
  const message = JSON.parse(messages[0] || '{}')
  return JSON.parse(message.item.output)
}

test('defines main area tools without arguments', () => {
  expect(mainAreaFunctionTools.map(({ name }) => name)).toEqual([
    'focus_next_tab',
    'focus_previous_tab',
    'get_open_editor_tabs',
    'close_all_editors',
  ])
  for (const tool of mainAreaFunctionTools) {
    expect(tool).toEqual(
      expect.objectContaining({
        parameters: {
          additionalProperties: false,
          properties: {},
          type: 'object',
        },
        type: 'function',
      }),
    )
  }
})

test.each([
  ['focus_next_tab', 'focusNextTab'],
  ['focus_previous_tab', 'focusPreviousTab'],
] as const)('executes %s', async (name, apiMethod) => {
  const api = createApi()
  const messages = await executeMainAreaFunctionToolCall(
    {
      arguments: '{}',
      call_id: 'focus-call',
      name,
      type: 'response.function_call_arguments.done',
    },
    api,
  )

  expect(api[apiMethod]).toHaveBeenCalledWith()
  expect(getToolOutput(messages || [])).toEqual({ focused: true })
})

test('returns tabs in visual group and tab order', async () => {
  const api = createApi()

  await expect(getOpenEditorTabs(api)).resolves.toEqual({
    count: 3,
    tabs: [
      {
        path: 'src/index.ts',
        title: 'index.ts',
        uri: 'file:///workspace/src/index.ts',
      },
      {
        title: 'settings',
        uri: 'settings://',
      },
      {
        path: 'src/hello world.ts',
        title: 'hello world.ts',
        uri: 'file:///workspace/src/hello%20world.ts',
      },
    ],
  })
})

test('returns non-file editors when no workspace is open', async () => {
  const api = createApi()
  jest.mocked(api.getOpenEditorUris).mockResolvedValue(['settings://'])
  jest.mocked(api.getWorkspaceUri).mockResolvedValue(null)

  await expect(getOpenEditorTabs(api)).resolves.toEqual({
    count: 1,
    tabs: [{ title: 'settings', uri: 'settings://' }],
  })
})

test('executes completed open editor tab queries', async () => {
  const messages = await executeMainAreaFunctionToolCall(
    {
      arguments: '{}',
      call_id: 'tabs-call',
      name: 'get_open_editor_tabs',
      type: 'response.function_call_arguments.done',
    },
    createApi(),
  )

  expect(getToolOutput(messages || [])).toEqual(
    expect.objectContaining({ count: 3 }),
  )
})

test('supports completed output items', async () => {
  const api = createApi()
  await executeMainAreaFunctionToolCall(
    {
      item: {
        arguments: '{}',
        call_id: 'tabs-call',
        name: 'get_open_editor_tabs',
        type: 'function_call',
      },
      type: 'response.output_item.done',
    },
    api,
  )

  expect(api.getOpenEditorUris).toHaveBeenCalledWith()
})

test('returns query failures to the model', async () => {
  const api = createApi()
  jest
    .mocked(api.getOpenEditorUris)
    .mockRejectedValue(new Error('Main area is unavailable'))
  const messages = await executeMainAreaFunctionToolCall(
    {
      arguments: '{}',
      call_id: 'tabs-call',
      name: 'get_open_editor_tabs',
      type: 'response.function_call_arguments.done',
    },
    api,
  )

  expect(getToolOutput(messages || [])).toEqual({
    error: 'Main area is unavailable',
    hint: 'Call get_open_editor_tabs with no arguments: {}.',
    tool: 'get_open_editor_tabs',
  })
})

test('returns focus failures to the model', async () => {
  const api = createApi()
  jest.mocked(api.focusNextTab).mockRejectedValue(new Error('No editor tabs'))
  const messages = await executeMainAreaFunctionToolCall(
    {
      arguments: '{}',
      call_id: 'focus-call',
      name: 'focus_next_tab',
      type: 'response.function_call_arguments.done',
    },
    api,
  )

  expect(getToolOutput(messages || [])).toEqual({
    error: 'No editor tabs',
    hint: 'Call focus_next_tab with no arguments: {}.',
    tool: 'focus_next_tab',
  })
})

test('closes all open editors and returns the closed count', async () => {
  const api = createApi()

  await expect(closeAllEditors(api)).resolves.toEqual({ closed: 3 })

  expect(api.getOpenEditorUris).toHaveBeenCalledWith()
  expect(api.closeAllEditors).toHaveBeenCalledWith()
})

test('executes close all editor calls', async () => {
  const api = createApi()
  const messages = await executeMainAreaFunctionToolCall(
    {
      arguments: '{}',
      call_id: 'close-call',
      name: 'close_all_editors',
      type: 'response.function_call_arguments.done',
    },
    api,
  )

  expect(getToolOutput(messages || [])).toEqual({ closed: 3 })
  expect(api.closeAllEditors).toHaveBeenCalledWith()
})

test.each([
  ['{', 'Function tool arguments must be valid JSON.'],
  ['[]', 'Function tool arguments must be a JSON object.'],
  [
    '{"unexpected":true}',
    'The get_open_editor_tabs tool does not accept arguments.',
  ],
])('returns invalid argument errors: %s', async (argumentsValue, error) => {
  const messages = await executeMainAreaFunctionToolCall(
    {
      arguments: argumentsValue,
      call_id: 'tabs-call',
      name: 'get_open_editor_tabs',
      type: 'response.function_call_arguments.done',
    },
    createApi(),
  )

  expect(getToolOutput(messages || [])).toEqual({
    error,
    hint: 'Call get_open_editor_tabs with no arguments: {}.',
    tool: 'get_open_editor_tabs',
  })
})

test('ignores unrelated function calls', async () => {
  await expect(
    executeMainAreaFunctionToolCall({
      arguments: '{}',
      call_id: 'other-call',
      name: 'open_settings',
      type: 'response.function_call_arguments.done',
    }),
  ).resolves.toBeUndefined()
})
