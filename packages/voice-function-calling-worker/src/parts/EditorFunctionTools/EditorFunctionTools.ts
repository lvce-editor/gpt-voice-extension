import type { FunctionToolDefinition } from '../FunctionToolRegistry/FunctionToolRegistry.ts'
import * as Rpc from '../Rpc/Rpc.ts'

interface EditorApi {
  readonly formatDocument: () => Promise<void>
  readonly getDiagnostics: () => Promise<readonly unknown[]>
  readonly getEditorSelections: () => Promise<readonly EditorSelection[]>
  readonly setEditorSelections: (
    selections: readonly EditorSelection[],
  ) => Promise<void>
  readonly showCompletions: () => Promise<void>
}

interface EditorSelection {
  readonly endColumnIndex: number
  readonly endRowIndex: number
  readonly startColumnIndex: number
  readonly startRowIndex: number
}

interface ToolSelection {
  readonly endColumn: number
  readonly endLine: number
  readonly startColumn: number
  readonly startLine: number
}

const defaultApi: EditorApi = {
  formatDocument: () => Rpc.invoke<void>('Editor.formatDocument'),
  getDiagnostics: () => Rpc.invoke<readonly unknown[]>('Editor.getDiagnostics'),
  getEditorSelections: () =>
    Rpc.invoke<readonly EditorSelection[]>('Editor.getSelections'),
  setEditorSelections: (selections) =>
    Rpc.invoke<void>('Editor.setSelections', selections),
  showCompletions: () => Rpc.invoke<void>('Editor.showCompletions'),
}

const editorToolNames = [
  'format_document',
  'get_editor_diagnostics',
  'get_editor_selections',
  'set_editor_selections',
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
      'Get every cursor and highlighted range in the active editor. Returned line and column numbers are 1-based.',
    name: 'get_editor_selections',
    parameters: {
      additionalProperties: false,
      properties: {},
      type: 'object',
    },
    type: 'function',
  },
  {
    description:
      'Highlight one or more ranges in the active editor and reveal the final range. Use this after opening a file to show the exact code being discussed. Line and column numbers are 1-based.',
    name: 'set_editor_selections',
    parameters: {
      additionalProperties: false,
      properties: {
        selections: {
          description: 'One or more ranges to highlight in the active editor.',
          items: {
            additionalProperties: false,
            properties: {
              endColumn: {
                description:
                  '1-based column immediately after the highlighted range.',
                minimum: 1,
                type: 'integer',
              },
              endLine: {
                description: '1-based line where the highlighted range ends.',
                minimum: 1,
                type: 'integer',
              },
              startColumn: {
                description:
                  '1-based column where the highlighted range starts.',
                minimum: 1,
                type: 'integer',
              },
              startLine: {
                description: '1-based line where the highlighted range starts.',
                minimum: 1,
                type: 'integer',
              },
            },
            required: ['startLine', 'startColumn', 'endLine', 'endColumn'],
            type: 'object',
          },
          minItems: 1,
          type: 'array',
        },
      },
      required: ['selections'],
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

const getPositiveInteger = (
  selection: Readonly<Record<string, unknown>>,
  key: keyof ToolSelection,
  index: number,
): number => {
  const value = selection[key]
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new TypeError(
      `Function tool selection ${index} property "${key}" must be a positive integer.`,
    )
  }
  return value as number
}

const parseSelections = (
  argumentsValue: Readonly<Record<string, unknown>>,
): readonly ToolSelection[] => {
  const { selections } = argumentsValue
  if (!Array.isArray(selections) || selections.length === 0) {
    throw new TypeError(
      'Function tool argument "selections" must be a non-empty array.',
    )
  }
  return selections.map((selection, index) => {
    if (
      !selection ||
      typeof selection !== 'object' ||
      Array.isArray(selection)
    ) {
      throw new TypeError(`Function tool selection ${index} must be an object.`)
    }
    const selectionValue = selection as Readonly<Record<string, unknown>>
    return {
      endColumn: getPositiveInteger(selectionValue, 'endColumn', index),
      endLine: getPositiveInteger(selectionValue, 'endLine', index),
      startColumn: getPositiveInteger(selectionValue, 'startColumn', index),
      startLine: getPositiveInteger(selectionValue, 'startLine', index),
    }
  })
}

const toEditorSelection = (selection: ToolSelection): EditorSelection => ({
  endColumnIndex: selection.endColumn - 1,
  endRowIndex: selection.endLine - 1,
  startColumnIndex: selection.startColumn - 1,
  startRowIndex: selection.startLine - 1,
})

const toToolSelection = (selection: EditorSelection): ToolSelection => ({
  endColumn: selection.endColumnIndex + 1,
  endLine: selection.endRowIndex + 1,
  startColumn: selection.startColumnIndex + 1,
  startLine: selection.startRowIndex + 1,
})

const execute = async (
  name: EditorToolName,
  argumentsValue: Readonly<Record<string, unknown>>,
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
  if (name === 'get_editor_selections') {
    const editorSelections = await api.getEditorSelections()
    const selections = editorSelections.map(toToolSelection)
    return { count: selections.length, selections }
  }
  if (name === 'set_editor_selections') {
    const selections = parseSelections(argumentsValue)
    await api.setEditorSelections(selections.map(toEditorSelection))
    return { count: selections.length, selected: true, selections }
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
    const argumentsValue = parseArguments(functionCall.argumentsValue)
    output = await execute(functionCall.name, argumentsValue, api)
  } catch (error) {
    output = {
      error: getErrorMessage(error),
      hint:
        functionCall.name === 'set_editor_selections'
          ? 'Pass one or more selections with positive, 1-based startLine, startColumn, endLine, and endColumn values, and make sure a text document is open.'
          : 'Pass no arguments and make sure a text document is open in the active editor.',
      tool: functionCall.name,
    }
  }
  return [
    createToolOutputMessage(functionCall.callId, JSON.stringify(output)),
    JSON.stringify({ type: 'response.create' }),
  ]
}
