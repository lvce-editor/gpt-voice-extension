import type { FunctionToolDefinition } from '../FunctionToolRegistry/FunctionToolRegistry.ts'
import * as Rpc from '../Rpc/Rpc.ts'

export interface MainAreaApi {
  readonly closeAllEditors: () => Promise<void>
  readonly getOpenEditorUris: () => Promise<readonly string[]>
  readonly getWorkspaceUri: () => Promise<string>
}

interface FunctionCallArguments {
  readonly argumentsValue: string
  readonly callId: string
  readonly name: MainAreaFunctionToolName
}

interface OpenEditorTab {
  readonly path?: string
  readonly title: string
  readonly uri: string
}

const defaultApi: MainAreaApi = {
  closeAllEditors: () => Rpc.invoke<void>('MainArea.closeAllEditors'),
  getOpenEditorUris: () =>
    Rpc.invoke<readonly string[]>('MainArea.getOpenEditorUris'),
  getWorkspaceUri: () =>
    Rpc.invoke<string>('WorkspaceMainArea.getWorkspaceUri'),
}

export const mainAreaFunctionTools: readonly FunctionToolDefinition[] = [
  {
    description:
      'Get every open editor tab in visual order. Returns titles, exact URIs, and workspace-relative paths when available. Use this before closing a tab when its identity is unclear.',
    name: 'get_open_editor_tabs',
    parameters: {
      additionalProperties: false,
      properties: {},
      type: 'object',
    },
    type: 'function',
  },
  {
    description:
      'Close every editor tab, including workspace files and non-file editors such as Settings. Use this whenever the user asks to close all editors.',
    name: 'close_all_editors',
    parameters: {
      additionalProperties: false,
      properties: {},
      type: 'object',
    },
    type: 'function',
  },
]

type MainAreaFunctionToolName = 'close_all_editors' | 'get_open_editor_tabs'

const mainAreaFunctionToolNames = new Set<MainAreaFunctionToolName>([
  'close_all_editors',
  'get_open_editor_tabs',
])

const parseFunctionCall = (
  parsed: unknown,
): FunctionCallArguments | undefined => {
  if (!parsed || typeof parsed !== 'object') {
    return undefined
  }
  let item: unknown
  if (
    'type' in parsed &&
    parsed.type === 'response.function_call_arguments.done'
  ) {
    item = parsed
  } else if (
    'type' in parsed &&
    parsed.type === 'response.output_item.done' &&
    'item' in parsed
  ) {
    const { item: outputItem } = parsed
    item = outputItem
  } else {
    return undefined
  }
  if (
    !item ||
    typeof item !== 'object' ||
    ('type' in item && item !== parsed && item.type !== 'function_call') ||
    !('call_id' in item) ||
    typeof item.call_id !== 'string' ||
    !('name' in item) ||
    typeof item.name !== 'string' ||
    !mainAreaFunctionToolNames.has(item.name as MainAreaFunctionToolName) ||
    !('arguments' in item) ||
    typeof item.arguments !== 'string'
  ) {
    return undefined
  }
  return {
    argumentsValue: item.arguments,
    callId: item.call_id,
    name: item.name as MainAreaFunctionToolName,
  }
}

const validateArguments = (
  value: string,
  toolName: MainAreaFunctionToolName,
): void => {
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

const decodeUriSegment = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const uriQueryOrFragmentRegex = /[?#]/

const getEditorTitle = (uri: string): string => {
  const uriWithoutQuery = uri.split(uriQueryOrFragmentRegex, 1)[0] || uri
  const segments = uriWithoutQuery.split('/').filter(Boolean)
  const lastSegment = segments.at(-1)
  if (lastSegment && !lastSegment.endsWith(':')) {
    return decodeUriSegment(lastSegment)
  }
  const schemeEnd = uri.indexOf(':')
  return schemeEnd === -1 ? uri : uri.slice(0, schemeEnd)
}

const getWorkspaceRelativePath = (
  workspaceUri: string,
  tabUri: string | undefined,
): string | undefined => {
  if (!tabUri) {
    return undefined
  }
  const workspaceRoot = workspaceUri.endsWith('/')
    ? workspaceUri
    : `${workspaceUri}/`
  if (!tabUri.startsWith(workspaceRoot)) {
    return undefined
  }
  const encodedPath = tabUri.slice(workspaceRoot.length)
  try {
    return encodedPath
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/')
  } catch {
    return encodedPath
  }
}

export const getOpenEditorTabs = async (
  api: MainAreaApi = defaultApi,
): Promise<Readonly<{ count: number; tabs: readonly OpenEditorTab[] }>> => {
  const [openEditorUris, workspaceUri] = await Promise.all([
    api.getOpenEditorUris(),
    api.getWorkspaceUri(),
  ])
  const tabs = openEditorUris.map<OpenEditorTab>((uri) => {
    const path = getWorkspaceRelativePath(workspaceUri, uri)
    return {
      ...(path !== undefined && { path }),
      title: getEditorTitle(uri),
      uri,
    }
  })
  return { count: tabs.length, tabs }
}

export const closeAllEditors = async (
  api: MainAreaApi = defaultApi,
): Promise<Readonly<{ closed: number }>> => {
  const openEditorUris = await api.getOpenEditorUris()
  await api.closeAllEditors()
  return { closed: openEditorUris.length }
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

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error)
}

const getErrorHint = (toolName: MainAreaFunctionToolName): string => {
  return `Call ${toolName} with no arguments: {}.`
}

export const executeMainAreaFunctionToolCall = async (
  functionCallEvent: unknown,
  api: MainAreaApi = defaultApi,
): Promise<readonly string[] | undefined> => {
  const functionCall = parseFunctionCall(functionCallEvent)
  if (!functionCall) {
    return undefined
  }
  let output: unknown
  try {
    validateArguments(functionCall.argumentsValue, functionCall.name)
    output =
      functionCall.name === 'close_all_editors'
        ? await closeAllEditors(api)
        : await getOpenEditorTabs(api)
  } catch (error) {
    output = {
      error: getErrorMessage(error),
      hint: getErrorHint(functionCall.name),
      tool: functionCall.name,
    }
  }
  return [
    createToolOutputMessage(functionCall.callId, output),
    JSON.stringify({ type: 'response.create' }),
  ]
}
