import type { FunctionToolDefinition } from '../FunctionToolRegistry/FunctionToolRegistry.ts'
import * as Rpc from '../Rpc/Rpc.ts'

interface FunctionCallArguments {
  readonly argumentsValue: string
  readonly callId: string
}

interface PreviewApi {
  readonly getOpenEditorUris: () => Promise<readonly string[]>
  readonly open: (uri: string) => Promise<void>
}

const defaultApi: PreviewApi = {
  getOpenEditorUris: () =>
    Rpc.invoke<readonly string[]>('MainArea.getOpenEditorUris'),
  open: (uri) => Rpc.invoke<void>('Preview.open', uri),
}

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
    item.name !== 'open_html_preview' ||
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

const parseArguments = (value: string): string | undefined => {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new TypeError('Function tool arguments must be valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Function tool arguments must be a JSON object.')
  }
  const argumentsValue = parsed as Readonly<Record<string, unknown>>
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

const isHtmlUri = (uri: string): boolean => {
  return /\.html?(?:[?#].*)?$/i.test(uri)
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
  return htmlUris[0] as string
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
    const requestedUri = parseArguments(functionCall.argumentsValue)
    const uri = await resolveHtmlUri(requestedUri, api)
    await api.open(uri)
    output = { opened: true }
  } catch (error) {
    output = {
      error: getErrorMessage(error),
      hint: 'Open an HTML editor tab first. Pass its full URI when more than one HTML tab is open.',
      tool: 'open_html_preview',
    }
  }
  return [
    createToolOutputMessage(functionCall.callId, output),
    JSON.stringify({ type: 'response.create' }),
  ]
}
