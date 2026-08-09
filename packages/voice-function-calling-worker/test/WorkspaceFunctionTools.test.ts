import { expect, jest, test } from '@jest/globals'
import {
  executeWorkspaceFunctionToolCall,
  workspaceFunctionTools,
} from '../src/parts/WorkspaceFunctionTools/WorkspaceFunctionTools.ts'

const getToolOutput = (messages: readonly string[]): unknown => {
  const message = JSON.parse(messages[0] || '{}')
  return JSON.parse(message.item.output)
}

test('exposes the open workspace folder tool definition', () => {
  expect(workspaceFunctionTools).toEqual([
    expect.objectContaining({
      name: 'get_recently_opened_folders',
      parameters: expect.objectContaining({ properties: {} }),
      type: 'function',
    }),
    expect.objectContaining({
      name: 'get_workspace_folder_uri',
      parameters: expect.objectContaining({ properties: {} }),
      type: 'function',
    }),
    expect.objectContaining({
      name: 'open_workspace_folder',
      parameters: expect.objectContaining({ required: ['uri'] }),
      type: 'function',
    }),
  ])
})

const openWorkspaceCases: ReadonlyArray<readonly [unknown, string]> = [
  [
    {
      arguments: '{"uri":"file:///home/user/project"}',
      call_id: 'open-call',
      name: 'open_workspace_folder',
      type: 'response.function_call_arguments.done',
    },
    'file:///home/user/project',
  ],
  [
    {
      item: {
        arguments: '{"uri":"remote-ssh://host/project"}',
        call_id: 'open-call',
        name: 'open_workspace_folder',
        type: 'function_call',
      },
      type: 'response.output_item.done',
    },
    'remote-ssh://host/project',
  ],
]

test.each(openWorkspaceCases)(
  'opens a workspace folder for supported function call event %#',
  async (event, expectedUri) => {
    const setWorkspaceUri = jest.fn<(uri: string) => Promise<void>>(
      async () => undefined,
    )
    const messages = await executeWorkspaceFunctionToolCall(event, {
      getRecentlyOpenedWorkspaceUris: jest.fn(async () => []),
      getWorkspaceUri: jest.fn(async () => 'file:///workspace'),
      setWorkspaceUri,
    })

    expect(setWorkspaceUri).toHaveBeenCalledWith(expectedUri)
    expect(getToolOutput(messages || [])).toEqual({
      opened: true,
      uri: expectedUri,
    })
  },
)

test.each([
  ['{}', 'Function tool argument "uri" must be a string.'],
  [
    '{"uri":"/home/user/project"}',
    'Function tool argument "uri" must be a full workspace URI.',
  ],
  ['[]', 'Function tool arguments must be a JSON object.'],
  ['{', 'Function tool arguments must be valid JSON.'],
])('returns tool errors to the model for %s', async (argumentsValue, error) => {
  const setWorkspaceUri = jest.fn<(uri: string) => Promise<void>>(
    async () => undefined,
  )
  const messages = await executeWorkspaceFunctionToolCall(
    {
      arguments: argumentsValue,
      call_id: 'open-call',
      name: 'open_workspace_folder',
      type: 'response.function_call_arguments.done',
    },
    {
      getRecentlyOpenedWorkspaceUris: jest.fn(async () => []),
      getWorkspaceUri: jest.fn(async () => 'file:///workspace'),
      setWorkspaceUri,
    },
  )

  expect(setWorkspaceUri).not.toHaveBeenCalled()
  expect(getToolOutput(messages || [])).toEqual({
    error,
    hint: 'Pass a full workspace folder URI, such as {"uri":"file:///home/user/project"}.',
    tool: 'open_workspace_folder',
  })
})

test('returns workspace API failures to the model', async () => {
  const messages = await executeWorkspaceFunctionToolCall(
    {
      arguments: '{"uri":"file:///home/user/project"}',
      call_id: 'open-call',
      name: 'open_workspace_folder',
      type: 'response.function_call_arguments.done',
    },
    {
      getRecentlyOpenedWorkspaceUris: jest.fn(async () => []),
      getWorkspaceUri: jest.fn(async () => 'file:///workspace'),
      setWorkspaceUri: jest.fn(async () => {
        throw new Error('Workspace unavailable')
      }),
    },
  )

  expect(getToolOutput(messages || [])).toEqual({
    error: 'Workspace unavailable',
    hint: 'Pass a full workspace folder URI, such as {"uri":"file:///home/user/project"}.',
    tool: 'open_workspace_folder',
  })
})

const nonWorkspaceFunctionCalls: readonly unknown[] = [
  undefined,
  null,
  {},
  {
    arguments: '{}',
    call_id: 'call',
    name: 'read_workspace_file',
    type: 'response.function_call_arguments.done',
  },
  { item: {}, type: 'response.output_item.done' },
]

test.each(nonWorkspaceFunctionCalls)(
  'ignores non-workspace function call %#',
  async (event) => {
    await expect(
      executeWorkspaceFunctionToolCall(event),
    ).resolves.toBeUndefined()
  },
)

test('returns the current workspace folder URI', async () => {
  const getWorkspaceUri = jest.fn(async () => 'file:///home/user/project')
  const messages = await executeWorkspaceFunctionToolCall(
    {
      arguments: '{}',
      call_id: 'get-workspace-call',
      name: 'get_workspace_folder_uri',
      type: 'response.function_call_arguments.done',
    },
    {
      getRecentlyOpenedWorkspaceUris: jest.fn(async () => []),
      getWorkspaceUri,
      setWorkspaceUri: jest.fn(async () => undefined),
    },
  )

  expect(getWorkspaceUri).toHaveBeenCalledWith()
  expect(getToolOutput(messages || [])).toEqual({
    uri: 'file:///home/user/project',
  })
})

test.each([
  [
    '{"unexpected":true}',
    'The get_workspace_folder_uri tool does not accept arguments.',
  ],
  ['[]', 'Function tool arguments must be a JSON object.'],
  ['{', 'Function tool arguments must be valid JSON.'],
])(
  'returns workspace URI query errors to the model for %s',
  async (argumentsValue, error) => {
    const getWorkspaceUri = jest.fn(async () => 'file:///workspace')
    const messages = await executeWorkspaceFunctionToolCall(
      {
        arguments: argumentsValue,
        call_id: 'get-workspace-call',
        name: 'get_workspace_folder_uri',
        type: 'response.function_call_arguments.done',
      },
      {
        getRecentlyOpenedWorkspaceUris: jest.fn(async () => []),
        getWorkspaceUri,
        setWorkspaceUri: jest.fn(async () => undefined),
      },
    )

    expect(getWorkspaceUri).not.toHaveBeenCalled()
    expect(getToolOutput(messages || [])).toEqual({
      error,
      hint: 'Call get_workspace_folder_uri with no arguments: {}.',
      tool: 'get_workspace_folder_uri',
    })
  },
)

test('reports when no workspace folder is open', async () => {
  const messages = await executeWorkspaceFunctionToolCall(
    {
      arguments: '{}',
      call_id: 'get-workspace-call',
      name: 'get_workspace_folder_uri',
      type: 'response.function_call_arguments.done',
    },
    {
      getRecentlyOpenedWorkspaceUris: jest.fn(async () => []),
      getWorkspaceUri: jest.fn(async () => ''),
      setWorkspaceUri: jest.fn(async () => undefined),
    },
  )

  expect(getToolOutput(messages || [])).toEqual({
    error: 'No workspace folder is open.',
    hint: 'Call get_workspace_folder_uri with no arguments: {}.',
    tool: 'get_workspace_folder_uri',
  })
})

test('returns recently opened workspace folders with friendly names', async () => {
  const getRecentlyOpenedWorkspaceUris = jest.fn(async () => [
    'file:///home/user/about-view',
    'remote-ssh://host/projects/my%20project/',
  ])
  const messages = await executeWorkspaceFunctionToolCall(
    {
      arguments: '{}',
      call_id: 'recent-call',
      name: 'get_recently_opened_folders',
      type: 'response.function_call_arguments.done',
    },
    {
      getRecentlyOpenedWorkspaceUris,
      getWorkspaceUri: jest.fn(async () => ''),
      setWorkspaceUri: jest.fn(async () => undefined),
    },
  )

  expect(getRecentlyOpenedWorkspaceUris).toHaveBeenCalledWith()
  expect(getToolOutput(messages || [])).toEqual({
    folders: [
      { name: 'about-view', uri: 'file:///home/user/about-view' },
      {
        name: 'my project',
        uri: 'remote-ssh://host/projects/my%20project/',
      },
    ],
  })
})

test('returns recent workspace query errors to the model', async () => {
  const getRecentlyOpenedWorkspaceUris = jest.fn(async () => {
    throw new Error('Recent workspaces unavailable')
  })
  const messages = await executeWorkspaceFunctionToolCall(
    {
      arguments: '{}',
      call_id: 'recent-call',
      name: 'get_recently_opened_folders',
      type: 'response.function_call_arguments.done',
    },
    {
      getRecentlyOpenedWorkspaceUris,
      getWorkspaceUri: jest.fn(async () => ''),
      setWorkspaceUri: jest.fn(async () => undefined),
    },
  )

  expect(getToolOutput(messages || [])).toEqual({
    error: 'Recent workspaces unavailable',
    hint: 'Call get_recently_opened_folders with no arguments: {}.',
    tool: 'get_recently_opened_folders',
  })
})
