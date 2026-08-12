import { expect, jest, test } from '@jest/globals'
import {
  executeExplorerFunctionToolCall,
  explorerFunctionTools,
} from '../src/parts/ExplorerFunctionTools/ExplorerFunctionTools.ts'

const getToolOutput = (messages: readonly string[]): unknown => {
  const message = JSON.parse(messages[0] || '{}')
  return JSON.parse(message.item.output)
}

type VoidApiMock = ReturnType<typeof jest.fn<() => Promise<void>>>

interface TestApi {
  readonly collapseFocusedFolder: VoidApiMock
  readonly exists: ReturnType<typeof jest.fn<(uri: string) => Promise<boolean>>>
  readonly expandFocusedFolder: VoidApiMock
  readonly getWorkspaceUri: ReturnType<typeof jest.fn<() => Promise<string>>>
  readonly open: VoidApiMock
  readonly openFocusedContextMenu: VoidApiMock
  readonly revealItem: ReturnType<
    typeof jest.fn<(uri: string) => Promise<void>>
  >
  readonly startRename: VoidApiMock
}

const createApi = (): TestApi => ({
  collapseFocusedFolder: jest.fn(async () => undefined),
  exists: jest.fn<(uri: string) => Promise<boolean>>(async () => true),
  expandFocusedFolder: jest.fn(async () => undefined),
  getWorkspaceUri: jest.fn(async () => 'file:///workspace'),
  open: jest.fn(async () => undefined),
  openFocusedContextMenu: jest.fn(async () => undefined),
  revealItem: jest.fn<(uri: string) => Promise<void>>(async () => undefined),
  startRename: jest.fn(async () => undefined),
})

const createEvent = (
  name: string,
  argumentsValue: string,
): Readonly<Record<string, string>> => ({
  arguments: argumentsValue,
  call_id: 'explorer-call',
  name,
  type: 'response.function_call_arguments.done',
})

test('exposes Explorer tool definitions with unambiguous open semantics', () => {
  expect(explorerFunctionTools.map((tool) => tool.name)).toEqual([
    'expand_explorer_folder',
    'collapse_explorer_folder',
    'start_explorer_rename',
    'open_explorer_context_menu',
  ])
  expect(explorerFunctionTools[0]?.description).toContain(
    'does not open a file in the editor or change the workspace folder',
  )
})

test.each([
  ['expand_explorer_folder', 'expandFocusedFolder', { expanded: true }],
  ['collapse_explorer_folder', 'collapseFocusedFolder', { collapsed: true }],
] as const)(
  '%s reveals the requested folder before and after the state change',
  async (toolName, apiMethod, expectedOutput) => {
    const api = createApi()
    const messages = await executeExplorerFunctionToolCall(
      createEvent(toolName, '{"path":"scripts"}'),
      api,
    )

    expect(api.open).toHaveBeenCalledTimes(2)
    expect(api.getWorkspaceUri).toHaveBeenCalledTimes(2)
    expect(api.exists).toHaveBeenCalledTimes(2)
    expect(api.exists).toHaveBeenCalledWith('file:///workspace/scripts')
    expect(api.revealItem).toHaveBeenCalledTimes(2)
    expect(api.revealItem).toHaveBeenCalledWith('file:///workspace/scripts')
    expect(api[apiMethod]).toHaveBeenCalledWith()
    expect(getToolOutput(messages || [])).toEqual({
      ...expectedOutput,
      path: 'scripts',
    })
    expect(messages?.[1]).toBe(JSON.stringify({ type: 'response.create' }))
  },
)

test.each([
  ['start_explorer_rename', 'startRename', { renaming: true }],
  ['open_explorer_context_menu', 'openFocusedContextMenu', { opened: true }],
] as const)(
  '%s optionally reveals a requested Explorer item',
  async (toolName, apiMethod, expectedOutput) => {
    const api = createApi()
    const messages = await executeExplorerFunctionToolCall(
      createEvent(toolName, '{"path":"src/index.ts"}'),
      api,
    )

    expect(api.open).toHaveBeenCalledWith()
    expect(api.exists).toHaveBeenCalledWith('file:///workspace/src/index.ts')
    expect(api.revealItem).toHaveBeenCalledWith(
      'file:///workspace/src/index.ts',
    )
    expect(api[apiMethod]).toHaveBeenCalledWith()
    expect(getToolOutput(messages || [])).toEqual({
      ...expectedOutput,
      path: 'src/index.ts',
    })
  },
)

test.each([
  ['start_explorer_rename', 'startRename', { renaming: true }],
  ['open_explorer_context_menu', 'openFocusedContextMenu', { opened: true }],
] as const)(
  '%s uses the focused item when no path is provided',
  async (toolName, apiMethod, expectedOutput) => {
    const api = createApi()
    const messages = await executeExplorerFunctionToolCall(
      createEvent(toolName, '{}'),
      api,
    )

    expect(api.open).toHaveBeenCalledWith()
    expect(api.getWorkspaceUri).not.toHaveBeenCalled()
    expect(api.exists).not.toHaveBeenCalled()
    expect(api.revealItem).not.toHaveBeenCalled()
    expect(api[apiMethod]).toHaveBeenCalledWith()
    expect(getToolOutput(messages || [])).toEqual({
      focusedItem: true,
      ...expectedOutput,
    })
  },
)

test('returns missing Explorer items to the model', async () => {
  const api = createApi()
  api.exists.mockResolvedValue(false)

  const messages = await executeExplorerFunctionToolCall(
    createEvent('expand_explorer_folder', '{"path":"missing"}'),
    api,
  )

  expect(api.expandFocusedFolder).not.toHaveBeenCalled()
  expect(getToolOutput(messages || [])).toEqual({
    error: 'Workspace item "missing" was not found.',
    hint: 'Pass a folder path relative to the opened workspace, such as {"path":"scripts"}. Never pass an absolute path or URI.',
    tool: 'expand_explorer_folder',
  })
})

test.each([
  ['expand_explorer_folder', '{}'],
  ['collapse_explorer_folder', '{"path":42}'],
  ['start_explorer_rename', '[]'],
  ['open_explorer_context_menu', '{'],
] as const)('returns invalid %s arguments to the model', async (name, args) => {
  const messages = await executeExplorerFunctionToolCall(
    createEvent(name, args),
    createApi(),
  )
  expect(getToolOutput(messages || [])).toEqual(
    expect.objectContaining({
      error: expect.any(String),
      tool: name,
    }),
  )
})

test('accepts completed output item events', async () => {
  const api = createApi()
  const messages = await executeExplorerFunctionToolCall(
    {
      item: {
        arguments: '{}',
        call_id: 'output-item-call',
        name: 'start_explorer_rename',
        type: 'function_call',
      },
      type: 'response.output_item.done',
    },
    api,
  )

  expect(api.startRename).toHaveBeenCalledWith()
  expect(messages?.[0]).toContain('output-item-call')
})

test.each([undefined, null, {}, createEvent('other_tool', '{}')] as const)(
  'ignores non-Explorer function call %#',
  async (event: Readonly<Record<string, unknown>> | null | undefined) => {
    await expect(
      executeExplorerFunctionToolCall(event),
    ).resolves.toBeUndefined()
  },
)
