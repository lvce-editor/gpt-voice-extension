import type { FunctionToolDefinition } from '../FunctionToolRegistry/FunctionToolRegistry.ts'
import {
  listWorkspaceDirectory,
  readWorkspaceFile,
  searchWorkspaceFiles,
  type WorkspaceFileSystemApi,
  writeWorkspaceFile,
} from '../WorkspaceFileSystem/WorkspaceFileSystem.ts'
import {
  closeWorkspaceFile,
  openWorkspaceFile,
  setQuickPickValue,
  showFileQuickPick,
  type WorkspaceMainAreaApi,
} from '../WorkspaceMainArea/WorkspaceMainArea.ts'

interface FunctionCallArguments {
  readonly argumentsValue: string
  readonly callId: string
  readonly name: string
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
  return JSON.stringify({
    type: 'response.create',
  })
}

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

const getRequiredString = (
  argumentsValue: Readonly<Record<string, unknown>>,
  name: string,
): string => {
  const value = argumentsValue[name]
  if (typeof value !== 'string') {
    throw new TypeError(`Function tool argument "${name}" must be a string.`)
  }
  return value
}

const getOptionalString = (
  argumentsValue: Readonly<Record<string, unknown>>,
  name: string,
  defaultValue: string,
): string => {
  const value = argumentsValue[name]
  if (value === undefined) {
    return defaultValue
  }
  if (typeof value !== 'string') {
    throw new TypeError(`Function tool argument "${name}" must be a string.`)
  }
  return value
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

const getAlternativeYamlPath = (
  argumentsValue: Readonly<Record<string, unknown>> | undefined,
): string | undefined => {
  const path = argumentsValue?.path
  if (typeof path !== 'string') {
    return undefined
  }
  if (path.endsWith('.yaml')) {
    return `${path.slice(0, -5)}.yml`
  }
  if (path.endsWith('.yml')) {
    return `${path.slice(0, -4)}.yaml`
  }
  return undefined
}

const getToolErrorHint = (
  toolName: string,
  argumentsValue?: Readonly<Record<string, unknown>>,
): string => {
  if (toolName === 'show_file_quick_pick') {
    return 'Call show_file_quick_pick with no arguments: {}.'
  }
  if (toolName === 'set_quick_pick_value') {
    return 'Pass the text to type into the open quick pick, such as {"value":"package.json"}.'
  }
  if (toolName === 'list_workspace_directory') {
    return 'To list the workspace root, call list_workspace_directory with no arguments: {}. To list a subdirectory, pass only a relative path such as {"path":"src"}. Never pass an absolute path or URI.'
  }
  if (toolName === 'search_workspace_files') {
    return 'Pass part or all of a filename, such as {"query":"devcontainer.json"}. Use a returned relative path with open_workspace_file.'
  }
  if (toolName === 'open_workspace_file') {
    const alternativeYamlPath = getAlternativeYamlPath(argumentsValue)
    const yamlHint = alternativeYamlPath
      ? ` Check if the user meant "${alternativeYamlPath}" instead.`
      : ''
    return `Pass an exact file path relative to the workspace, such as {"path":"src/index.ts"}. If the path is unknown or was not found, call search_workspace_files with the filename, then retry with a returned path.${yamlHint}`
  }
  if (['read_workspace_file', 'close_workspace_file'].includes(toolName)) {
    return 'Pass a file path relative to the workspace, such as {"path":"src/index.ts"}. Never pass an absolute path or URI.'
  }
  return 'Pass a file path relative to the workspace and complete file content. Never pass an absolute path or URI.'
}

const readWorkspaceFileTool: FunctionToolDefinition = {
  description:
    'Read a UTF-8 text file from the opened workspace. Use a path returned by list_workspace_directory, or another path relative to the workspace. Never pass an absolute path or URI.',
  name: 'read_workspace_file',
  parameters: {
    additionalProperties: false,
    properties: {
      path: {
        description:
          'Required relative file path, for example "package.json" or "src/index.ts". Do not pass file:// URIs or absolute paths.',
        type: 'string',
      },
    },
    required: ['path'],
    type: 'object',
  },
  type: 'function',
}

const listWorkspaceDirectoryTool: FunctionToolDefinition = {
  description:
    'Use this tool whenever the user asks which files or folders exist in the opened workspace. For the workspace root or top-level files, call it with no arguments: {}. For a subdirectory, pass a relative path such as {"path":"src"}. Never pass an absolute path, URI, or workspace folder name.',
  name: 'list_workspace_directory',
  parameters: {
    additionalProperties: false,
    properties: {
      path: {
        description:
          'Optional relative subdirectory path, for example "src". Omit this property to list the workspace root. Do not pass ".", file:// URIs, absolute paths, or the workspace folder name.',
        type: 'string',
      },
    },
    type: 'object',
  },
  type: 'function',
}

const searchWorkspaceFilesTool: FunctionToolDefinition = {
  description:
    'Search for files by name anywhere in the opened workspace, including hidden folders such as .devcontainer. Git-ignored paths are excluded. Use this before open_workspace_file when the exact relative path is unknown. The result contains relative paths that can be passed directly to open_workspace_file. If no files match, follow the returned hint and search again with a corrected or shorter filename.',
  name: 'search_workspace_files',
  parameters: {
    additionalProperties: false,
    properties: {
      query: {
        description:
          'Part or all of the filename to find, for example "devcontainer.json" or "devcontainer json".',
        type: 'string',
      },
    },
    required: ['query'],
    type: 'object',
  },
  type: 'function',
}

const writeWorkspaceFileTool: FunctionToolDefinition = {
  description:
    'Create or replace a UTF-8 text file in the opened workspace. Call only when the user explicitly asks to create or modify a file. The path must be relative; never pass an absolute path or URI.',
  name: 'write_workspace_file',
  parameters: {
    additionalProperties: false,
    properties: {
      content: {
        description: 'Complete UTF-8 text content to write',
        type: 'string',
      },
      path: {
        description:
          'Required relative file path, for example "src/index.ts". Do not pass file:// URIs or absolute paths.',
        type: 'string',
      },
    },
    required: ['path', 'content'],
    type: 'object',
  },
  type: 'function',
}

const openWorkspaceFileTool: FunctionToolDefinition = {
  description:
    'Open a file from the currently opened workspace in the editor main area. The path must be relative; never pass an absolute path or URI.',
  name: 'open_workspace_file',
  parameters: {
    additionalProperties: false,
    properties: {
      path: {
        description:
          'Required relative file path, for example "src/index.ts". Do not pass file:// URIs or absolute paths.',
        type: 'string',
      },
    },
    required: ['path'],
    type: 'object',
  },
  type: 'function',
}

const closeWorkspaceFileTool: FunctionToolDefinition = {
  description:
    'Close every editor tab showing a file from the currently opened workspace. The path must be relative; never pass an absolute path or URI.',
  name: 'close_workspace_file',
  parameters: {
    additionalProperties: false,
    properties: {
      path: {
        description:
          'Required relative file path, for example "src/index.ts". Do not pass file:// URIs or absolute paths.',
        type: 'string',
      },
    },
    required: ['path'],
    type: 'object',
  },
  type: 'function',
}

const showFileQuickPickTool: FunctionToolDefinition = {
  description:
    'Show the editor file quick pick so the user can interactively search for and open a file from the current workspace.',
  name: 'show_file_quick_pick',
  parameters: {
    additionalProperties: false,
    properties: {},
    type: 'object',
  },
  type: 'function',
}

const setQuickPickValueTool: FunctionToolDefinition = {
  description:
    'Type text into the currently open editor quick pick input. Use this after show_file_quick_pick to filter the displayed files without opening one directly.',
  name: 'set_quick_pick_value',
  parameters: {
    additionalProperties: false,
    properties: {
      value: {
        description: 'The complete text to put in the open quick pick input',
        type: 'string',
      },
    },
    required: ['value'],
    type: 'object',
  },
  type: 'function',
}

export const workspaceFileFunctionTools: readonly FunctionToolDefinition[] = [
  listWorkspaceDirectoryTool,
  searchWorkspaceFilesTool,
  readWorkspaceFileTool,
  writeWorkspaceFileTool,
  openWorkspaceFileTool,
  closeWorkspaceFileTool,
  showFileQuickPickTool,
  setQuickPickValueTool,
]

const workspaceFileFunctionToolNames = workspaceFileFunctionTools.map(
  (tool) => tool.name,
)

export const executeWorkspaceFileFunctionToolCall = async (
  functionCallEvent: unknown,
  fileSystemApi?: WorkspaceFileSystemApi,
  mainAreaApi?: WorkspaceMainAreaApi,
): Promise<readonly string[] | undefined> => {
  const functionCall = parseFunctionCall(functionCallEvent)
  if (
    !functionCall ||
    !workspaceFileFunctionToolNames.includes(functionCall.name)
  ) {
    return undefined
  }
  let output: unknown
  let argumentsValue: Readonly<Record<string, unknown>> | undefined
  try {
    argumentsValue = parseArguments(functionCall.argumentsValue)
    switch (functionCall.name) {
      case 'close_workspace_file':
        output = await closeWorkspaceFile(
          getRequiredString(argumentsValue, 'path'),
          mainAreaApi,
        )
        break
      case 'list_workspace_directory':
        output = await listWorkspaceDirectory(
          getOptionalString(argumentsValue, 'path', '.'),
          fileSystemApi,
        )
        break
      case 'open_workspace_file':
        output = await openWorkspaceFile(
          getRequiredString(argumentsValue, 'path'),
          mainAreaApi,
          fileSystemApi,
        )
        break
      case 'read_workspace_file':
        output = await readWorkspaceFile(
          getRequiredString(argumentsValue, 'path'),
          fileSystemApi,
        )
        break
      case 'search_workspace_files':
        output = await searchWorkspaceFiles(
          getRequiredString(argumentsValue, 'query'),
          fileSystemApi,
        )
        break
      case 'set_quick_pick_value':
        output = await setQuickPickValue(
          getRequiredString(argumentsValue, 'value'),
          mainAreaApi,
        )
        break
      case 'show_file_quick_pick':
        output = await showFileQuickPick(mainAreaApi)
        break
      case 'write_workspace_file':
        output = await writeWorkspaceFile(
          getRequiredString(argumentsValue, 'path'),
          getRequiredString(argumentsValue, 'content'),
          fileSystemApi,
        )
        break
      default:
        throw new Error(`Unknown workspace file tool: ${functionCall.name}`)
    }
  } catch (error) {
    output = {
      error: getErrorMessage(error),
      hint: getToolErrorHint(functionCall.name, argumentsValue),
      tool: functionCall.name,
    }
  }
  return [
    createToolOutputMessage(functionCall.callId, JSON.stringify(output)),
    createFunctionResultResponseMessage(),
  ]
}
