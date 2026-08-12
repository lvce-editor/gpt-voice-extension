import type { FunctionToolDefinition } from '../FunctionToolRegistry/FunctionToolRegistry.ts'
import * as Rpc from '../Rpc/Rpc.ts'
import { resolveWorkspaceItemUri } from '../WorkspaceFileSystem/WorkspaceFileSystem.ts'

interface ExplorerApi {
  readonly collapseFocusedFolder: () => Promise<void>
  readonly exists: (uri: string) => Promise<boolean>
  readonly expandFocusedFolder: () => Promise<void>
  readonly getWorkspaceUri: () => Promise<string>
  readonly open: () => Promise<void>
  readonly openFocusedContextMenu: () => Promise<void>
  readonly revealItem: (uri: string) => Promise<void>
  readonly startRename: () => Promise<void>
}

const defaultApi: ExplorerApi = {
  collapseFocusedFolder: () =>
    Rpc.invoke<void>('Explorer.collapseFocusedFolder'),
  exists: (uri) => Rpc.invoke<boolean>('WorkspaceFileSystem.exists', uri),
  expandFocusedFolder: () => Rpc.invoke<void>('Explorer.expandFocusedFolder'),
  getWorkspaceUri: () =>
    Rpc.invoke<string>('WorkspaceFileSystem.getWorkspaceUri'),
  open: () => Rpc.invoke<void>('Explorer.open'),
  openFocusedContextMenu: () =>
    Rpc.invoke<void>('Explorer.openFocusedContextMenu'),
  revealItem: (uri) => Rpc.invoke<void>('Explorer.revealItem', uri),
  startRename: () => Rpc.invoke<void>('Explorer.startRename'),
}

const relativeItemPathProperty = {
  description:
    'Optional path relative to the opened workspace, for example "scripts" or "src/index.ts". Omit it to use the currently focused Explorer item. Never pass an absolute path or URI.',
  type: 'string',
} as const

const relativeFolderPathProperty = {
  description:
    'Required folder path relative to the opened workspace, for example "scripts" or "packages/extension". Never pass an absolute path or URI.',
  type: 'string',
} as const

export const explorerFunctionTools: readonly FunctionToolDefinition[] = [
  {
    description:
      'Expand a folder in the Explorer tree. Use this when the user says to open, show, or expand a folder in Explorer, such as "open the scripts folder". This reveals the folder and expands its children; it does not open a file in the editor or change the workspace folder.',
    name: 'expand_explorer_folder',
    parameters: {
      additionalProperties: false,
      properties: {
        path: relativeFolderPathProperty,
      },
      required: ['path'],
      type: 'object',
    },
    type: 'function',
  },
  {
    description:
      'Collapse a folder in the Explorer tree while keeping it focused. Use this when the user says to close or collapse a folder in Explorer. This does not close editor tabs or change the workspace folder.',
    name: 'collapse_explorer_folder',
    parameters: {
      additionalProperties: false,
      properties: {
        path: relativeFolderPathProperty,
      },
      required: ['path'],
      type: 'object',
    },
    type: 'function',
  },
  {
    description:
      'Enter rename mode for an Explorer item. Pass a relative path to reveal and focus a specific file or folder first, or omit the path to rename the currently focused Explorer item. This only opens the rename input; it does not choose or confirm a new name.',
    name: 'start_explorer_rename',
    parameters: {
      additionalProperties: false,
      properties: {
        path: relativeItemPathProperty,
      },
      type: 'object',
    },
    type: 'function',
  },
  {
    description:
      'Open the context menu for an Explorer item. Pass a relative path to reveal and focus a specific file or folder first, or omit the path to use the currently focused Explorer item.',
    name: 'open_explorer_context_menu',
    parameters: {
      additionalProperties: false,
      properties: {
        path: relativeItemPathProperty,
      },
      type: 'object',
    },
    type: 'function',
  },
]

const explorerFunctionToolNames = explorerFunctionTools.map((tool) => tool.name)

interface FunctionCallArguments {
  readonly argumentsValue: string
  readonly callId: string
  readonly name: string
}

const parseFunctionCall = (
  event: unknown,
): FunctionCallArguments | undefined => {
  if (!event || typeof event !== 'object') {
    return undefined
  }
  const item =
    'type' in event &&
    event.type === 'response.output_item.done' &&
    'item' in event
      ? event.item
      : event
  if (
    !item ||
    typeof item !== 'object' ||
    !('type' in item) ||
    (item.type !== 'response.function_call_arguments.done' &&
      item.type !== 'function_call') ||
    !('call_id' in item) ||
    typeof item.call_id !== 'string' ||
    !('name' in item) ||
    typeof item.name !== 'string' ||
    !explorerFunctionToolNames.includes(item.name) ||
    !('arguments' in item) ||
    typeof item.arguments !== 'string'
  ) {
    return undefined
  }
  return {
    argumentsValue: item.arguments,
    callId: item.call_id,
    name: item.name,
  }
}

const parseArguments = (value: string): Readonly<Record<string, unknown>> => {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new TypeError('Function tool arguments must be valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Function tool arguments must be a JSON object.')
  }
  return parsed as Readonly<Record<string, unknown>>
}

const getPath = (
  argumentsValue: Readonly<Record<string, unknown>>,
  required: boolean,
): string | undefined => {
  const { path } = argumentsValue
  if (path === undefined && !required) {
    return undefined
  }
  if (typeof path !== 'string') {
    throw new TypeError('Function tool argument "path" must be a string.')
  }
  return path
}

const focusExplorerItem = async (
  path: string | undefined,
  api: ExplorerApi,
): Promise<void> => {
  await api.open()
  if (path === undefined) {
    return
  }
  const workspaceUri = await api.getWorkspaceUri()
  const uri = resolveWorkspaceItemUri(workspaceUri, path)
  if (!(await api.exists(uri))) {
    throw new Error(`Workspace item "${path}" was not found.`)
  }
  await api.revealItem(uri)
}

const createToolOutputMessage = (callId: string, output: unknown): string => {
  return JSON.stringify({
    item: {
      call_id: callId,
      output: JSON.stringify(output),
      type: 'function_call_output',
    },
    type: 'conversation.item.create',
  })
}

const getErrorHint = (toolName: string): string => {
  if (
    toolName === 'expand_explorer_folder' ||
    toolName === 'collapse_explorer_folder'
  ) {
    return 'Pass a folder path relative to the opened workspace, such as {"path":"scripts"}. Never pass an absolute path or URI.'
  }
  return 'Pass an optional file or folder path relative to the opened workspace, or call the tool with {} to use the focused Explorer item.'
}

export const executeExplorerFunctionToolCall = async (
  event: unknown,
  api: ExplorerApi = defaultApi,
): Promise<readonly string[] | undefined> => {
  const functionCall = parseFunctionCall(event)
  if (!functionCall) {
    return undefined
  }
  let output: unknown
  try {
    const argumentsValue = parseArguments(functionCall.argumentsValue)
    const requiresPath =
      functionCall.name === 'expand_explorer_folder' ||
      functionCall.name === 'collapse_explorer_folder'
    const path = getPath(argumentsValue, requiresPath)
    await focusExplorerItem(path, api)
    switch (functionCall.name) {
      case 'collapse_explorer_folder':
        await api.collapseFocusedFolder()
        await focusExplorerItem(path, api)
        output = { collapsed: true, path }
        break
      case 'expand_explorer_folder':
        await api.expandFocusedFolder()
        await focusExplorerItem(path, api)
        output = { expanded: true, path }
        break
      case 'open_explorer_context_menu':
        await api.openFocusedContextMenu()
        output = path
          ? { opened: true, path }
          : { focusedItem: true, opened: true }
        break
      case 'start_explorer_rename':
        await api.startRename()
        output = path
          ? { path, renaming: true }
          : { focusedItem: true, renaming: true }
        break
      default:
        throw new Error(`Unknown Explorer tool: ${functionCall.name}`)
    }
  } catch (error) {
    output = {
      error: error instanceof Error ? error.message : String(error),
      hint: getErrorHint(functionCall.name),
      tool: functionCall.name,
    }
  }
  return [
    createToolOutputMessage(functionCall.callId, output),
    JSON.stringify({ type: 'response.create' }),
  ]
}
