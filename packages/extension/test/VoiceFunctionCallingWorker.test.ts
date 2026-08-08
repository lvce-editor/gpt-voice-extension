import type * as Api from '@lvce-editor/api'
import { beforeEach, expect, jest, test } from '@jest/globals'

const invoke =
  jest.fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()
const createRpc = jest.fn<typeof Api.createRpc>(
  async () =>
    ({
      invoke,
    }) as never,
)
const closeUri = jest.fn<(uri: string) => Promise<void>>(async () => undefined)
const openUri = jest.fn<(uri: string) => Promise<void>>(async () => undefined)
const openDebugConsole = jest.fn<typeof Api.openDebugConsole>(
  async () => undefined,
)
const openOutputView = jest.fn<typeof Api.openOutputView>(async () => undefined)
const openProblemsView = jest.fn<typeof Api.openProblemsView>(
  async () => undefined,
)
const executeCommand = jest.fn<typeof Api.executeCommand>(async () => undefined)
const getWorkspaceUri = jest.fn(async () => 'file:///workspace')
const readDirWithFileTypes = jest.fn(async () => [
  { name: 'package.json', type: 7 },
])
const readFile = jest.fn<(uri: string) => Promise<string>>(
  async () => 'workspace content',
)
const setWorkspaceUri = jest.fn<(uri: string) => Promise<void>>(
  async () => undefined,
)
const writeFile = jest.fn<(uri: string, content: string) => Promise<void>>(
  async () => undefined,
)

// eslint-disable-next-line jest/no-restricted-jest-methods
jest.unstable_mockModule('@lvce-editor/api', () => {
  const actual = jest.requireActual<typeof Api>('@lvce-editor/api')
  return {
    ...actual,
    closeUri,
    createRpc,
    executeCommand,
    getWorkspaceUri,
    openDebugConsole,
    openOutputView,
    openProblemsView,
    openUri,
    readDirWithFileTypes,
    readFile,
    setWorkspaceUri,
    writeFile,
  }
})

const VoiceFunctionCallingWorker =
  await import('../src/parts/VoiceFunctionCallingWorker/VoiceFunctionCallingWorker.ts')

beforeEach(() => {
  createRpc.mockClear()
  closeUri.mockClear()
  executeCommand.mockClear()
  invoke.mockReset()
  getWorkspaceUri.mockClear()
  openDebugConsole.mockClear()
  openOutputView.mockClear()
  openProblemsView.mockClear()
  openUri.mockClear()
  readDirWithFileTypes.mockClear()
  readFile.mockClear()
  setWorkspaceUri.mockClear()
  writeFile.mockClear()
  VoiceFunctionCallingWorker.state.rpcPromise = undefined
})

test('creates a web worker RPC and queries registered tools', async () => {
  const tools = [
    {
      description: 'Test tool',
      name: 'test',
      parameters: {},
      type: 'function' as const,
    },
  ]
  invoke.mockResolvedValue(tools)

  await expect(VoiceFunctionCallingWorker.getRegisteredTools()).resolves.toBe(
    tools,
  )

  expect(createRpc).toHaveBeenCalledWith({
    commandMap: {
      'Panel.close': expect.any(Function),
      'Panel.open': expect.any(Function),
      'PanelView.openDebugConsole': expect.any(Function),
      'PanelView.openOutputView': expect.any(Function),
      'PanelView.openProblemsView': expect.any(Function),
      'Workspace.setWorkspaceUri': setWorkspaceUri,
      'WorkspaceFileSystem.getWorkspaceUri': getWorkspaceUri,
      'WorkspaceFileSystem.readDirWithFileTypes': readDirWithFileTypes,
      'WorkspaceFileSystem.readFile': readFile,
      'WorkspaceFileSystem.writeFile': writeFile,
      'WorkspaceMainArea.closeUri': closeUri,
      'WorkspaceMainArea.getWorkspaceUri': getWorkspaceUri,
      'WorkspaceMainArea.openUri': openUri,
    },
    contentSecurityPolicy: "default-src 'none'; script-src 'self'",
    name: 'Voice Function Calling Worker',
    url: new URL(
      'voiceFunctionCallingWorkerMain.js',
      import.meta.url,
    ).href.replace('/test/', '/src/parts/VoiceFunctionCallingWorker/'),
  })
  expect(invoke).toHaveBeenCalledWith('VoiceFunctionCalling.getRegisteredTools')
})

test('bridges panel commands from the function calling worker', async () => {
  invoke.mockResolvedValue([])
  await VoiceFunctionCallingWorker.getRegisteredTools()

  const options = createRpc.mock.calls[0]?.[0]
  const commandMap = options?.commandMap as Readonly<
    Record<string, (...args: readonly unknown[]) => Promise<void>>
  >
  await commandMap['Panel.open']?.('Terminals')
  await commandMap['Panel.open']?.()
  await commandMap['Panel.close']?.()

  expect(executeCommand).toHaveBeenNthCalledWith(
    1,
    'Layout.showPanel',
    'Terminals',
  )
  expect(executeCommand).toHaveBeenNthCalledWith(2, 'Layout.showPanel')
  expect(executeCommand).toHaveBeenNthCalledWith(3, 'Layout.hidePanel')
})

test('bridges panel view commands from the function calling worker', async () => {
  invoke.mockResolvedValue([])
  await VoiceFunctionCallingWorker.getRegisteredTools()

  const options = createRpc.mock.calls[0]?.[0]
  const commandMap = options?.commandMap as Readonly<
    Record<string, (...args: readonly unknown[]) => Promise<void>>
  >
  await commandMap['PanelView.openProblemsView']?.({ filter: 'typescript' })
  await commandMap['PanelView.openOutputView']?.({ channel: 'Window' })
  await commandMap['PanelView.openDebugConsole']?.({ input: 'process.version' })

  expect(openProblemsView).toHaveBeenCalledWith({ filter: 'typescript' })
  expect(openOutputView).toHaveBeenCalledWith({ channel: 'Window' })
  expect(openDebugConsole).toHaveBeenCalledWith({ input: 'process.version' })
})

test('invokes a workspace file tool on the worker', async () => {
  const functionCallEvent = {
    arguments: '{"path":"src/index.ts"}',
    call_id: 'read-call',
    name: 'read_workspace_file',
    type: 'response.function_call_arguments.done',
  }

  const result = ['output', 'response']
  invoke.mockResolvedValue(result)

  await expect(
    VoiceFunctionCallingWorker.executeFunctionToolCall(functionCallEvent),
  ).resolves.toBe(result)

  expect(invoke).toHaveBeenCalledWith(
    'VoiceFunctionCalling.executeFunctionToolCall',
    functionCallEvent,
  )
  expect(readFile).not.toHaveBeenCalled()
})

test('invokes a function tool call on the worker', async () => {
  const functionCallEvent = {
    arguments: '{"location":"Paris"}',
    call_id: 'call-1',
    name: 'getweather',
    type: 'response.function_call_arguments.done',
  }
  const result = ['output', 'response']
  invoke.mockResolvedValue(result)

  await expect(
    VoiceFunctionCallingWorker.executeFunctionToolCall(functionCallEvent),
  ).resolves.toBe(result)

  expect(invoke).toHaveBeenCalledWith(
    'VoiceFunctionCalling.executeFunctionToolCall',
    functionCallEvent,
  )
})

test('reuses the worker RPC', async () => {
  invoke.mockResolvedValue([])

  await VoiceFunctionCallingWorker.getRegisteredTools()
  await VoiceFunctionCallingWorker.getRegisteredTools()

  expect(createRpc).toHaveBeenCalledTimes(1)
})
