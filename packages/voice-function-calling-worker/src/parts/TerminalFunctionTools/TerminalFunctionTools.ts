import type { FunctionToolDefinition } from '../FunctionToolRegistry/FunctionToolRegistry.ts'
import * as Rpc from '../Rpc/Rpc.ts'

interface FunctionCallArguments {
  readonly argumentsValue: string
  readonly callId: string
}

interface TerminalApi {
  readonly executeBash: (command: string) => Promise<unknown>
}

const defaultApi: TerminalApi = {
  executeBash: (command) => Rpc.invoke('Terminal.executeBash', command),
}

const executeBashTool: FunctionToolDefinition = {
  description:
    'Execute a Bash command in the opened workspace. This tool is available only because the user explicitly enabled terminal access. Use it when the user asks to run a command or when a coding task requires inspecting, building, testing, or modifying the workspace.',
  name: 'execute_bash',
  parameters: {
    additionalProperties: false,
    properties: {
      command: {
        description: 'The complete Bash command to execute.',
        type: 'string',
      },
    },
    required: ['command'],
    type: 'object',
  },
  type: 'function',
}

export const terminalFunctionTools: readonly FunctionToolDefinition[] = [
  executeBashTool,
]

const parseFunctionCall = (
  value: unknown,
): FunctionCallArguments | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  if (
    'type' in value &&
    value.type === 'response.function_call_arguments.done' &&
    'call_id' in value &&
    typeof value.call_id === 'string' &&
    'name' in value &&
    value.name === 'execute_bash' &&
    'arguments' in value &&
    typeof value.arguments === 'string'
  ) {
    return { argumentsValue: value.arguments, callId: value.call_id }
  }
  if (
    'type' in value &&
    value.type === 'response.output_item.done' &&
    'item' in value &&
    value.item &&
    typeof value.item === 'object' &&
    'type' in value.item &&
    value.item.type === 'function_call' &&
    'call_id' in value.item &&
    typeof value.item.call_id === 'string' &&
    'name' in value.item &&
    value.item.name === 'execute_bash' &&
    'arguments' in value.item &&
    typeof value.item.arguments === 'string'
  ) {
    return { argumentsValue: value.item.arguments, callId: value.item.call_id }
  }
  return undefined
}

const parseCommand = (value: string): string => {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new TypeError('Function tool arguments must be valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Function tool arguments must be a JSON object.')
  }
  const { command } = parsed as Readonly<Record<string, unknown>>
  if (typeof command !== 'string' || !command.trim()) {
    throw new TypeError(
      'Function tool argument "command" must be a non-empty string.',
    )
  }
  return command
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

export const executeTerminalFunctionToolCall = async (
  functionCallEvent: unknown,
  api: TerminalApi = defaultApi,
): Promise<readonly string[] | undefined> => {
  const functionCall = parseFunctionCall(functionCallEvent)
  if (!functionCall) {
    return undefined
  }
  let output: unknown
  try {
    output = await api.executeBash(parseCommand(functionCall.argumentsValue))
  } catch (error) {
    output = {
      error: getErrorMessage(error),
      hint: 'The terminal tool requires an opened local workspace and the gptvoice.tools.terminal.enabled setting.',
      tool: 'execute_bash',
    }
  }
  return [
    createToolOutputMessage(functionCall.callId, output),
    JSON.stringify({ type: 'response.create' }),
  ]
}
