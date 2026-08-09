import { expect, jest, test } from '@jest/globals'
import {
  executeMainAreaFunctionToolCall,
  getOpenEditorTabs,
  mainAreaFunctionTools,
  type MainAreaApi,
} from '../src/parts/MainAreaFunctionTools/MainAreaFunctionTools.ts'

const createApi = (): MainAreaApi => ({
  getSavedState: jest.fn(async () => ({
    layout: {
      activeGroupId: 2,
      groups: [
        {
          activeTabId: 11,
          id: 1,
          tabs: [
            {
              editorType: 'text',
              id: 11,
              isDirty: false,
              isPreview: true,
              title: 'index.ts',
              uri: 'file:///workspace/src/index.ts',
            },
          ],
        },
        {
          activeTabId: 21,
          id: 2,
          tabs: [
            {
              editorType: 'custom',
              id: 21,
              isDirty: false,
              isPreview: false,
              title: 'Settings',
              uri: 'settings://',
            },
            {
              editorType: 'text',
              id: 22,
              isDirty: true,
              isPreview: false,
              title: 'hello world.ts',
              uri: 'file:///workspace/src/hello%20world.ts',
            },
          ],
        },
      ],
    },
  })),
  getWorkspaceUri: jest.fn(async () => 'file:///workspace'),
})

const getToolOutput = (messages: readonly string[]): unknown => {
  const message = JSON.parse(messages[0] || '{}')
  return JSON.parse(message.item.output)
}

test('defines the open editor tabs query tool', () => {
  expect(mainAreaFunctionTools).toEqual([
    expect.objectContaining({
      name: 'get_open_editor_tabs',
      parameters: {
        additionalProperties: false,
        properties: {},
        type: 'object',
      },
      type: 'function',
    }),
  ])
})

test('returns tabs in visual group and tab order', async () => {
  const api = createApi()

  await expect(getOpenEditorTabs(api)).resolves.toEqual({
    count: 3,
    tabs: [
      {
        active: false,
        dirty: false,
        editorType: 'text',
        group: 1,
        path: 'src/index.ts',
        preview: true,
        selected: true,
        title: 'index.ts',
        uri: 'file:///workspace/src/index.ts',
      },
      {
        active: true,
        dirty: false,
        editorType: 'custom',
        group: 2,
        preview: false,
        selected: true,
        title: 'Settings',
        uri: 'settings://',
      },
      {
        active: false,
        dirty: true,
        editorType: 'text',
        group: 2,
        path: 'src/hello world.ts',
        preview: false,
        selected: false,
        title: 'hello world.ts',
        uri: 'file:///workspace/src/hello%20world.ts',
      },
    ],
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

  expect(api.getSavedState).toHaveBeenCalledWith()
})

test('returns query failures to the model', async () => {
  const api = createApi()
  jest
    .mocked(api.getSavedState)
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
