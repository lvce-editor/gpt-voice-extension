export interface TraceEntry {
  readonly atMs: number
  readonly direction: 'client' | 'server'
  readonly event: Readonly<Record<string, unknown>>
}

export interface RawRecording {
  readonly error?: string
  readonly source: Readonly<Record<string, unknown>>
  readonly trace: readonly TraceEntry[]
}

interface NormalizedToolCall {
  readonly arguments: unknown
  readonly callId: unknown
  readonly name: string
  readonly output?: unknown
}

export interface NormalizedRecording {
  readonly expect: {
    readonly assistantText: string
    readonly toolCalls: readonly Omit<NormalizedToolCall, 'callId'>[]
    readonly userText: string
  }
  readonly name: unknown
  readonly schemaVersion: 1
  readonly source: Readonly<Record<string, unknown>>
  readonly trace: readonly TraceEntry[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const parseJsonObject = (
  value: unknown,
): Record<string, unknown> | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  try {
    const parsed: unknown = JSON.parse(value)
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

class RecordingNormalizer {
  private readonly assistantText: string[] = []
  private readonly counters: Record<string, number> = Object.create(null)
  private readonly ids = new Map<string, string>()
  private readonly toolCalls: NormalizedToolCall[] = []
  private readonly trace: TraceEntry[] = []
  private readonly userText: string[] = []

  private addToolCall(
    callId: unknown,
    name: string,
    argumentsValue: string,
  ): void {
    if (this.toolCalls.some((toolCall) => toolCall.callId === callId)) {
      return
    }
    this.toolCalls.push({
      arguments: parseJsonObject(argumentsValue) ?? argumentsValue,
      callId,
      name,
    })
  }

  private normalizeClientToolOutput(entry: TraceEntry): boolean {
    const { event } = entry
    if (
      entry.direction !== 'client' ||
      event.type !== 'conversation.item.create' ||
      !isRecord(event.item) ||
      event.item.type !== 'function_call_output'
    ) {
      return false
    }
    const callId = this.normalizeId(event.item.call_id, 'call')
    this.trace.push({
      ...entry,
      event: {
        item: {
          call_id: callId,
          output: event.item.output,
          type: 'function_call_output',
        },
        type: 'conversation.item.create',
      },
    })
    const toolCallIndex = this.toolCalls.findIndex(
      (toolCall) => toolCall.callId === callId,
    )
    const toolCall = this.toolCalls[toolCallIndex]
    if (toolCall) {
      this.toolCalls[toolCallIndex] = {
        ...toolCall,
        output: parseJsonObject(event.item.output) ?? event.item.output,
      }
    }
    return true
  }

  private normalizeFunctionCallArguments(entry: TraceEntry): boolean {
    const { event } = entry
    if (
      entry.direction !== 'server' ||
      event.type !== 'response.function_call_arguments.done' ||
      typeof event.call_id !== 'string' ||
      typeof event.name !== 'string' ||
      typeof event.arguments !== 'string'
    ) {
      return false
    }
    const callId = this.normalizeId(event.call_id, 'call')
    this.trace.push({
      ...entry,
      event: {
        arguments: event.arguments,
        call_id: callId,
        name: event.name,
        type: event.type,
      },
    })
    this.addToolCall(callId, event.name, event.arguments)
    return true
  }

  private normalizeId(value: unknown, kind: string): unknown {
    if (typeof value !== 'string') {
      return value
    }
    const existing = this.ids.get(value)
    if (existing) {
      return existing
    }
    this.counters[kind] = (this.counters[kind] ?? 0) + 1
    const normalized = `${kind}_${this.counters[kind]}`
    this.ids.set(value, normalized)
    return normalized
  }

  private normalizeOutputItem(entry: TraceEntry): boolean {
    const { event } = entry
    if (
      entry.direction !== 'server' ||
      event.type !== 'response.output_item.done' ||
      !isRecord(event.item) ||
      event.item.type !== 'function_call' ||
      typeof event.item.call_id !== 'string' ||
      typeof event.item.name !== 'string' ||
      typeof event.item.arguments !== 'string'
    ) {
      return false
    }
    const callId = this.normalizeId(event.item.call_id, 'call')
    this.trace.push({
      ...entry,
      event: {
        item: {
          arguments: event.item.arguments,
          call_id: callId,
          name: event.item.name,
          type: 'function_call',
        },
        type: event.type,
      },
    })
    this.addToolCall(callId, event.item.name, event.item.arguments)
    return true
  }

  private normalizeTranscript(entry: TraceEntry): boolean {
    const { event } = entry
    if (
      entry.direction !== 'server' ||
      (event.type !== 'conversation.item.input_audio_transcription.delta' &&
        event.type !== 'response.output_audio_transcript.delta') ||
      typeof event.delta !== 'string'
    ) {
      return false
    }
    this.trace.push({
      ...entry,
      event: {
        delta: event.delta,
        item_id: this.normalizeId(event.item_id, 'item'),
        type: event.type,
      },
    })
    const transcript =
      event.type === 'conversation.item.input_audio_transcription.delta'
        ? this.userText
        : this.assistantText
    transcript.push(event.delta)
    return true
  }

  normalizeEntry(entry: TraceEntry): void {
    if (
      this.normalizeTranscript(entry) ||
      this.normalizeFunctionCallArguments(entry) ||
      this.normalizeOutputItem(entry) ||
      this.normalizeClientToolOutput(entry)
    ) {
      return
    }
    if (
      entry.direction === 'client' &&
      entry.event.type === 'response.create'
    ) {
      this.trace.push({ ...entry, event: { type: 'response.create' } })
    }
  }

  toFixture(source: Readonly<Record<string, unknown>>): NormalizedRecording {
    if (this.trace.length === 0 || this.userText.length === 0) {
      throw new Error('Recording did not contain a usable voice turn')
    }
    return {
      expect: {
        assistantText: this.assistantText.join(''),
        toolCalls: this.toolCalls.map(({ callId, ...toolCall }) => toolCall),
        userText: this.userText.join(''),
      },
      name: source.name,
      schemaVersion: 1,
      source,
      trace: this.trace,
    }
  }
}

export const normalizeRecording = (
  recording: RawRecording,
): NormalizedRecording => {
  if (recording.error) {
    throw new Error(`Voice fixture recording failed: ${recording.error}`)
  }
  const normalizer = new RecordingNormalizer()
  for (const entry of recording.trace) {
    normalizer.normalizeEntry(entry)
  }
  return normalizer.toFixture(recording.source)
}
