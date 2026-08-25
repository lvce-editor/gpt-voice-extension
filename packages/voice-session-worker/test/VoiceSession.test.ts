import { afterEach, beforeEach, expect, jest, test } from '@jest/globals'

const invoke =
  jest.fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()

// eslint-disable-next-line jest/no-restricted-jest-methods
jest.unstable_mockModule('../src/parts/Rpc/Rpc.ts', () => ({ invoke }))

const VoiceSession = await import('../src/parts/VoiceSession/VoiceSession.ts')

const updatedStates: unknown[] = []

beforeEach(() => {
  updatedStates.length = 0
  invoke.mockReset().mockImplementation(async (method, ...params) => {
    switch (method) {
      case 'VoiceHost.executeFunctionToolCall':
        return [
          JSON.stringify({
            item: {
              call_id: 'call-1',
              output: '{"files":["src"]}',
              type: 'function_call_output',
            },
            type: 'conversation.item.create',
          }),
          JSON.stringify({ type: 'response.create' }),
        ]
      case 'VoiceHost.getRegisteredTools':
        return []
      case 'VoiceHost.getSecret':
        return 'sk-abcdefghijk'
      case 'VoiceHost.resolveBackendConfiguration':
        return undefined
      case 'VoiceHost.updateState':
        updatedStates.push(params[1])
        return undefined
      default:
        return undefined
    }
  })
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

test('owns view state and common voice actions behind dispatch', async () => {
  const initial = await VoiceSession.create(1, true, 'byok')
  expect(initial).toEqual(
    expect.objectContaining({
      hasOpenAiApiKey: true,
      inProgress: false,
      voiceProvider: 'byok',
    }),
  )

  await VoiceSession.dispatch(1, 'inputApiKey', 'sk-replacement-key')
  await VoiceSession.dispatch(1, 'saveApiKey')
  await VoiceSession.dispatch(1, 'addTranscript', 'one', 'Hello', 'user')
  const started = await VoiceSession.dispatch(1, 'start')

  expect(started.inProgress).toBe(true)
  const { messages: startedMessages } = started
  expect(startedMessages).toContainEqual({
    id: 'one',
    text: 'Hello',
    type: 'user',
  })
  expect(invoke).toHaveBeenCalledWith(
    'VoiceHost.storeSecret',
    'builtin.gpt-voice.openai-api-key',
    'sk-replacement-key',
  )
  expect(invoke).not.toHaveBeenCalledWith(
    'VoiceHost.startWebRtc',
    expect.anything(),
    expect.anything(),
    expect.anything(),
  )

  const stopped = await VoiceSession.dispatch(1, 'stop')
  expect(stopped.inProgress).toBe(false)
  await VoiceSession.dispose(1)
})

test('processes transcript and tool events inside the worker', async () => {
  await VoiceSession.create(2, true, 'byok')
  await VoiceSession.dispatch(
    2,
    'data',
    JSON.stringify({
      delta: 'Hello',
      item_id: 'transcript-1',
      type: 'response.output_audio_transcript.delta',
    }),
  )
  const state = await VoiceSession.dispatch(
    2,
    'data',
    JSON.stringify({
      arguments: '{"path":"src"}',
      call_id: 'call-1',
      name: 'list_workspace_directory',
      type: 'response.function_call_arguments.done',
    }),
  )

  const { messages } = state
  expect(messages).toContainEqual({
    id: 'transcript-1',
    text: 'Hello',
    type: 'ai',
  })
  expect(messages).toContainEqual(
    expect.objectContaining({
      id: 'call-1',
      output: '{"files":["src"]}',
      status: 'completed',
      type: 'tool',
    }),
  )
  expect(invoke).toHaveBeenCalledWith(
    'VoiceHost.executeFunctionToolCall',
    expect.objectContaining({ call_id: 'call-1' }),
  )
  expect(updatedStates.length).toBeGreaterThan(0)
  await VoiceSession.dispose(2)
})

test('handles API key validation and rejects unknown actions', async () => {
  await VoiceSession.create(3, true, 'byok')
  await VoiceSession.dispatch(3, 'inputApiKey', 'invalid')
  const invalid = await VoiceSession.dispatch(3, 'saveApiKey')
  expect(invalid.apiKeyError).toBe('OpenAI API key format looks invalid.')

  await expect(VoiceSession.dispatch(3, 'unknown')).rejects.toThrow(
    'Unknown voice session action: unknown',
  )
  await VoiceSession.dispose(3)
  await expect(VoiceSession.dispatch(3, 'start')).rejects.toThrow(
    'Voice session not found: 3',
  )
})
