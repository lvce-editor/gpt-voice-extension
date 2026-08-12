import type { FunctionToolDefinition } from '../FunctionToolRegistry/FunctionToolRegistry.ts'
import * as Rpc from '../Rpc/Rpc.ts'

interface FunctionCallArguments {
  readonly argumentsValue: string
  readonly callId: string
  readonly name: PreviewToolName
}

interface PreviewApi {
  readonly getOpenEditorUris: () => Promise<readonly string[]>
  readonly getRuntimeDiagnostics: () => Promise<unknown>
  readonly open: (uri: string) => Promise<void>
}

const defaultApi: PreviewApi = {
  getOpenEditorUris: () =>
    Rpc.invoke<readonly string[]>('MainArea.getOpenEditorUris'),
  getRuntimeDiagnostics: () =>
    Rpc.invoke<unknown>('Preview.getRuntimeDiagnostics'),
  open: (uri) => Rpc.invoke<void>('Preview.open', uri),
}

const htmlUriRegex = /\.html?(?:[?#].*)?$/i
const previewToolNames = [
  'get_preview_runtime_diagnostics',
  'open_html_preview',
] as const
type PreviewToolName = (typeof previewToolNames)[number]

export const previewFunctionTools: readonly FunctionToolDefinition[] = [
  {
    description:
      'Open an HTML file in the LVCE Editor preview area. Omit uri when exactly one HTML editor tab is open. If multiple HTML tabs are open, use get_open_editor_tabs and pass the desired tab URI.',
    name: 'open_html_preview',
    parameters: {
      additionalProperties: false,
      properties: {
        uri: {
          description:
            'Optional full URI of an open .html or .htm editor tab to preview.',
          type: 'string',
        },
      },
      type: 'object',
    },
    type: 'function',
  },
  {
    description:
      'Get recent console output and uncaught exceptions from the active LVCE Editor preview. Call this after creating or modifying preview code and refreshing the preview, then fix any reported runtime errors before finishing.',
    name: 'get_preview_runtime_diagnostics',
    parameters: {
      additionalProperties: false,
      properties: {},
      type: 'object',
    },
    type: 'function',
  },
]

const isPreviewToolName = (value: unknown): value is PreviewToolName => {
  return (
    typeof value === 'string' &&
    previewToolNames.includes(value as PreviewToolName)
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
    !isPreviewToolName(item.name) ||
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

const parseOpenArguments = (value: string): string | undefined => {
  const argumentsValue = parseArguments(value)
  const unexpectedKey = Object.keys(argumentsValue).find((key) => key !== 'uri')
  if (unexpectedKey) {
    throw new TypeError(
      `Function tool argument "${unexpectedKey}" is not supported.`,
    )
  }
  const { uri } = argumentsValue
  if (uri === undefined) {
    return undefined
  }
  if (typeof uri !== 'string' || !uri.trim()) {
    throw new TypeError('Function tool argument "uri" must be a string.')
  }
  return uri
}

const parseEmptyArguments = (value: string): void => {
  const argumentsValue = parseArguments(value)
  const unexpectedKey = Object.keys(argumentsValue)[0]
  if (unexpectedKey) {
    throw new TypeError(
      `Function tool argument "${unexpectedKey}" is not supported.`,
    )
  }
}

const isHtmlUri = (uri: string): boolean => {
  return htmlUriRegex.test(uri)
}

const resolveHtmlUri = async (
  requestedUri: string | undefined,
  api: PreviewApi,
): Promise<string> => {
  if (requestedUri !== undefined) {
    if (!isHtmlUri(requestedUri)) {
      throw new TypeError(
        'The preview URI must reference an .html or .htm file.',
      )
    }
    return requestedUri
  }
  const openEditorUris = await api.getOpenEditorUris()
  const htmlUris = openEditorUris.filter(isHtmlUri)
  if (htmlUris.length === 0) {
    throw new Error('No open HTML editor tab was found.')
  }
  if (htmlUris.length > 1) {
    throw new Error(
      'Multiple HTML editor tabs are open. Pass the URI of the file to preview.',
    )
  }
  return htmlUris[0]
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

export const executePreviewFunctionToolCall = async (
  functionCallEvent: unknown,
  api: PreviewApi = defaultApi,
): Promise<readonly string[] | undefined> => {
  const functionCall = parseFunctionCall(functionCallEvent)
  if (!functionCall) {
    return undefined
  }
  let output: unknown
  try {
    if (functionCall.name === 'get_preview_runtime_diagnostics') {
      parseEmptyArguments(functionCall.argumentsValue)
      output = await api.getRuntimeDiagnostics()
    } else {
      const requestedUri = parseOpenArguments(functionCall.argumentsValue)
      const uri = await resolveHtmlUri(requestedUri, api)
      await api.open(uri)
      output = { opened: true }
    }
  } catch (error) {
    output = {
      error: getErrorMessage(error),
      hint:
        functionCall.name === 'get_preview_runtime_diagnostics'
          ? 'Open an HTML preview first, then retry after the preview has loaded.'
          : 'Open an HTML editor tab first. Pass its full URI when more than one HTML tab is open.',
      tool: functionCall.name,
    }
  }
  return [
    createToolOutputMessage(functionCall.callId, output),
    JSON.stringify({ type: 'response.create' }),
  ]
}
