import type { FunctionToolDefinition } from '../FunctionToolRegistry/FunctionToolRegistry.ts'
import * as Rpc from '../Rpc/Rpc.ts'

interface SavedTab {
  readonly editorType: string
  readonly id: number
  readonly isDirty: boolean
  readonly isPreview: boolean
  readonly title: string
  readonly uri?: string
}

interface SavedEditorGroup {
  readonly activeTabId: number
  readonly id: number
  readonly tabs: readonly SavedTab[]
}

interface SavedMainAreaState {
  readonly layout: {
    readonly activeGroupId: number
    readonly groups: readonly SavedEditorGroup[]
  }
}

interface MainAreaApi {
  readonly getSavedState: () => Promise<SavedMainAreaState>
  readonly getWorkspaceUri: () => Promise<string>
}

interface FunctionCallArguments {
  readonly argumentsValue: string
  readonly callId: string
}

interface OpenEditorTab {
  readonly active: boolean
  readonly dirty: boolean
  readonly editorType: string
  readonly group: number
  readonly path?: string
  readonly preview: boolean
  readonly selected: boolean
  readonly title: string
  readonly uri?: string
}

const defaultApi: MainAreaApi = {
  getSavedState: () => Rpc.invoke<SavedMainAreaState>('MainArea.getSavedState'),
  getWorkspaceUri: () =>
    Rpc.invoke<string>('WorkspaceMainArea.getWorkspaceUri'),
}

export const mainAreaFunctionTools: readonly FunctionToolDefinition[] = [
  {
    description:
      'Get every open editor tab in the main area, in visual group and tab order. Returns titles, exact URIs, workspace-relative paths when available, active and selected state, and whether each tab is dirty or a preview. Use this before closing a tab when its identity is unclear.',
    name: 'get_open_editor_tabs',
    parameters: {
      additionalProperties: false,
      properties: {},
      type: 'object',
    },
    type: 'function',
  },
]

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
    item = parsed.item
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
    item.name !== 'get_open_editor_tabs' ||
    !('arguments' in item) ||
    typeof item.arguments !== 'string'
  ) {
    return undefined
  }
  return {
    argumentsValue: item.arguments,
    callId: item.call_id,
  }
}

const validateArguments = (value: string): void => {
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
    throw new TypeError(
      'The get_open_editor_tabs tool does not accept arguments.',
    )
  }
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
  const [savedState, workspaceUri] = await Promise.all([
    api.getSavedState(),
    api.getWorkspaceUri(),
  ])
  const { activeGroupId, groups } = savedState.layout
  const tabs = groups.flatMap((group, groupIndex) =>
    group.tabs.map<OpenEditorTab>((tab) => {
      const path = getWorkspaceRelativePath(workspaceUri, tab.uri)
      return {
        active: group.id === activeGroupId && tab.id === group.activeTabId,
        dirty: tab.isDirty,
        editorType: tab.editorType,
        group: groupIndex + 1,
        ...(path === undefined ? {} : { path }),
        preview: tab.isPreview,
        selected: tab.id === group.activeTabId,
        title: tab.title,
        ...(tab.uri === undefined ? {} : { uri: tab.uri }),
      }
    }),
  )
  return { count: tabs.length, tabs }
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
    validateArguments(functionCall.argumentsValue)
    output = await getOpenEditorTabs(api)
  } catch (error) {
    output = {
      error: getErrorMessage(error),
      hint: 'Call get_open_editor_tabs with no arguments: {}.',
      tool: 'get_open_editor_tabs',
    }
  }
  return [
    createToolOutputMessage(functionCall.callId, output),
    JSON.stringify({ type: 'response.create' }),
  ]
}
