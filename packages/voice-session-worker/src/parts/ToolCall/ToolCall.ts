export interface ParsedToolCall {
  readonly argumentsValue: string
  readonly callId: string
  readonly name: string
}

export const parseToolCall = (value: unknown): ParsedToolCall | undefined => {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    return undefined
  }
  if (
    value.type === 'response.function_call_arguments.done' &&
    'call_id' in value &&
    typeof value.call_id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'arguments' in value &&
    typeof value.arguments === 'string'
  ) {
    return {
      argumentsValue: value.arguments,
      callId: value.call_id,
      name: value.name,
    }
  }
  if (
    value.type === 'response.output_item.done' &&
    'item' in value &&
    value.item &&
    typeof value.item === 'object' &&
    'type' in value.item &&
    value.item.type === 'function_call' &&
    'call_id' in value.item &&
    typeof value.item.call_id === 'string' &&
    'name' in value.item &&
    typeof value.item.name === 'string' &&
    'arguments' in value.item &&
    typeof value.item.arguments === 'string'
  ) {
    return {
      argumentsValue: value.item.arguments,
      callId: value.item.call_id,
      name: value.item.name,
    }
  }
  return undefined
}

export const getToolCallOutput = (
  messages: readonly string[],
  callId: string,
): string => {
  for (const message of messages) {
    let parsed: unknown
    try {
      parsed = JSON.parse(message)
    } catch {
      continue
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      'type' in parsed &&
      parsed.type === 'conversation.item.create' &&
      'item' in parsed &&
      parsed.item &&
      typeof parsed.item === 'object' &&
      'type' in parsed.item &&
      parsed.item.type === 'function_call_output' &&
      'call_id' in parsed.item &&
      parsed.item.call_id === callId &&
      'output' in parsed.item &&
      typeof parsed.item.output === 'string'
    ) {
      return parsed.item.output
    }
  }
  return '(no output)'
}

export const isToolCallErrorOutput = (value: string): boolean => {
  try {
    const parsed: unknown = JSON.parse(value)
    return (
      parsed !== null &&
      typeof parsed === 'object' &&
      (('error' in parsed && typeof parsed.error === 'string') ||
        ('success' in parsed && parsed.success === false))
    )
  } catch {
    return false
  }
}
