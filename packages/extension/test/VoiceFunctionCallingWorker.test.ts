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
const nodeInvoke =
  jest.fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()
const createNodeRpc = jest.fn<typeof Api.createNodeRpc>(
  async () =>
    ({
      invoke: nodeInvoke,
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
const openProcessExplorer = jest.fn<typeof Api.openProcessExplorer>(
  async () => undefined,
)
const openSettings = jest.fn<typeof Api.openSettings>(async () => undefined)
const setSettingsSearchValue = jest.fn<typeof Api.setSettingsSearchValue>(
  async () => undefined,
)
const executeCommand = jest.fn<typeof Api.executeCommand>(async () => undefined)
const exists = jest.fn<typeof Api.exists>(async () => true)
const focusNextTab = jest.fn<() => Promise<void>>(async () => undefined)
const focusPreviousTab = jest.fn<() => Promise<void>>(async () => undefined)
const formatDocument = jest.fn<() => Promise<void>>(async () => undefined)
const getDiagnostics = jest.fn<() => Promise<readonly Api.Diagnostic[]>>(
  async () => [],
)
const getEditorSelections = jest.fn<typeof Api.getEditorSelections>(
  async () => [],
)
const getRecentlyOpenedWorkspaceUris = jest.fn<
  typeof Api.getRecentlyOpenedWorkspaceUris
>(async () => [])
const getWorkspaceUri = jest.fn(async () => 'file:///workspace')
const getPreference = jest.fn<() => Promise<unknown>>(async () => false)
const readDirWithFileTypes = jest.fn(async () => [
  { name: 'package.json', type: 7 },
])
const readFile = jest.fn<(uri: string) => Promise<string>>(
  async () => 'workspace content',
)
const setWorkspaceUri = jest.fn<(uri: string) => Promise<void>>(
  async () => undefined,
)
const setEditorSelections = jest.fn<typeof Api.setEditorSelections>(
  async () => undefined,
)
const showCompletions = jest.fn<() => Promise<void>>(async () => undefined)
const showFileQuickPick = jest.fn(async () => undefined)
const writeFile = jest.fn<(uri: string, content: string) => Promise<void>>(
  async () => undefined,
)

// eslint-disable-next-line jest/no-restricted-jest-methods
jest.unstable_mockModule('@lvce-editor/api', () => {
  const actual = jest.requireActual<typeof Api>('@lvce-editor/api')
  return {
    ...actual,
    closeUri,
    createNodeRpc,
    createRpc,
    executeCommand,
    exists,
    focusNextTab,
    focusPreviousTab,
    formatDocument,
    getDiagnostics,
    getEditorSelections,
    getPreference,
    getRecentlyOpenedWorkspaceUris,
    getWorkspaceUri,
    openDebugConsole,
    openOutputView,
    openProblemsView,
    openProcessExplorer,
    openSettings,
    openUri,
    readDirWithFileTypes,
    readFile,
    setEditorSelections,
    setSettingsSearchValue,
    setWorkspaceUri,
    showCompletions,
    showFileQuickPick,
    writeFile,
  }
})

const VoiceFunctionCallingWorker =
  await import('../src/parts/VoiceFunctionCallingWorker/VoiceFunctionCallingWorker.ts')

beforeEach(() => {
  createRpc.mockClear()
  createNodeRpc.mockClear()
  closeUri.mockClear()
  executeCommand.mockClear()
  exists.mockClear()
  focusNextTab.mockClear()
  focusPreviousTab.mockClear()
  formatDocument.mockClear()
  getDiagnostics.mockClear()
  getEditorSelections.mockClear()
  getRecentlyOpenedWorkspaceUris.mockClear()
  invoke.mockReset()
  getWorkspaceUri.mockClear()
  openDebugConsole.mockClear()
  openOutputView.mockClear()
  openProblemsView.mockClear()
  openProcessExplorer.mockClear()
  openSettings.mockClear()
  getPreference.mockReset()
  getPreference.mockResolvedValue(false)
  nodeInvoke.mockReset()
  openUri.mockClear()
  readDirWithFileTypes.mockClear()
  readFile.mockClear()
  setWorkspaceUri.mockClear()
  setEditorSelections.mockClear()
  setSettingsSearchValue.mockClear()
  showCompletions.mockClear()
  showFileQuickPick.mockClear()
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
      'Editor.formatDocument': formatDocument,
      'Editor.getDiagnostics': getDiagnostics,
      'Editor.getSelections': getEditorSelections,
      'Editor.setSelections': setEditorSelections,
      'Editor.showCompletions': showCompletions,
      'Layout.toggleSideBarPosition': expect.any(Function),
      'MainArea.closeAllEditors': expect.any(Function),
      'MainArea.focusNextTab': focusNextTab,
      'MainArea.focusPreviousTab': focusPreviousTab,
      'MainArea.getOpenEditorUris': expect.any(Function),
      'Panel.close': expect.any(Function),
      'Panel.open': expect.any(Function),
      'PanelView.openDebugConsole': expect.any(Function),
      'PanelView.openOutputView': expect.any(Function),
      'PanelView.openProblemsView': expect.any(Function),
      'Preview.open': expect.any(Function),
      'ProcessExplorer.open': openProcessExplorer,
      'Settings.openSettings': openSettings,
      'Settings.setSearchValue': setSettingsSearchValue,
      'Terminal.executeBash': expect.any(Function),
      'Terminal.runInTerminal': expect.any(Function),
      'Workspace.getRecentlyOpenedWorkspaceUris':
        getRecentlyOpenedWorkspaceUris,
      'Workspace.setWorkspaceUri': setWorkspaceUri,
      'WorkspaceFileSystem.exists': exists,
      'WorkspaceFileSystem.getWorkspaceUri': getWorkspaceUri,
      'WorkspaceFileSystem.readDirWithFileTypes': readDirWithFileTypes,
      'WorkspaceFileSystem.readFile': readFile,
      'WorkspaceFileSystem.writeFile': writeFile,
      'WorkspaceMainArea.closeUri': closeUri,
      'WorkspaceMainArea.getWorkspaceUri': getWorkspaceUri,
      'WorkspaceMainArea.openUri': openUri,
      'WorkspaceMainArea.setQuickPickValue': expect.any(Function),
      'WorkspaceMainArea.showFileQuickPick': showFileQuickPick,
    },
    contentSecurityPolicy: "default-src 'none'; script-src 'self'",
    name: 'Voice Function Calling Worker',
    url: new URL(
      'voiceFunctionCallingWorkerMain.js',
      import.meta.url,
    ).href.replace('/test/', '/src/parts/VoiceFunctionCallingWorker/'),
  })
  expect(invoke).toHaveBeenCalledWith(
    'VoiceFunctionCalling.getRegisteredTools',
    false,
  )
})

test('bridges process explorer commands from the function calling worker', async () => {
  invoke.mockResolvedValue([])
  await VoiceFunctionCallingWorker.getRegisteredTools()

  const options = createRpc.mock.calls[0]?.[0]
  const commandMap = options?.commandMap as Readonly<
    Record<string, (...args: readonly unknown[]) => Promise<void>>
  >
  await commandMap['ProcessExplorer.open']?.()

  expect(openProcessExplorer).toHaveBeenCalledWith()
})

test('registers the terminal tool only when its setting is enabled', async () => {
  getPreference.mockResolvedValue(true)
  invoke.mockResolvedValue([])

  await VoiceFunctionCallingWorker.getRegisteredTools()

  expect(invoke).toHaveBeenCalledWith(
    'VoiceFunctionCalling.getRegisteredTools',
    true,
  )
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

test('bridges sidebar position commands from the function calling worker', async () => {
  invoke.mockResolvedValue([])
  await VoiceFunctionCallingWorker.getRegisteredTools()

  const options = createRpc.mock.calls[0]?.[0]
  const commandMap = options?.commandMap as Readonly<
    Record<string, (...args: readonly unknown[]) => Promise<void>>
  >
  await commandMap['Layout.toggleSideBarPosition']?.()

  expect(executeCommand).toHaveBeenCalledWith('Layout.toggleSideBarPosition')
})

test('bridges HTML preview commands from the function calling worker', async () => {
  invoke.mockResolvedValue([])
  await VoiceFunctionCallingWorker.getRegisteredTools()

  const options = createRpc.mock.calls[0]?.[0]
  const commandMap = options?.commandMap as Readonly<
    Record<string, (...args: readonly unknown[]) => Promise<void>>
  >
  await commandMap['Preview.open']?.('file:///workspace/index.html')

  expect(executeCommand).toHaveBeenCalledWith(
    'Layout.showPreview',
    'file:///workspace/index.html',
  )
})

test('bridges open editor queries from the function calling worker', async () => {
  const uris = ['file:///workspace/package.json', 'settings://']
  executeCommand.mockResolvedValue(uris)
  invoke.mockResolvedValue([])
  await VoiceFunctionCallingWorker.getRegisteredTools()

  const options = createRpc.mock.calls[0]?.[0]
  const commandMap = options?.commandMap as Readonly<
    Record<string, (...args: readonly unknown[]) => Promise<unknown>>
  >
  await expect(commandMap['MainArea.getOpenEditorUris']?.()).resolves.toBe(uris)

  expect(executeCommand).toHaveBeenCalledWith(
    'GetActiveEditor.getOpenEditorUris',
  )
})

test('bridges close all editors commands from the function calling worker', async () => {
  invoke.mockResolvedValue([])
  await VoiceFunctionCallingWorker.getRegisteredTools()

  const options = createRpc.mock.calls[0]?.[0]
  const commandMap = options?.commandMap as Readonly<
    Record<string, (...args: readonly unknown[]) => Promise<unknown>>
  >
  await commandMap['MainArea.closeAllEditors']?.()

  expect(executeCommand).toHaveBeenCalledWith('Main.closeAllEditors')
})

test('bridges editor tab focus commands from the function calling worker', async () => {
  invoke.mockResolvedValue([])
  await VoiceFunctionCallingWorker.getRegisteredTools()

  const options = createRpc.mock.calls[0]?.[0]
  const commandMap = options?.commandMap as Readonly<
    Record<string, (...args: readonly unknown[]) => Promise<void>>
  >
  await commandMap['MainArea.focusNextTab']?.()
  await commandMap['MainArea.focusPreviousTab']?.()

  expect(focusNextTab).toHaveBeenCalledWith()
  expect(focusPreviousTab).toHaveBeenCalledWith()
})

test('bridges editor commands from the function calling worker', async () => {
  invoke.mockResolvedValue([])
  await VoiceFunctionCallingWorker.getRegisteredTools()

  const options = createRpc.mock.calls[0]?.[0]
  const commandMap = options?.commandMap as Readonly<
    Record<string, (...args: readonly unknown[]) => Promise<unknown>>
  >
  await commandMap['Editor.formatDocument']?.()
  await commandMap['Editor.getDiagnostics']?.()
  await commandMap['Editor.getSelections']?.()
  await commandMap['Editor.setSelections']?.([
    {
      endColumnIndex: 8,
      endRowIndex: 4,
      startColumnIndex: 2,
      startRowIndex: 3,
    },
  ])
  await commandMap['Editor.showCompletions']?.()

  expect(formatDocument).toHaveBeenCalledWith()
  expect(getDiagnostics).toHaveBeenCalledWith()
  expect(getEditorSelections).toHaveBeenCalledWith()
  expect(setEditorSelections).toHaveBeenCalledWith([
    {
      endColumnIndex: 8,
      endRowIndex: 4,
      startColumnIndex: 2,
      startRowIndex: 3,
    },
  ])
  expect(showCompletions).toHaveBeenCalledWith()
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

test('bridges opening settings from the function calling worker', async () => {
  invoke.mockResolvedValue([])
  await VoiceFunctionCallingWorker.getRegisteredTools()

  const options = createRpc.mock.calls[0]?.[0]
  const commandMap = options?.commandMap as Readonly<
    Record<string, (...args: readonly unknown[]) => Promise<void>>
  >
  await commandMap['Settings.openSettings']?.()

  expect(openSettings).toHaveBeenCalledWith()
})

test('bridges settings search input from the function calling worker', async () => {
  invoke.mockResolvedValue([])
  await VoiceFunctionCallingWorker.getRegisteredTools()

  const options = createRpc.mock.calls[0]?.[0]
  const commandMap = options?.commandMap as Readonly<
    Record<string, (...args: readonly unknown[]) => Promise<void>>
  >
  await commandMap['Settings.setSearchValue']?.('font size')

  expect(setSettingsSearchValue).toHaveBeenCalledWith('font size')
})

test('bridges quick pick input from the function calling worker', async () => {
  invoke.mockResolvedValue([])
  await VoiceFunctionCallingWorker.getRegisteredTools()

  const options = createRpc.mock.calls[0]?.[0]
  const commandMap = options?.commandMap as Readonly<
    Record<string, (...args: readonly unknown[]) => Promise<void>>
  >
  await commandMap['WorkspaceMainArea.setQuickPickValue']?.('ci.yaml')

  expect(executeCommand).toHaveBeenCalledWith('QuickPick.setValue', 'ci.yaml')
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
