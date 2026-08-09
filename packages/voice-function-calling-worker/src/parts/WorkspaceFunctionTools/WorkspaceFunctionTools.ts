import type { FunctionToolDefinition } from '../FunctionToolRegistry/FunctionToolRegistry.ts'
import * as Rpc from '../Rpc/Rpc.ts'

interface FunctionCallArguments {
  readonly argumentsValue: string
  readonly callId: string
  readonly name: string
}

interface WorkspaceApi {
  readonly getRecentlyOpenedWorkspaceUris: () => Promise<readonly string[]>
  readonly getWorkspaceUri: () => Promise<string>
  readonly setWorkspaceUri: (uri: string) => Promise<void>
}

const defaultApi: WorkspaceApi = {
  getRecentlyOpenedWorkspaceUris: () =>
    Rpc.invoke<readonly string[]>('Workspace.getRecentlyOpenedWorkspaceUris'),
  getWorkspaceUri: () =>
    Rpc.invoke<string>('WorkspaceFileSystem.getWorkspaceUri'),
  setWorkspaceUri: (uri) => Rpc.invoke<void>('Workspace.setWorkspaceUri', uri),
}

const uriSchemeRegex = /^[A-Za-z][A-Za-z\d+.-]*:\/\//

const getRecentlyOpenedFoldersTool: FunctionToolDefinition = {
  description:
    'Get recently opened LVCE Editor workspace folders, including a friendly folder name and full URI. Use this to resolve an ambiguous request such as "open about-view" before asking for clarification or treating the name as a file in the current workspace.',
  name: 'get_recently_opened_folders',
  parameters: {
    additionalProperties: false,
    properties: {},
    type: 'object',
  },
  type: 'function',
}

const openWorkspaceFolderTool: FunctionToolDefinition = {
  description:
    'Open or switch the LVCE Editor workspace folder. Call only when the user explicitly asks to open or switch a workspace. Pass a full filesystem URI.',
  name: 'open_workspace_folder',
  parameters: {
    additionalProperties: false,
    properties: {
      uri: {
        description:
          'Full workspace folder URI, for example "file:///home/user/project" or "remote-ssh://host/project".',
        type: 'string',
      },
    },
    required: ['uri'],
    type: 'object',
  },
  type: 'function',
}

const getWorkspaceFolderUriTool: FunctionToolDefinition = {
  description:
    'Get the URI of the workspace folder that is already open in LVCE Editor. Use this instead of asking the user for the current workspace URI.',
  name: 'get_workspace_folder_uri',
  parameters: {
    additionalProperties: false,
    properties: {},
    type: 'object',
  },
  type: 'function',
}

export const workspaceFunctionTools: readonly FunctionToolDefinition[] = [
  getRecentlyOpenedFoldersTool,
  getWorkspaceFolderUriTool,
  openWorkspaceFolderTool,
]

const parseFunctionCall = (
  parsed: unknown,
): FunctionCallArguments | undefined => {
  if (!parsed || typeof parsed !== 'object') {
    return undefined
  }
  if (
    'type' in parsed &&
    parsed.type === 'response.function_call_arguments.done' &&
    'call_id' in parsed &&
    typeof parsed.call_id === 'string' &&
    'name' in parsed &&
    typeof parsed.name === 'string' &&
    (parsed.name === 'get_recently_opened_folders' ||
      parsed.name === 'get_workspace_folder_uri' ||
      parsed.name === 'open_workspace_folder') &&
    'arguments' in parsed &&
    typeof parsed.arguments === 'string'
  ) {
    return {
      argumentsValue: parsed.arguments,
      callId: parsed.call_id,
      name: parsed.name,
    }
  }
  if (
    'type' in parsed &&
    parsed.type === 'response.output_item.done' &&
    'item' in parsed &&
    parsed.item &&
    typeof parsed.item === 'object' &&
    'type' in parsed.item &&
    parsed.item.type === 'function_call' &&
    'call_id' in parsed.item &&
    typeof parsed.item.call_id === 'string' &&
    'name' in parsed.item &&
    typeof parsed.item.name === 'string' &&
    (parsed.item.name === 'get_recently_opened_folders' ||
      parsed.item.name === 'get_workspace_folder_uri' ||
      parsed.item.name === 'open_workspace_folder') &&
    'arguments' in parsed.item &&
    typeof parsed.item.arguments === 'string'
  ) {
    return {
      argumentsValue: parsed.item.arguments,
      callId: parsed.item.call_id,
      name: parsed.item.name,
    }
  }
  return undefined
}

const createToolOutputMessage = (callId: string, output: string): string => {
  return JSON.stringify({
    item: {
      call_id: callId,
      output,
      type: 'function_call_output',
    },
    type: 'conversation.item.create',
  })
}

const createFunctionResultResponseMessage = (): string => {
  return JSON.stringify({ type: 'response.create' })
}

const getWorkspaceUriArgument = (value: string): string => {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new TypeError('Function tool arguments must be valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Function tool arguments must be a JSON object.')
  }
  const { uri } = parsed as Readonly<Record<string, unknown>>
  if (typeof uri !== 'string') {
    throw new TypeError('Function tool argument "uri" must be a string.')
  }
  const trimmedUri = uri.trim()
  if (!uriSchemeRegex.test(trimmedUri)) {
    throw new TypeError(
      'Function tool argument "uri" must be a full workspace URI.',
    )
  }
  return trimmedUri
}

const validateEmptyArguments = (value: string, toolName: string): void => {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new TypeError('Function tool arguments must be valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Function tool arguments must be a JSON object.')
  }
  if (Object.keys(parsed).length > 0) {
    throw new TypeError(`The ${toolName} tool does not accept arguments.`)
  }
}

const getFolderName = (uri: string): string => {
  const path = uri.split(/[?#]/, 1)[0].replace(/\/+$/, '')
  const slashIndex = path.lastIndexOf('/')
  const encodedName = slashIndex === -1 ? path : path.slice(slashIndex + 1)
  try {
    return decodeURIComponent(encodedName)
  } catch {
    return encodedName
  }
}

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error)
}

export const executeWorkspaceFunctionToolCall = async (
  functionCallEvent: unknown,
  api: WorkspaceApi = defaultApi,
): Promise<readonly string[] | undefined> => {
  const functionCall = parseFunctionCall(functionCallEvent)
  if (!functionCall) {
    return undefined
  }
  let output: unknown
  try {
    if (functionCall.name === 'get_recently_opened_folders') {
      validateEmptyArguments(functionCall.argumentsValue, functionCall.name)
      const uris = await api.getRecentlyOpenedWorkspaceUris()
      output = {
        folders: uris
          .filter((uri): uri is string => typeof uri === 'string')
          .map((uri) => ({ name: getFolderName(uri), uri })),
      }
    } else if (functionCall.name === 'get_workspace_folder_uri') {
      validateEmptyArguments(functionCall.argumentsValue, functionCall.name)
      const uri = await api.getWorkspaceUri()
      if (!uri) {
        throw new Error('No workspace folder is open.')
      }
      output = { uri }
    } else {
      const uri = getWorkspaceUriArgument(functionCall.argumentsValue)
      await api.setWorkspaceUri(uri)
      output = { opened: true, uri }
    }
  } catch (error) {
    output = {
      error: getErrorMessage(error),
      hint:
        functionCall.name === 'get_recently_opened_folders'
          ? 'Call get_recently_opened_folders with no arguments: {}.'
          : functionCall.name === 'get_workspace_folder_uri'
            ? 'Call get_workspace_folder_uri with no arguments: {}.'
            : 'Pass a full workspace folder URI, such as {"uri":"file:///home/user/project"}.',
      tool: functionCall.name,
    }
  }
  return [
    createToolOutputMessage(functionCall.callId, JSON.stringify(output)),
    createFunctionResultResponseMessage(),
  ]
}
