import { afterEach, expect, jest, test } from '@jest/globals'
import {
  createSessionConfig,
  getEphemeralKey,
  getOpenAiErrorMessage,
  getSdp,
  RealtimeModelPreset,
} from '../src/parts/WebRtc/WebRtc.ts'

afterEach(() => {
  jest.restoreAllMocks()
})

test('createSessionConfig - includes registered function tools', () => {
  const tools = [
    {
      description: 'Test tool',
      name: 'test',
      parameters: { type: 'object' },
      type: 'function' as const,
    },
  ]

  const config = createSessionConfig(RealtimeModelPreset.Standard, tools)

  expect(config.session.tools).toBe(tools)
  expect(config.session.instructions).toContain(
    'Whenever the user asks you to create, modify, inspect, debug, test, run, open, configure, or otherwise perform work in the editor or workspace, call do_work exactly once with their complete request.',
  )
  expect(config.session.instructions).toContain(
    'Wait for the tool result, then narrate its success and summary accurately.',
  )
  expect(config.session.instructions).toContain(
    'Never claim the work is complete before do_work reports success.',
  )
  expect(config.session.instructions).toContain(
    'Answer general knowledge questions conversationally when they do not require inspecting or changing the workspace.',
  )
  expect(config.session.instructions).not.toContain('format_document')
})

test('createSessionConfig - defaults to no tools', () => {
  expect(createSessionConfig(RealtimeModelPreset.Mini).session.tools).toEqual(
    [],
  )
})

test('createSessionConfig - selects transcription model for each realtime model', () => {
  const mini = createSessionConfig(RealtimeModelPreset.Mini)
  const standard = createSessionConfig(RealtimeModelPreset.Standard)

  expect(mini.session.audio.input.transcription.model).toBe(
    'gpt-4o-mini-transcribe',
  )
  expect(standard.session.audio.input.transcription.model).toBe(
    'gpt-4o-transcribe',
  )
  expect(mini.session.audio.input.transcription.language).toBe('en')
  expect(standard.session.audio.input.transcription.language).toBe('en')
  expect(mini.session.model).toBe(RealtimeModelPreset.Mini)
  expect(standard.session.model).toBe(RealtimeModelPreset.Standard)
})

test('createSessionConfig - provides minimal English transcription guidance', () => {
  const config = createSessionConfig(RealtimeModelPreset.Mini)

  expect(config.session.audio.input.transcription.prompt).toBe(
    'English speech.',
  )
})

test('createSessionConfig - provides developer vocabulary to the realtime model', () => {
  const config = createSessionConfig(RealtimeModelPreset.Mini)

  expect(config.session.instructions).toContain(
    'Interpret spoken developer terms using these spellings: API, CLI, CI (pronounced "see eye"; continuous integration)',
  )
  expect(config.session.instructions).toContain(
    'YAML (rhymes with "camel"; file extensions .yaml and .yml), YML (pronounced "why em el")',
  )
  expect(config.session.instructions).toContain(
    'Knip (pronounced "nip"; configuration file knip.json)',
  )
})

test('getEphemeralKey - posts session and returns token', async () => {
  const sessionConfig = createSessionConfig(RealtimeModelPreset.Standard)
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    json: async () => ({ value: 'ephemeral-key' }),
    ok: true,
  } as Response)

  await expect(getEphemeralKey('sk-api-key', sessionConfig)).resolves.toBe(
    'ephemeral-key',
  )
  expect(fetch).toHaveBeenCalledWith(
    'https://api.openai.com/v1/realtime/client_secrets',
    {
      body: JSON.stringify(sessionConfig),
      headers: {
        Authorization: 'Bearer sk-api-key',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  )
})

test.each([
  [{ error: { message: 'invalid key' } }, 'invalid key'],
  [
    { error: { code: 'invalid_api_key', message: 'invalid key' } },
    'invalid_api_key: invalid key',
  ],
  [{}, 'Failed to create ephemeral token (400)'],
  [{ error: 'invalid' }, 'Failed to create ephemeral token (400)'],
  [{ error: null }, 'Failed to create ephemeral token (400)'],
  [{ error: {} }, 'Failed to create ephemeral token (400)'],
  [{ error: { message: 401 } }, 'Failed to create ephemeral token (400)'],
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
])('getEphemeralKey - reports token error %#', async (tokenData, message) => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    json: async () => tokenData,
    ok: false,
    status: 400,
  } as Response)

  await expect(getEphemeralKey('sk-api-key')).rejects.toThrow(message)
})

test('getEphemeralKey - reports status when error response is not json', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    json: async () => {
      throw new Error('invalid json')
    },
    ok: false,
    status: 502,
  } as unknown as Response)

  await expect(getEphemeralKey('sk-api-key')).rejects.toThrow(
    'Failed to create ephemeral token (502)',
  )
})

test.each([undefined, '', 1])(
  'getEphemeralKey - rejects invalid token %#',
  async (value) => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ value }),
      ok: true,
    } as Response)

    await expect(getEphemeralKey('sk-api-key')).rejects.toThrow(
      'Invalid ephemeral key response.',
    )
  },
)

test('getSdp - posts offer and returns answer', async () => {
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    text: async () => 'answer-sdp',
  } as Response)

  await expect(getSdp('offer-sdp', 'ephemeral-key')).resolves.toBe('answer-sdp')
  expect(fetch).toHaveBeenCalledWith(
    'https://api.openai.com/v1/realtime/calls',
    {
      body: 'offer-sdp',
      headers: {
        Authorization: 'Bearer ephemeral-key',
        'Content-Type': 'application/sdp',
      },
      method: 'POST',
    },
  )
})

test('getSdp - reports the OpenAI error code and message', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: false,
    status: 429,
    text: async () =>
      JSON.stringify({
        error: {
          code: 'credit_balance_exhausted',
          message:
            'You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.',
          type: 'insufficient_quota',
        },
      }),
  } as Response)

  await expect(getSdp('offer-sdp', 'ephemeral-key')).rejects.toThrow(
    'credit_balance_exhausted: You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.',
  )
})

test('getSdp - reports status when the error response is not json', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: false,
    status: 502,
    text: async () => 'Bad Gateway',
  } as Response)

  await expect(getSdp('offer-sdp', 'ephemeral-key')).rejects.toThrow(
    'Failed to create realtime session (502)',
  )
})

test.each([
  [
    { error: { code: 'credit_balance_exhausted', message: 'No credits' } },
    'credit_balance_exhausted: No credits',
  ],
  [{ error: { message: 'Invalid request' } }, 'Invalid request'],
  [
    { error: { code: 'invalid_request_error' } },
    'invalid_request_error: Realtime request failed',
  ],
  [{ error: null }, 'Realtime request failed'],
] as const)(
  'getOpenAiErrorMessage - formats error %#',
  (errorData, expected) => {
    expect(getOpenAiErrorMessage(errorData, 'Realtime request failed')).toBe(
      expected,
    )
  },
)
