import type { FunctionToolDefinition } from '../FunctionToolRegistry/FunctionToolRegistry.ts'
import * as Rpc from '../Rpc/Rpc.ts'

interface EditorApi {
  readonly formatDocument: () => Promise<void>
  readonly getDiagnostics: () => Promise<readonly unknown[]>
  readonly showCompletions: () => Promise<void>
}

const defaultApi: EditorApi = {
  formatDocument: () => Rpc.invoke<void>('Editor.formatDocument'),
  getDiagnostics: () => Rpc.invoke<readonly unknown[]>('Editor.getDiagnostics'),
  showCompletions: () => Rpc.invoke<void>('Editor.showCompletions'),
}

const editorToolNames = [
  'format_document',
  'get_editor_diagnostics',
  'show_completions',
] as const
type EditorToolName = (typeof editorToolNames)[number]

interface FunctionCallArguments {
  readonly argumentsValue: string
  readonly callId: string
  readonly name: EditorToolName
}

export const editorFunctionTools: readonly FunctionToolDefinition[] = [
  {
    description:
      'Format the document in the currently active editor using its registered formatter.',
    name: 'format_document',
    parameters: {
      additionalProperties: false,
      properties: {},
      type: 'object',
    },
    type: 'function',
  },
  {
    description:
      'Get the current lint, type-checking, and other diagnostics for the document in the active editor. Use this before claiming that the open code has no errors or warnings.',
    name: 'get_editor_diagnostics',
    parameters: {
      additionalProperties: false,
      properties: {},
      type: 'object',
    },
    type: 'function',
  },
  {
    description:
      'Show smart completion suggestions at the current cursor position in the active editor.',
    name: 'show_completions',
    parameters: {
      additionalProperties: false,
      properties: {},
      type: 'object',
    },
    type: 'function',
  },
]

const isEditorToolName = (value: unknown): value is EditorToolName => {
  return (
    typeof value === 'string' &&
    editorToolNames.includes(value as EditorToolName)
  )
}

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
    !isEditorToolName(item.name) ||
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

const parseArguments = (value: string): void => {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new TypeError('Function tool arguments must be valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Function tool arguments must be a JSON object.')
  }
}

const execute = async (
  name: EditorToolName,
  api: EditorApi,
): Promise<unknown> => {
  if (name === 'format_document') {
    await api.formatDocument()
    return { formatted: true }
  }
  if (name === 'get_editor_diagnostics') {
    const diagnostics = await api.getDiagnostics()
    return { count: diagnostics.length, diagnostics }
  }
  await api.showCompletions()
  return { shown: true }
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

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error)
}

export const executeEditorFunctionToolCall = async (
  functionCallEvent: unknown,
  api: EditorApi = defaultApi,
): Promise<readonly string[] | undefined> => {
  const functionCall = parseFunctionCall(functionCallEvent)
  if (!functionCall) {
    return undefined
  }
  let output: unknown
  try {
    parseArguments(functionCall.argumentsValue)
    output = await execute(functionCall.name, api)
  } catch (error) {
    output = {
      error: getErrorMessage(error),
      hint: 'Pass no arguments and make sure a text document is open in the active editor.',
      tool: functionCall.name,
    }
  }
  return [
    createToolOutputMessage(functionCall.callId, JSON.stringify(output)),
    JSON.stringify({ type: 'response.create' }),
  ]
}
