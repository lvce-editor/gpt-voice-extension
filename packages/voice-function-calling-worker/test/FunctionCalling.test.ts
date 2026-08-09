import { expect, jest, test } from '@jest/globals'
import { executeFunctionToolCall } from '../src/parts/FunctionCalling/FunctionCalling.ts'

test('executes completed function call arguments and creates response messages', async () => {
  const result = await executeFunctionToolCall({
    arguments: '{"location":"Paris"}',
    call_id: 'call-1',
    name: 'getweather',
    type: 'response.function_call_arguments.done',
  })

  expect(result).toHaveLength(2)
  const outputMessage = JSON.parse(result[0] || '{}')
  expect(outputMessage).toEqual({
    item: {
      call_id: 'call-1',
      output: expect.any(String),
      type: 'function_call_output',
    },
    type: 'conversation.item.create',
  })
  expect(JSON.parse(outputMessage.item.output)).toEqual({
    conditions: 'Sunny',
    humidity: 58,
    location: 'paris',
    temperature: 20,
    unit: 'C',
  })
  expect(result[1]).toBe(JSON.stringify({ type: 'response.create' }))
})

test('executes completed function call output items', async () => {
  const result = await executeFunctionToolCall({
    item: {
      arguments: '{"location":"London"}',
      call_id: 'call-2',
      name: 'getweather',
      type: 'function_call',
    },
    type: 'response.output_item.done',
  })

  expect(result).toHaveLength(2)
  expect(result[0]).toContain('call-2')
  expect(result[0]).toContain('london')
})

test('executes stop talking function calls', async () => {
  const result = await executeFunctionToolCall({
    arguments: '{}',
    call_id: 'stop-call',
    name: 'stop_talking',
    type: 'response.function_call_arguments.done',
  })

  expect(result).toEqual([
    JSON.stringify({
      item: {
        call_id: 'stop-call',
        output: JSON.stringify({ stopped: true }),
        type: 'function_call_output',
      },
      type: 'conversation.item.create',
    }),
    JSON.stringify({ type: 'response.create' }),
  ])
})

test('executes active editor function calls in the worker', async () => {
  const invoke = jest
    .fn<(method: string) => Promise<unknown>>()
    .mockResolvedValue(undefined)
  const globalScope = globalThis as typeof globalThis & {
    rpc: { readonly invoke: typeof invoke }
  }
  globalScope.rpc = { invoke }

  const result = await executeFunctionToolCall({
    arguments: '{}',
    call_id: 'format-call',
    name: 'format_document',
    type: 'response.function_call_arguments.done',
  })

  expect(invoke).toHaveBeenCalledWith('Editor.formatDocument')
  expect(result[0]).toContain('\\"formatted\\":true')
})

test('waits silently after background noise', async () => {
  const result = await executeFunctionToolCall({
    arguments: '{}',
    call_id: 'wait-call',
    name: 'wait_for_user',
    type: 'response.function_call_arguments.done',
  })

  expect(result).toEqual([
    JSON.stringify({
      item: {
        call_id: 'wait-call',
        output: JSON.stringify({ waiting: true }),
        type: 'function_call_output',
      },
      type: 'conversation.item.create',
    }),
  ])
})

test('executes workspace file function calls in the worker', async () => {
  const invoke = jest
    .fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()
    .mockResolvedValueOnce('file:///workspace')
    .mockResolvedValueOnce('const value = 1')
  const globalScope = globalThis as typeof globalThis & {
    rpc: { readonly invoke: typeof invoke }
  }
  globalScope.rpc = { invoke }

  const result = await executeFunctionToolCall({
    arguments: '{"path":"src/index.ts"}',
    call_id: 'read-call',
    name: 'read_workspace_file',
    type: 'response.function_call_arguments.done',
  })

  expect(invoke).toHaveBeenNthCalledWith(
    1,
    'WorkspaceFileSystem.getWorkspaceUri',
  )
  expect(invoke).toHaveBeenNthCalledWith(
    2,
    'WorkspaceFileSystem.readFile',
    'file:///workspace/src/index.ts',
  )
  expect(result[0]).toContain('const value = 1')
})

test('executes open editor tab queries in the worker', async () => {
  const invoke = jest.fn(async (method: string): Promise<unknown> => {
    if (method === 'MainArea.getSavedState') {
      return {
        layout: {
          activeGroupId: 1,
          groups: [
            {
              activeTabId: 2,
              id: 1,
              tabs: [
                {
                  editorType: 'text',
                  id: 2,
                  isDirty: false,
                  isPreview: false,
                  title: 'index.ts',
                  uri: 'file:///workspace/src/index.ts',
                },
              ],
            },
          ],
        },
      }
    }
    if (method === 'WorkspaceMainArea.getWorkspaceUri') {
      return 'file:///workspace'
    }
    return undefined
  })
  const globalScope = globalThis as typeof globalThis & {
    rpc: { readonly invoke: typeof invoke }
  }
  globalScope.rpc = { invoke }

  const result = await executeFunctionToolCall({
    arguments: '{}',
    call_id: 'tabs-call',
    name: 'get_open_editor_tabs',
    type: 'response.function_call_arguments.done',
  })

  expect(invoke).toHaveBeenCalledWith('MainArea.getSavedState')
  expect(invoke).toHaveBeenCalledWith('WorkspaceMainArea.getWorkspaceUri')
  const outputMessage = JSON.parse(result[0] || '{}')
  expect(JSON.parse(outputMessage.item.output)).toEqual({
    count: 1,
    tabs: [
      {
        active: true,
        dirty: false,
        editorType: 'text',
        group: 1,
        path: 'src/index.ts',
        preview: false,
        selected: true,
        title: 'index.ts',
        uri: 'file:///workspace/src/index.ts',
      },
    ],
  })
})

test.each([
  ['focus_next_tab', 'MainArea.focusNextTab'],
  ['focus_previous_tab', 'MainArea.focusPreviousTab'],
])('executes %s calls in the worker', async (name, method) => {
  const invoke = jest
    .fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()
    .mockResolvedValue(undefined)
  const globalScope = globalThis as typeof globalThis & {
    rpc: { readonly invoke: typeof invoke }
  }
  globalScope.rpc = { invoke }

  const result = await executeFunctionToolCall({
    arguments: '{}',
    call_id: 'focus-call',
    name,
    type: 'response.function_call_arguments.done',
  })

  expect(invoke).toHaveBeenCalledWith(method)
  const outputMessage = JSON.parse(result[0] || '{}')
  expect(JSON.parse(outputMessage.item.output)).toEqual({ focused: true })
})

test('executes workspace directory listing calls in the worker', async () => {
  const invoke = jest
    .fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()
    .mockResolvedValueOnce('file:///workspace')
    .mockResolvedValueOnce([{ name: 'package.json', type: 7 }])
  const globalScope = globalThis as typeof globalThis & {
    rpc: { readonly invoke: typeof invoke }
  }
  globalScope.rpc = { invoke }

  const result = await executeFunctionToolCall({
    arguments: '{}',
    call_id: 'list-call',
    name: 'list_workspace_directory',
    type: 'response.function_call_arguments.done',
  })

  expect(invoke).toHaveBeenNthCalledWith(
    1,
    'WorkspaceFileSystem.getWorkspaceUri',
  )
  expect(invoke).toHaveBeenNthCalledWith(
    2,
    'WorkspaceFileSystem.readDirWithFileTypes',
    'file:///workspace',
  )
  expect(result[0]).toContain('package.json')
})

test('executes open workspace folder calls in the worker', async () => {
  const invoke = jest
    .fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()
    .mockResolvedValue(undefined)
  const globalScope = globalThis as typeof globalThis & {
    rpc: { readonly invoke: typeof invoke }
  }
  globalScope.rpc = { invoke }

  const result = await executeFunctionToolCall({
    arguments: '{"uri":"file:///home/user/project"}',
    call_id: 'open-workspace-call',
    name: 'open_workspace_folder',
    type: 'response.function_call_arguments.done',
  })

  expect(invoke).toHaveBeenCalledWith(
    'Workspace.setWorkspaceUri',
    'file:///home/user/project',
  )
  expect(result[0]).toContain('file:///home/user/project')
})

test('queries the current workspace folder URI in the worker', async () => {
  const invoke = jest
    .fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()
    .mockResolvedValue('file:///workspace')
  const globalScope = globalThis as typeof globalThis & {
    rpc: { readonly invoke: typeof invoke }
  }
  globalScope.rpc = { invoke }

  const result = await executeFunctionToolCall({
    arguments: '{}',
    call_id: 'get-workspace-call',
    name: 'get_workspace_folder_uri',
    type: 'response.function_call_arguments.done',
  })

  expect(invoke).toHaveBeenCalledWith('WorkspaceFileSystem.getWorkspaceUri')
  expect(result[0]).toContain('file:///workspace')
})

test('executes panel calls in the worker', async () => {
  const invoke = jest
    .fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()
    .mockResolvedValue(undefined)
  const globalScope = globalThis as typeof globalThis & {
    rpc: { readonly invoke: typeof invoke }
  }
  globalScope.rpc = { invoke }

  const result = await executeFunctionToolCall({
    arguments: '{"action":"open","view":"terminal"}',
    call_id: 'panel-call',
    name: 'set_panel',
    type: 'response.function_call_arguments.done',
  })

  expect(invoke).toHaveBeenCalledWith('Panel.open', 'Terminals')
  expect(result[0]).toContain('terminal')
})

test('executes sidebar position calls in the worker', async () => {
  const invoke = jest
    .fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()
    .mockResolvedValue(undefined)
  const globalScope = globalThis as typeof globalThis & {
    rpc: { readonly invoke: typeof invoke }
  }
  globalScope.rpc = { invoke }

  const result = await executeFunctionToolCall({
    arguments: '{}',
    call_id: 'layout-call',
    name: 'toggle_sidebar_position',
    type: 'response.function_call_arguments.done',
  })

  expect(invoke).toHaveBeenCalledWith('Layout.toggleSideBarPosition')
  const outputMessage = JSON.parse(result[0] || '{}')
  expect(JSON.parse(outputMessage.item.output)).toEqual({ toggled: true })
})

test('executes process explorer calls in the worker', async () => {
  const invoke = jest
    .fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()
    .mockResolvedValue(undefined)
  const globalScope = globalThis as typeof globalThis & {
    rpc: { readonly invoke: typeof invoke }
  }
  globalScope.rpc = { invoke }

  const result = await executeFunctionToolCall({
    arguments: '{}',
    call_id: 'process-explorer-call',
    name: 'open_process_explorer',
    type: 'response.function_call_arguments.done',
  })

  expect(invoke).toHaveBeenCalledWith('ProcessExplorer.open')
  const outputMessage = JSON.parse(result[0] || '{}')
  expect(JSON.parse(outputMessage.item.output)).toEqual({ opened: true })
})

test('executes open settings calls in the worker', async () => {
  const invoke = jest
    .fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()
    .mockResolvedValue(undefined)
  const globalScope = globalThis as typeof globalThis & {
    rpc: { readonly invoke: typeof invoke }
  }
  globalScope.rpc = { invoke }

  const result = await executeFunctionToolCall({
    arguments: '{}',
    call_id: 'settings-call',
    name: 'open_settings',
    type: 'response.function_call_arguments.done',
  })

  expect(invoke).toHaveBeenCalledWith('Settings.openSettings')
  const outputMessage = JSON.parse(result[0] || '{}')
  expect(JSON.parse(outputMessage.item.output)).toEqual({ opened: true })
})

test.each([
  ['open_workspace_file', 'WorkspaceMainArea.openUri', 'opened'],
  ['close_workspace_file', 'WorkspaceMainArea.closeUri', 'closed'],
])('executes %s calls in the worker', async (name, method, resultProperty) => {
  const invoke =
    jest.fn<
      (method: string, ...params: readonly unknown[]) => Promise<unknown>
    >()
  invoke.mockResolvedValueOnce('file:///workspace')
  if (name === 'open_workspace_file') {
    invoke.mockResolvedValueOnce(true)
  }
  invoke.mockResolvedValueOnce(undefined)
  const globalScope = globalThis as typeof globalThis & {
    rpc: { readonly invoke: typeof invoke }
  }
  globalScope.rpc = { invoke }

  const result = await executeFunctionToolCall({
    arguments: '{"path":"src/index.ts"}',
    call_id: `${name}-call`,
    name,
    type: 'response.function_call_arguments.done',
  })

  const expectedCalls =
    name === 'open_workspace_file'
      ? [
          ['WorkspaceMainArea.getWorkspaceUri'],
          ['WorkspaceFileSystem.exists', 'file:///workspace/src/index.ts'],
          [method, 'file:///workspace/src/index.ts'],
        ]
      : [
          ['WorkspaceMainArea.getWorkspaceUri'],
          [method, 'file:///workspace/src/index.ts'],
        ]
  expect(invoke.mock.calls).toEqual(expectedCalls)
  expect(result[0]).toContain(`\\"${resultProperty}\\":true`)
})

test('executes workspace file search calls in the worker', async () => {
  const invoke = jest
    .fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()
    .mockResolvedValueOnce('file:///workspace')
    .mockResolvedValueOnce([{ name: '.devcontainer', type: 3 }])
    .mockResolvedValueOnce([{ name: 'devcontainer.json', type: 7 }])
  const globalScope = globalThis as typeof globalThis & {
    rpc: { readonly invoke: typeof invoke }
  }
  globalScope.rpc = { invoke }

  const result = await executeFunctionToolCall({
    arguments: '{"query":"devcontainer json"}',
    call_id: 'search-call',
    name: 'search_workspace_files',
    type: 'response.function_call_arguments.done',
  })

  expect(invoke).toHaveBeenNthCalledWith(
    3,
    'WorkspaceFileSystem.readDirWithFileTypes',
    'file:///workspace/.devcontainer',
  )
  expect(result[0]).toContain('.devcontainer/devcontainer.json')
})

test('executes show file quick pick calls in the worker', async () => {
  const invoke = jest
    .fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()
    .mockResolvedValue(undefined)
  const globalScope = globalThis as typeof globalThis & {
    rpc: { readonly invoke: typeof invoke }
  }
  globalScope.rpc = { invoke }

  const result = await executeFunctionToolCall({
    arguments: '{}',
    call_id: 'show-file-quick-pick-call',
    name: 'show_file_quick_pick',
    type: 'response.function_call_arguments.done',
  })

  expect(invoke).toHaveBeenCalledWith('WorkspaceMainArea.showFileQuickPick')
  expect(result[0]).toContain('\\"shown\\":true')
})

test('executes set quick pick value calls in the worker', async () => {
  const invoke = jest
    .fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()
    .mockResolvedValue(undefined)
  const globalScope = globalThis as typeof globalThis & {
    rpc: { readonly invoke: typeof invoke }
  }
  globalScope.rpc = { invoke }

  const result = await executeFunctionToolCall({
    arguments: '{"value":"ci.yaml"}',
    call_id: 'set-quick-pick-value-call',
    name: 'set_quick_pick_value',
    type: 'response.function_call_arguments.done',
  })

  expect(invoke).toHaveBeenCalledWith(
    'WorkspaceMainArea.setQuickPickValue',
    'ci.yaml',
  )
  expect(result[0]).toContain('\\"updated\\":true')
  expect(result[0]).toContain('ci.yaml')
})

test.each([
  undefined,
  null,
  'value',
  {},
  { type: 'response.function_call_arguments.done' },
  { item: {}, type: 'response.output_item.done' },
])(
  'ignores events without a completed function call',
  async (event: unknown) => {
    await expect(executeFunctionToolCall(event)).resolves.toEqual([])
  },
)

test('rejects calls for unknown tools', async () => {
  await expect(
    executeFunctionToolCall({
      arguments: '{}',
      call_id: 'call-3',
      name: 'unknown',
      type: 'response.function_call_arguments.done',
    }),
  ).rejects.toThrow('Unknown function tool: unknown')
})
