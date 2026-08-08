import type { FixtureTraceEntry } from '../FixtureReplay/FixtureReplay.ts'

export interface FixtureRecording {
  readonly recordClientMessage: (data: string) => void
  readonly recordServerEvent: (event: unknown) => void
  readonly snapshot: () => readonly FixtureTraceEntry[]
  readonly waitForCompletion: () => Promise<void>
}

interface FixtureRecordingOptions {
  readonly clearTimer?: (timer: unknown) => void
  readonly now?: () => number
  readonly setTimer?: (callback: () => void, timeout: number) => unknown
  readonly timeoutMs?: number
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const getToolCallId = (
  event: Readonly<Record<string, unknown>>,
): string | undefined => {
  if (
    event.type === 'response.function_call_arguments.done' &&
    typeof event.call_id === 'string'
  ) {
    return event.call_id
  }
  if (
    event.type === 'response.output_item.done' &&
    isRecord(event.item) &&
    event.item.type === 'function_call' &&
    typeof event.item.call_id === 'string'
  ) {
    return event.item.call_id
  }
  return undefined
}

export const createFixtureRecording = (
  options: FixtureRecordingOptions = {},
): FixtureRecording => {
  const now = options.now ?? ((): number => performance.now())
  const clearTimer =
    options.clearTimer ??
    ((timer: unknown): void => {
      clearTimeout(timer as ReturnType<typeof setTimeout>)
    })
  const setTimer = options.setTimer ?? setTimeout
  const timeoutMs = options.timeoutMs ?? 45_000
  const startedAt = now()
  const trace: FixtureTraceEntry[] = []
  let assistantTranscriptAt = -1
  let inputTranscriptSeen = false
  let lastResponseCreateAt = -1
  const pendingToolCalls = new Set<string>()
  const toolOutputs = new Set<string>()
  const { promise, reject, resolve } = Promise.withResolvers<void>()

  const timer = setTimer(() => {
    const error = new Error(
      `Timed out recording voice fixture after ${timeoutMs}ms`,
    )
    reject(error)
  }, timeoutMs)

  const finish = (): void => {
    clearTimer(timer)
    resolve()
  }

  const addEntry = (
    direction: 'client' | 'server',
    event: Readonly<Record<string, unknown>>,
  ): void => {
    const elapsed = now() - startedAt
    const atMs = Math.max(0, Math.round(elapsed))
    trace.push({
      atMs,
      direction,
      event,
    })
  }

  const recordClientMessage = (data: string): void => {
    const parsed: unknown = JSON.parse(data)
    if (!isRecord(parsed)) {
      throw new TypeError('Recorded client event must be an object')
    }
    addEntry('client', parsed)
    if (
      parsed.type === 'conversation.item.create' &&
      isRecord(parsed.item) &&
      parsed.item.type === 'function_call_output' &&
      typeof parsed.item.call_id === 'string'
    ) {
      toolOutputs.add(parsed.item.call_id)
    }
    if (parsed.type === 'response.create') {
      for (const callId of toolOutputs) {
        pendingToolCalls.delete(callId)
      }
      toolOutputs.clear()
      lastResponseCreateAt = now() - startedAt
    }
  }

  const recordServerEvent = (event: unknown): void => {
    if (!isRecord(event)) {
      throw new TypeError('Recorded server event must be an object')
    }
    addEntry('server', event)
    const toolCallId = getToolCallId(event)
    if (toolCallId) {
      pendingToolCalls.add(toolCallId)
    }
    if (event.type === 'conversation.item.input_audio_transcription.delta') {
      inputTranscriptSeen = true
    } else if (event.type === 'response.output_audio_transcript.delta') {
      assistantTranscriptAt = now() - startedAt
    }
    if (
      event.type === 'response.done' &&
      inputTranscriptSeen &&
      pendingToolCalls.size === 0 &&
      assistantTranscriptAt >= 0 &&
      assistantTranscriptAt >= lastResponseCreateAt
    ) {
      finish()
    }
  }

  return {
    recordClientMessage,
    recordServerEvent,
    snapshot(): readonly FixtureTraceEntry[] {
      return structuredClone(trace)
    },
    waitForCompletion(): Promise<void> {
      return promise
    },
  }
}
