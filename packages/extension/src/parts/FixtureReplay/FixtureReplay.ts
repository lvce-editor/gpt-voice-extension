export interface FixtureTraceEntry {
  readonly atMs: number
  readonly direction: 'client' | 'server'
  readonly event: Readonly<Record<string, unknown>>
}

export interface VoiceFixture {
  readonly schemaVersion: 1
  readonly trace: readonly FixtureTraceEntry[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }
  if (!isRecord(value)) {
    return value
  }
  const result: Record<string, unknown> = {}
  const keys = Object.keys(value).toSorted((a, b) => a.localeCompare(b))
  for (const key of keys) {
    result[key] = canonicalize(value[key])
  }
  return result
}

const stringifyCanonical = (value: unknown): string => {
  return JSON.stringify(canonicalize(value))
}

export const validateFixture = (value: unknown): VoiceFixture => {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new TypeError('Voice fixture schemaVersion must be 1')
  }
  if (!Array.isArray(value.trace)) {
    throw new TypeError('Voice fixture trace must be an array')
  }
  for (const [index, entry] of value.trace.entries()) {
    if (!isRecord(entry)) {
      throw new TypeError(
        `Voice fixture trace entry ${index} must be an object`,
      )
    }
    if (entry.direction !== 'client' && entry.direction !== 'server') {
      throw new TypeError(
        `Voice fixture trace entry ${index} has an invalid direction`,
      )
    }
    if (typeof entry.atMs !== 'number' || !Number.isFinite(entry.atMs)) {
      throw new TypeError(
        `Voice fixture trace entry ${index} has an invalid timestamp`,
      )
    }
    if (!isRecord(entry.event)) {
      throw new TypeError(
        `Voice fixture trace entry ${index} event must be an object`,
      )
    }
  }
  return value as unknown as VoiceFixture
}

export interface FixtureReplay {
  readonly acceptClientMessage: (data: string) => void
  readonly run: (
    handleServerMessage: (data: string) => Promise<void>,
  ) => Promise<void>
}

export const createFixtureReplay = (value: unknown): FixtureReplay => {
  const fixture = validateFixture(value)
  const actualClientEvents: unknown[] = []

  const acceptClientMessage = (data: string): void => {
    try {
      actualClientEvents.push(JSON.parse(data))
    } catch {
      throw new TypeError('Fixture replay received invalid client JSON')
    }
  }

  const run = async (
    handleServerMessage: (data: string) => Promise<void>,
  ): Promise<void> => {
    for (const [index, entry] of fixture.trace.entries()) {
      if (entry.direction === 'server') {
        await handleServerMessage(JSON.stringify(entry.event))
        continue
      }
      const actual = actualClientEvents.shift()
      if (actual === undefined) {
        throw new Error(`Missing client event at fixture trace entry ${index}`)
      }
      const expectedValue = stringifyCanonical(entry.event)
      const actualValue = stringifyCanonical(actual)
      if (actualValue !== expectedValue) {
        throw new Error(
          `Client event mismatch at fixture trace entry ${index}: expected ${expectedValue}, received ${actualValue}`,
        )
      }
    }
    if (actualClientEvents.length > 0) {
      throw new Error(
        `Fixture replay produced ${actualClientEvents.length} unexpected client event(s)`,
      )
    }
  }

  return {
    acceptClientMessage,
    run,
  }
}
