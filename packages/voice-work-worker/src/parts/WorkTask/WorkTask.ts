import type {
  FunctionToolDefinition,
  VoiceWorkConfiguration,
  VoiceWorkResult,
  VoiceWorkToolCallEvent,
} from 'voice-shared'
import * as Rpc from '../Rpc/Rpc.ts'

const model = 'gpt-5.6-luna'
const maxToolCalls = 50

const instructions = `You are the execution worker behind a voice coding assistant. Complete the user's entire task autonomously with the provided editor and workspace tools.

- Inspect the relevant workspace state before changing it and preserve existing project conventions.
- Use tools to perform the work; do not merely describe code the user asked you to create or modify.
- Make reasonable assumptions when details are minor. Do not ask the user questions.
- For frontend artifacts, create a deliberate, polished composition with clearly recognizable requested elements, responsive layout, and accessible markup. Preview the result and fix runtime diagnostics when those tools are available.
- Validate completed changes in proportion to the task. Resolve tool errors when possible.
- Finish with a short factual summary suitable for a voice assistant to narrate. Set success to false if the requested work remains incomplete.`

interface WorkOptions {
  readonly configuration: VoiceWorkConfiguration
  readonly task: string
  readonly tools: readonly FunctionToolDefinition[]
  readonly workId: number
}

interface FunctionCall {
  readonly argumentsValue: string
  readonly callId: string
  readonly item: Readonly<Record<string, unknown>>
  readonly name: string
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const getErrorMessage = (value: unknown, fallback: string): string => {
  if (!isRecord(value)) {
    return fallback
  }
  if (typeof value.error === 'string' && value.error) {
    return value.error
  }
  if (isRecord(value.error) && typeof value.error.message === 'string') {
    return value.error.message
  }
  if (typeof value.message === 'string' && value.message) {
    return value.message
  }
  return fallback
}

const getFunctionCalls = (
  output: readonly unknown[],
): readonly FunctionCall[] => {
  const calls: FunctionCall[] = []
  for (const item of output) {
    if (
      !isRecord(item) ||
      item.type !== 'function_call' ||
      typeof item.call_id !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.arguments !== 'string'
    ) {
      continue
    }
    calls.push({
      argumentsValue: item.arguments,
      callId: item.call_id,
      item,
      name: item.name,
    })
  }
  return calls
}

const getOutputText = (response: Readonly<Record<string, unknown>>): string => {
  if (typeof response.output_text === 'string') {
    return response.output_text
  }
  const output = Array.isArray(response.output) ? response.output : []
  let text = ''
  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      continue
    }
    for (const part of item.content) {
      if (
        isRecord(part) &&
        part.type === 'output_text' &&
        typeof part.text === 'string'
      ) {
        text += part.text
      }
    }
  }
  return text
}

const parseWorkResult = (text: string): VoiceWorkResult => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('The coding model returned an invalid completion summary.')
  }
  if (
    !isRecord(parsed) ||
    typeof parsed.success !== 'boolean' ||
    typeof parsed.summary !== 'string' ||
    !parsed.summary.trim()
  ) {
    throw new Error('The coding model returned an invalid completion summary.')
  }
  return {
    success: parsed.success,
    summary: parsed.summary.trim(),
  }
}

const reportToolCall = async (
  workId: number,
  event: VoiceWorkToolCallEvent,
): Promise<void> => {
  try {
    await Rpc.invoke('VoiceWorkHost.reportToolCall', workId, event)
  } catch (error) {
    console.error(error)
  }
}

const executeTool = async (
  workId: number,
  call: FunctionCall,
): Promise<string> => {
  await reportToolCall(workId, {
    argumentsValue: call.argumentsValue,
    callId: call.callId,
    name: call.name,
    type: 'started',
  })
  let output: string
  try {
    output = await Rpc.invoke<string>(
      'VoiceWorkHost.executeFunctionTool',
      call.name,
      call.argumentsValue,
    )
  } catch (error) {
    output = JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      success: false,
    })
  }
  await reportToolCall(workId, {
    callId: call.callId,
    output,
    type: 'completed',
  })
  return output
}

const getResponseData = async (
  configuration: VoiceWorkConfiguration,
  input: readonly unknown[],
  tools: readonly FunctionToolDefinition[],
): Promise<Readonly<Record<string, unknown>>> => {
  const response = await fetch(configuration.endpoint, {
    body: JSON.stringify({
      input,
      instructions,
      max_tool_calls: maxToolCalls,
      model,
      parallel_tool_calls: false,
      reasoning: {
        effort: 'medium',
      },
      store: false,
      text: {
        format: {
          name: 'voice_work_result',
          schema: {
            additionalProperties: false,
            properties: {
              success: { type: 'boolean' },
              summary: { type: 'string' },
            },
            required: ['success', 'summary'],
            type: 'object',
          },
          strict: true,
          type: 'json_schema',
        },
      },
      tool_choice: 'auto',
      tools,
    }),
    headers: {
      Authorization: `Bearer ${configuration.accessToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error(`Coding request failed (${response.status}).`)
  }
  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, `Coding request failed (${response.status}).`),
    )
  }
  if (!isRecord(data)) {
    throw new Error('The coding model returned an invalid response.')
  }
  return data
}

const run = async (options: WorkOptions): Promise<VoiceWorkResult> => {
  const { configuration, task, tools, workId } = options
  if (!task.trim()) {
    throw new TypeError('The delegated task must not be empty.')
  }
  if (!configuration.endpoint || !configuration.accessToken) {
    throw new Error('Coding model authentication is unavailable.')
  }
  let input: readonly unknown[] = [
    {
      content: [{ text: task.trim(), type: 'input_text' }],
      role: 'user',
    },
  ]
  let toolCallCount = 0

  while (true) {
    const response = await getResponseData(configuration, input, tools)
    const output = Array.isArray(response.output) ? response.output : []
    const functionCalls = getFunctionCalls(output)
    if (functionCalls.length === 0) {
      if (response.status !== undefined && response.status !== 'completed') {
        throw new Error(
          getErrorMessage(
            response.error,
            'The coding model did not complete the task.',
          ),
        )
      }
      return parseWorkResult(getOutputText(response))
    }

    toolCallCount += functionCalls.length
    if (toolCallCount > maxToolCalls) {
      throw new Error('The coding task exceeded the tool-call limit.')
    }
    const toolOutputs = []
    for (const call of functionCalls) {
      toolOutputs.push({
        call_id: call.callId,
        output: await executeTool(workId, call),
        type: 'function_call_output',
      })
    }
    input = [...input, ...output, ...toolOutputs]
  }
}

export const execute = async (
  options: WorkOptions,
): Promise<VoiceWorkResult> => {
  try {
    return await run(options)
  } catch (error) {
    return {
      success: false,
      summary: error instanceof Error ? error.message : String(error),
    }
  }
}
