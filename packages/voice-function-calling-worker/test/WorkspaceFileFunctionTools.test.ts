import { expect, jest, test } from '@jest/globals'
import type { WorkspaceFileSystemApi } from '../src/parts/WorkspaceFileSystem/WorkspaceFileSystem.ts'
import type { WorkspaceMainAreaApi } from '../src/parts/WorkspaceMainArea/WorkspaceMainArea.ts'
import {
  executeWorkspaceFileFunctionToolCall,
  workspaceFileFunctionTools,
} from '../src/parts/WorkspaceFileFunctionTools/WorkspaceFileFunctionTools.ts'

const createFileSystemApi = (
  workspaceUri = 'file:///workspace',
): WorkspaceFileSystemApi => ({
  exists: jest.fn(async () => true),
  getWorkspaceUri: jest.fn(async () => workspaceUri),
  readDirWithFileTypes: jest.fn(async () => [
    { name: 'src', type: 3 },
    { name: 'package.json', type: 7 },
  ]),
  readFile: jest.fn(async () => 'const value = 1'),
  writeFile: jest.fn(async () => undefined),
})

const createMainAreaApi = (): WorkspaceMainAreaApi => ({
  closeUri: jest.fn(async () => undefined),
  getWorkspaceUri: jest.fn(async () => 'file:///workspace'),
  openUri: jest.fn(async () => undefined),
  setQuickPickValue: jest.fn(async () => undefined),
  showFileQuickPick: jest.fn(async () => undefined),
})

const getToolOutput = (messages: readonly string[]): unknown => {
  const message = JSON.parse(messages[0])
  return JSON.parse(message.item.output)
}

test('exposes workspace file tool definitions', () => {
  expect(workspaceFileFunctionTools.map((tool) => tool.name)).toEqual([
    'list_workspace_directory',
    'search_workspace_files',
    'read_workspace_file',
    'write_workspace_file',
    'open_workspace_file',
    'close_workspace_file',
    'show_file_quick_pick',
    'set_quick_pick_value',
  ])
  expect(workspaceFileFunctionTools[0]?.parameters.required).toBeUndefined()
  expect(workspaceFileFunctionTools[1]?.parameters.required).toEqual(['query'])
  expect(workspaceFileFunctionTools[2]?.parameters.required).toEqual(['path'])
  expect(workspaceFileFunctionTools[3]?.parameters.required).toEqual([
    'path',
    'content',
  ])
  expect(workspaceFileFunctionTools[4]?.parameters.required).toEqual(['path'])
  expect(workspaceFileFunctionTools[5]?.parameters.required).toEqual(['path'])
  expect(workspaceFileFunctionTools[6]?.parameters.required).toBeUndefined()
  expect(workspaceFileFunctionTools[7]?.parameters.required).toEqual(['value'])
})

test('sets the open quick pick value', async () => {
  const mainAreaApi = createMainAreaApi()
  const messages = await executeWorkspaceFileFunctionToolCall(
    {
      arguments: '{"value":"ci.yaml"}',
      call_id: 'set-quick-pick-value-call',
      name: 'set_quick_pick_value',
      type: 'response.function_call_arguments.done',
    },
    createFileSystemApi(),
    mainAreaApi,
  )

  expect(mainAreaApi.setQuickPickValue).toHaveBeenCalledWith('ci.yaml')
  expect(getToolOutput(messages || [])).toEqual({
    updated: true,
    value: 'ci.yaml',
  })
})

test('returns quick pick value guidance for invalid arguments', async () => {
  const mainAreaApi = createMainAreaApi()
  const messages = await executeWorkspaceFileFunctionToolCall(
    {
      arguments: '{}',
      call_id: 'set-quick-pick-value-call',
      name: 'set_quick_pick_value',
      type: 'response.function_call_arguments.done',
    },
    createFileSystemApi(),
    mainAreaApi,
  )

  expect(mainAreaApi.setQuickPickValue).not.toHaveBeenCalled()
  expect(getToolOutput(messages || [])).toEqual({
    error: 'Function tool argument "value" must be a string.',
    hint: 'Pass the text to type into the open quick pick, such as {"value":"package.json"}.',
    tool: 'set_quick_pick_value',
  })
})

test('shows the file quick pick', async () => {
  const mainAreaApi = createMainAreaApi()
  const messages = await executeWorkspaceFileFunctionToolCall(
    {
      arguments: '{}',
      call_id: 'show-file-quick-pick-call',
      name: 'show_file_quick_pick',
      type: 'response.function_call_arguments.done',
    },
    createFileSystemApi(),
    mainAreaApi,
  )

  expect(mainAreaApi.showFileQuickPick).toHaveBeenCalledWith()
  expect(getToolOutput(messages || [])).toEqual({ shown: true })
})

test.each([
  ['open_workspace_file', 'openUri'],
  ['close_workspace_file', 'closeUri'],
])('executes the %s tool', async (name, method) => {
  const fileSystemApi = createFileSystemApi()
  const mainAreaApi = createMainAreaApi()
  const messages = await executeWorkspaceFileFunctionToolCall(
    {
      arguments: JSON.stringify({ path: 'src/index.ts' }),
      call_id: `${name}-call`,
      name,
      type: 'response.function_call_arguments.done',
    },
    fileSystemApi,
    mainAreaApi,
  )

  expect(mainAreaApi[method as 'openUri' | 'closeUri']).toHaveBeenCalledWith(
    'file:///workspace/src/index.ts',
  )
  expect(getToolOutput(messages || [])).toEqual(
    name === 'open_workspace_file'
      ? { opened: true, path: 'src/index.ts' }
      : { closed: true, path: 'src/index.ts' },
  )
})

test('returns a tool error without opening a missing workspace file', async () => {
  const fileSystemApi = createFileSystemApi()
  jest.mocked(fileSystemApi.exists).mockResolvedValue(false)
  const mainAreaApi = createMainAreaApi()
  const messages = await executeWorkspaceFileFunctionToolCall(
    {
      arguments: JSON.stringify({ path: 'devcontainer.json' }),
      call_id: 'open-call',
      name: 'open_workspace_file',
      type: 'response.function_call_arguments.done',
    },
    fileSystemApi,
    mainAreaApi,
  )

  expect(mainAreaApi.openUri).not.toHaveBeenCalled()
  expect(getToolOutput(messages || [])).toEqual({
    error: 'Workspace file "devcontainer.json" was not found.',
    hint: 'Pass an exact file path relative to the workspace, such as {"path":"src/index.ts"}. If the path is unknown or was not found, call search_workspace_files with the filename, then retry with a returned path.',
    tool: 'open_workspace_file',
  })
})

test.each(['open_workspace_file', 'close_workspace_file'])(
  'returns relative path guidance for invalid %s calls',
  async (name) => {
    const mainAreaApi = createMainAreaApi()
    const messages = await executeWorkspaceFileFunctionToolCall(
      {
        arguments: '{"path":"../outside.ts"}',
        call_id: `${name}-call`,
        name,
        type: 'response.function_call_arguments.done',
      },
      createFileSystemApi(),
      mainAreaApi,
    )

    expect(mainAreaApi.openUri).not.toHaveBeenCalled()
    expect(mainAreaApi.closeUri).not.toHaveBeenCalled()
    expect(getToolOutput(messages || [])).toEqual({
      error: 'Workspace file path cannot leave the opened workspace.',
      hint:
        name === 'open_workspace_file'
          ? 'Pass an exact file path relative to the workspace, such as {"path":"src/index.ts"}. If the path is unknown or was not found, call search_workspace_files with the filename, then retry with a returned path.'
          : 'Pass a file path relative to the workspace, such as {"path":"src/index.ts"}. Never pass an absolute path or URI.',
      tool: name,
    })
  },
)

test('lists the workspace root by default', async () => {
  const fileSystemApi = createFileSystemApi()
  const messages = await executeWorkspaceFileFunctionToolCall(
    {
      arguments: '{}',
      call_id: 'list-call',
      name: 'list_workspace_directory',
      type: 'response.function_call_arguments.done',
    },
    fileSystemApi,
  )

  expect(fileSystemApi.readDirWithFileTypes).toHaveBeenCalledWith(
    'file:///workspace',
  )
  expect(getToolOutput(messages || [])).toEqual({
    entries: [
      { name: 'package.json', type: 'file' },
      { name: 'src', type: 'directory' },
    ],
    path: '.',
  })
})

test('lists a workspace subdirectory', async () => {
  const fileSystemApi = createFileSystemApi()
  await executeWorkspaceFileFunctionToolCall(
    {
      item: {
        arguments: JSON.stringify({ path: 'src' }),
        call_id: 'list-call',
        name: 'list_workspace_directory',
        type: 'function_call',
      },
      type: 'response.output_item.done',
    },
    fileSystemApi,
  )

  expect(fileSystemApi.readDirWithFileTypes).toHaveBeenCalledWith(
    'file:///workspace/src',
  )
})

test('searches for workspace files in nested directories', async () => {
  const fileSystemApi = createFileSystemApi()
  jest
    .mocked(fileSystemApi.readDirWithFileTypes)
    .mockImplementation(async (uri) => {
      if (uri === 'file:///workspace') {
        return [{ name: '.devcontainer', type: 3 }]
      }
      return [{ name: 'devcontainer.json', type: 7 }]
    })
  const messages = await executeWorkspaceFileFunctionToolCall(
    {
      arguments: JSON.stringify({ query: 'devcontainer json' }),
      call_id: 'search-call',
      name: 'search_workspace_files',
      type: 'response.function_call_arguments.done',
    },
    fileSystemApi,
  )

  expect(getToolOutput(messages || [])).toEqual({
    matches: ['.devcontainer/devcontainer.json'],
    query: 'devcontainer json',
    truncated: false,
  })
})

test('returns recovery guidance when no workspace files match', async () => {
  const fileSystemApi = createFileSystemApi()
  jest.mocked(fileSystemApi.readDirWithFileTypes).mockResolvedValue([])
  const messages = await executeWorkspaceFileFunctionToolCall(
    {
      arguments: JSON.stringify({ query: 'styles.css' }),
      call_id: 'search-call',
      name: 'search_workspace_files',
      type: 'response.function_call_arguments.done',
    },
    fileSystemApi,
  )

  expect(getToolOutput(messages || [])).toEqual({
    hint: 'No files matched. Double-check whether the filename was heard or read correctly, then search again with a likely correction or a shorter distinctive part of the filename before giving up.',
    matches: [],
    query: 'styles.css',
    truncated: false,
  })
})

test('reads a workspace file', async () => {
  const fileSystemApi = createFileSystemApi()
  const messages = await executeWorkspaceFileFunctionToolCall(
    {
      arguments: JSON.stringify({ path: 'src/index.ts' }),
      call_id: 'read-call',
      name: 'read_workspace_file',
      type: 'response.function_call_arguments.done',
    },
    fileSystemApi,
  )

  expect(messages).toHaveLength(2)
  expect(fileSystemApi.readFile).toHaveBeenCalledWith(
    'file:///workspace/src/index.ts',
  )
  expect(getToolOutput(messages || [])).toEqual({
    content: 'const value = 1',
    path: 'src/index.ts',
  })
})

test('writes a workspace file from an output item event', async () => {
  const fileSystemApi = createFileSystemApi()
  const messages = await executeWorkspaceFileFunctionToolCall(
    {
      item: {
        arguments: JSON.stringify({
          content: 'const value = 2',
          path: 'src/index.ts',
        }),
        call_id: 'write-call',
        name: 'write_workspace_file',
        type: 'function_call',
      },
      type: 'response.output_item.done',
    },
    fileSystemApi,
  )

  expect(fileSystemApi.writeFile).toHaveBeenCalledWith(
    'file:///workspace/src/index.ts',
    'const value = 2',
  )
  expect(getToolOutput(messages || [])).toEqual({
    path: 'src/index.ts',
    written: true,
  })
})

test.each([
  [
    '{"path":"../outside.txt"}',
    'Workspace file path cannot leave the opened workspace.',
  ],
  ['{}', 'Function tool argument "path" must be a string.'],
  ['[]', 'Function tool arguments must be a JSON object.'],
  ['{', 'Function tool arguments must be valid JSON.'],
])('returns tool errors to the model for %s', async (argumentsValue, error) => {
  const fileSystemApi = createFileSystemApi()
  const messages = await executeWorkspaceFileFunctionToolCall(
    {
      arguments: argumentsValue,
      call_id: 'read-call',
      name: 'read_workspace_file',
      type: 'response.function_call_arguments.done',
    },
    fileSystemApi,
  )

  expect(fileSystemApi.readFile).not.toHaveBeenCalled()
  expect(getToolOutput(messages || [])).toEqual({
    error,
    hint: 'Pass a file path relative to the workspace, such as {"path":"src/index.ts"}. Never pass an absolute path or URI.',
    tool: 'read_workspace_file',
  })
})

test('returns invalid directory path errors to the model', async () => {
  const fileSystemApi = createFileSystemApi()
  const messages = await executeWorkspaceFileFunctionToolCall(
    {
      arguments: JSON.stringify({ path: '../outside' }),
      call_id: 'list-call',
      name: 'list_workspace_directory',
      type: 'response.function_call_arguments.done',
    },
    fileSystemApi,
  )

  expect(fileSystemApi.readDirWithFileTypes).not.toHaveBeenCalled()
  expect(getToolOutput(messages || [])).toEqual({
    error: 'Workspace directory path cannot leave the opened workspace.',
    hint: 'To list the workspace root, call list_workspace_directory with no arguments: {}. To list a subdirectory, pass only a relative path such as {"path":"src"}. Never pass an absolute path or URI.',
    tool: 'list_workspace_directory',
  })
})

test('returns invalid directory argument errors to the model', async () => {
  const fileSystemApi = createFileSystemApi()
  const messages = await executeWorkspaceFileFunctionToolCall(
    {
      arguments: JSON.stringify({ path: 1 }),
      call_id: 'list-call',
      name: 'list_workspace_directory',
      type: 'response.function_call_arguments.done',
    },
    fileSystemApi,
  )

  expect(getToolOutput(messages || [])).toEqual({
    error: 'Function tool argument "path" must be a string.',
    hint: 'To list the workspace root, call list_workspace_directory with no arguments: {}. To list a subdirectory, pass only a relative path such as {"path":"src"}. Never pass an absolute path or URI.',
    tool: 'list_workspace_directory',
  })
})

test('returns filesystem failures with actionable listing guidance', async () => {
  const fileSystemApi = createFileSystemApi()
  jest
    .mocked(fileSystemApi.readDirWithFileTypes)
    .mockRejectedValue(new TypeError('URI must be valid'))
  const messages = await executeWorkspaceFileFunctionToolCall(
    {
      arguments: '{}',
      call_id: 'list-call',
      name: 'list_workspace_directory',
      type: 'response.function_call_arguments.done',
    },
    fileSystemApi,
  )

  expect(getToolOutput(messages || [])).toEqual({
    error: 'Failed to list workspace directory ".": URI must be valid',
    hint: 'To list the workspace root, call list_workspace_directory with no arguments: {}. To list a subdirectory, pass only a relative path such as {"path":"src"}. Never pass an absolute path or URI.',
    tool: 'list_workspace_directory',
  })
})

test.each([
  undefined,
  null,
  {},
  {
    arguments: '{}',
    call_id: 'call',
    name: 'getweather',
    type: 'response.function_call_arguments.done',
  },
  {
    arguments: 1,
    call_id: 'call',
    name: 'read_workspace_file',
    type: 'response.function_call_arguments.done',
  },
  { item: {}, type: 'response.output_item.done' },
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
])('ignores non-workspace function call %#', async (event) => {
  await expect(
    executeWorkspaceFileFunctionToolCall(event),
  ).resolves.toBeUndefined()
})
