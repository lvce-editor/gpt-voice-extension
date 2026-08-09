import type * as Api from '@lvce-editor/api'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  jest,
  test,
} from '@jest/globals'
import { text } from '@lvce-editor/virtual-dom-worker'

const deleteSecret = jest.fn<(key: string) => Promise<void>>()
const getSecret = jest.fn<(key: string) => Promise<string | undefined>>()
const readMicLevels = jest.fn(async () => ({
  micAnalyzerData: new Uint8Array([128]),
  remoteAnalyzerData: new Uint8Array([128]),
}))
const setRemoteDescription = jest.fn<(options: unknown) => Promise<void>>(
  async () => undefined,
)
const startWebRtcAudioStream = jest.fn(async () => 'offer-sdp')
const stopWebRtcAudioStream = jest.fn<(uid: number) => Promise<void>>(
  async () => undefined,
)
const storeSecret = jest.fn<(key: string, value: string) => Promise<void>>()
const writeFile = jest.fn<(uri: string, content: string) => Promise<void>>()
const getRegisteredTools = jest.fn(async () => [
  {
    description: 'Get weather for a location.',
    name: 'getweather',
    parameters: { type: 'object' },
    type: 'function' as const,
  },
])
const createToolOutput = (callId: string, output: string): string =>
  JSON.stringify({
    item: {
      call_id: callId,
      output,
      type: 'function_call_output',
    },
    type: 'conversation.item.create',
  })
const executeFunctionToolCall = jest.fn(
  async (event: unknown): Promise<readonly string[]> => {
    if (
      !event ||
      typeof event !== 'object' ||
      !('type' in event) ||
      event.type !== 'response.function_call_arguments.done'
    ) {
      return []
    }
    return [
      createToolOutput('call', JSON.stringify({ temperature: 21 })),
      JSON.stringify({ type: 'response.create' }),
    ]
  },
)

// eslint-disable-next-line jest/no-restricted-jest-methods
jest.unstable_mockModule('@lvce-editor/api', () => {
  const actual = jest.requireActual<typeof Api>('@lvce-editor/api')
  return {
    ...actual,
    deleteSecret,
    getSecret,
    readMicLevels,
    setRemoteDescription,
    startWebRtcAudioStream,
    stopWebRtcAudioStream,
    storeSecret,
    writeFile,
  }
})

// eslint-disable-next-line jest/no-restricted-jest-methods
jest.unstable_mockModule(
  '../src/parts/VoiceFunctionCallingWorker/VoiceFunctionCallingWorker.ts',
  () => ({ executeFunctionToolCall, getRegisteredTools }),
)

const { createInstance } =
  await import('../src/parts/CreateInstance/CreateInstance.ts')
const { enableTestMode } = await import('../src/parts/TestMode/TestMode.ts')

type PortListener = (event: Readonly<{ readonly data: unknown }>) => void

class FakeMessagePort {
  onmessage: PortListener | null = null
  readonly close = jest.fn()
  readonly postMessage = jest.fn()
  readonly start = jest.fn()
}

let latestPort2: FakeMessagePort | undefined
const originalMessageChannel = Object.getOwnPropertyDescriptor(
  globalThis,
  'MessageChannel',
)
const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(
  globalThis,
  'requestAnimationFrame',
)

beforeAll(() => {
  Object.defineProperties(globalThis, {
    MessageChannel: {
      configurable: true,
      value: class {
        readonly port1 = new FakeMessagePort() as unknown as MessagePort
        readonly port2: MessagePort

        constructor() {
          // eslint-disable-next-line unicorn/no-top-level-assignment-in-function
          latestPort2 = new FakeMessagePort()
          this.port2 = latestPort2 as unknown as MessagePort
        }
      },
    },
    requestAnimationFrame: {
      configurable: true,
      value(callback: FrameRequestCallback): number {
        callback(0)
        return 1
      },
    },
  })
})

afterAll(() => {
  if (originalMessageChannel) {
    Object.defineProperty(globalThis, 'MessageChannel', originalMessageChannel)
  }
  if (originalRequestAnimationFrame) {
    Object.defineProperty(
      globalThis,
      'requestAnimationFrame',
      originalRequestAnimationFrame,
    )
  } else {
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      value: undefined,
    })
  }
})

beforeEach(() => {
  deleteSecret.mockReset().mockResolvedValue(undefined)
  getSecret.mockReset().mockResolvedValue('sk-abcdefghijk')
  readMicLevels.mockClear()
  setRemoteDescription.mockClear()
  startWebRtcAudioStream.mockReset().mockResolvedValue('offer-sdp')
  stopWebRtcAudioStream.mockReset().mockResolvedValue(undefined)
  storeSecret.mockReset().mockResolvedValue(undefined)
  writeFile.mockReset().mockResolvedValue(undefined)
  executeFunctionToolCall.mockClear()
  getRegisteredTools.mockClear()
  // eslint-disable-next-line unicorn/no-top-level-assignment-in-function
  latestPort2 = undefined
  jest.useFakeTimers()
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

const createContext = (): {
  readonly context: Api.ViewContext
  readonly requestRerender: ReturnType<typeof jest.fn>
} => {
  const requestRerender = jest.fn()
  return {
    context: { requestRerender } as unknown as Api.ViewContext,
    requestRerender,
  }
}

const flushAnimation = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

test('createInstance - initializes from present, empty, and failed storage', async () => {
  const withKey = await createInstance()
  expect(withKey.render()).toContainEqual(text('Start talking'))

  getSecret.mockResolvedValueOnce(' '.repeat(3))
  const withBlankKey = await createInstance()
  expect(withBlankKey.render()).toContainEqual(
    text('OpenAI API key required to start a live voice session.'),
  )

  getSecret.mockResolvedValueOnce(undefined)
  const withoutKey = await createInstance()
  expect(withoutKey.render()).toContainEqual(
    text('OpenAI API key required to start a live voice session.'),
  )

  getSecret.mockRejectedValueOnce(new Error('permission denied'))
  const withStorageFailure = await createInstance()
  expect(withStorageFailure.render()).toContainEqual(
    text('OpenAI API key required to start a live voice session.'),
  )
})

test('instance - exposes view helpers and transcript operations', async () => {
  const { context, requestRerender } = createContext()
  const instance = await createInstance(context)

  expect(instance.getContext()).toEqual({})
  expect(instance.getCss()).toContain('scale(1)')
  expect(instance.getMenuEntries('menu')).toEqual([])
  expect(instance.renderActionsDom()).toContainEqual(
    expect.objectContaining({
      'data-command': 'GptVoice.handleClearChat',
      title: 'Clear Chat',
    }),
  )
  expect(instance.renderFocus?.({}, {})).toBe('.main')
  expect(instance.renderSelections?.()).toEqual([])
  expect(instance.renderTitle()).toBe('')
  expect(instance.saveState?.()).toEqual({})

  instance.addTranscript('one', 'Hello', 'user')
  instance.createOrUpdateTranscript({ delta: ' world', item_id: 'one' }, 'user')
  instance.createOrUpdateTranscript({ delta: 'Hi', item_id: 'two' }, 'ai')
  instance.updateTranscript('missing', 'ignored')
  instance.handleInputTranscript({ delta: '!', item_id: 'one' })
  instance.handleOutputTranscript({ delta: ' there', item_id: 'two' })

  expect(instance.render()).toContainEqual(text('Hello world!'))
  expect(instance.render()).toContainEqual(text('Hi there'))
  requestRerender.mockClear()
  instance.handleClearChat()
  expect(instance.render()).not.toContainEqual(text('Hello world!'))
  expect(instance.render()).not.toContainEqual(text('Hi there'))
  expect(requestRerender).toHaveBeenCalledTimes(1)

  requestRerender.mockClear()
  instance.handleClearChat()
  expect(requestRerender).not.toHaveBeenCalled()

  instance.setAnimation(true, 1.5)
  expect(instance.getCss()).toContain('scale(1.5)')

  const withoutContext = await createInstance()
  withoutContext.addTranscript('three', 'No context', 'user')
  withoutContext.setAnimation(true, 1.2)
  jest.runAllTimers()
})

test('instance - validates and saves api key', async () => {
  const { context } = createContext()
  getSecret.mockResolvedValueOnce(undefined)
  const instance = await createInstance(context)

  await instance.handleSaveOpenAiApiKey()
  expect(instance.render()).toContainEqual(text('OpenAI API key is required.'))

  instance.handleOpenAiApiKeyInput('invalid')
  await instance.handleSaveOpenAiApiKey()
  expect(instance.render()).toContainEqual(
    text('OpenAI API key format looks invalid.'),
  )

  instance.handleOpenAiApiKeyInput('  sk-abcdefghijk  ')
  await instance.handleSaveOpenAiApiKey()
  expect(storeSecret).toHaveBeenCalledWith(
    'builtin.gpt-voice.openai-api-key',
    'sk-abcdefghijk',
  )
  expect(instance.render()).toContainEqual(text('Start talking'))
})

test('instance - reports save and clear failures', async () => {
  const instance = await createInstance()
  instance.handleOpenAiApiKeyInput('sk-abcdefghijk')
  storeSecret.mockRejectedValueOnce(new Error('permission denied'))

  await instance.handleSaveOpenAiApiKey()
  expect(storeSecret).toHaveBeenCalled()

  deleteSecret.mockRejectedValueOnce(new Error('permission denied'))
  await instance.handleClearOpenAiApiKey()
  expect(deleteSecret).toHaveBeenCalled()

  await instance.handleClearOpenAiApiKey()
  expect(instance.render()).toContainEqual(
    text('OpenAI API key required to start a live voice session.'),
  )
})

test('instance - ignores actions while api key save is pending', async () => {
  const { promise, resolve } = Promise.withResolvers<void>()
  storeSecret.mockReturnValue(promise)
  const instance = await createInstance()
  instance.handleOpenAiApiKeyInput('sk-abcdefghijk')
  const savePromise = instance.handleSaveOpenAiApiKey()
  instance.handleOpenAiApiKeyInput('replacement')
  await instance.handleClickStart()
  await instance.handleClearOpenAiApiKey()

  expect(instance.render()).toContainEqual(text('Saving key'))
  resolve()
  await savePromise
  expect(instance.render()).toContainEqual(text('Start talking'))
})

test('instance - handles missing api key before and during token creation', async () => {
  getSecret.mockResolvedValue(undefined)
  const missingAtStart = await createInstance()
  await missingAtStart.handleClickStart()
  expect(missingAtStart.render()).toContainEqual(
    text('NO_API_KEY: Add your OpenAI API key above to start.'),
  )

  getSecret
    .mockReset()
    .mockResolvedValueOnce('sk-abcdefghijk')
    .mockResolvedValueOnce(undefined)
  const removedBeforeStart = await createInstance()
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  await removedBeforeStart.handleClickStart()
  expect(removedBeforeStart.render()).toContainEqual(
    text('NO_API_KEY: OpenAI API key is not set.'),
  )
})

test.each([
  [1, 'Failed to create token. Check your network and API key.'],
  [
    new Error('request failed with 401'),
    'OpenAI API key is invalid (401/403).',
  ],
  [
    new Error('request failed with 403'),
    'OpenAI API key is invalid (401/403).',
  ],
  [
    new Error('Failed to fetch'),
    'Network failure while creating token. Retry and check your internet connection.',
  ],
  [new Error('service unavailable'), 'service unavailable'],
  [
    Object.assign(new Error('placeholder'), { message: '' }),
    'Failed to create token.',
  ],
])('instance - maps token failure %#', async (error, message) => {
  const instance = await createInstance()
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(error)
  jest.spyOn(console, 'error').mockImplementation(() => undefined)

  await instance.handleClickStart()

  expect(instance.render()).toContainEqual(text(message))
})

test('instance - handles empty offer and closes data channel', async () => {
  const instance = await createInstance()
  jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    json: async () => ({ value: 'ephemeral-key' }),
    ok: true,
  } as Response)
  startWebRtcAudioStream.mockResolvedValueOnce('')
  jest.spyOn(console, 'error').mockImplementation(() => undefined)

  await instance.handleClickStart()

  expect(latestPort2?.close).toHaveBeenCalled()
  expect(instance.render()).toContainEqual(text('offer sdp is required'))
})

test('instance - starts, receives data, animates, and stops session', async () => {
  const { context } = createContext()
  const instance = await createInstance(context)
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce({
      json: async () => ({ value: 'ephemeral-key' }),
      ok: true,
    } as Response)
    .mockResolvedValueOnce({
      text: async () => 'answer-sdp',
    } as Response)

  await instance.handleClickStart()
  await flushAnimation()

  expect(getRegisteredTools).toHaveBeenCalledTimes(1)
  expect(startWebRtcAudioStream).toHaveBeenCalled()
  expect(setRemoteDescription).toHaveBeenCalledWith({
    sdp: 'answer-sdp',
    type: 'answer',
    uid: -1,
  })
  expect(instance.render()).toContainEqual(text('In Progress'))

  instance.setRealtimeModelMini()
  instance.setRealtimeModelStandard()
  await instance.handleClearOpenAiApiKey()

  latestPort2?.onmessage?.({ data: 'null' })
  latestPort2?.onmessage?.({ data: {} })
  instance.handleData(
    JSON.stringify({
      arguments: JSON.stringify({ location: 'Paris' }),
      call_id: 'call',
      name: 'getweather',
      type: 'response.function_call_arguments.done',
    }),
  )
  await flushAnimation()
  expect(latestPort2?.postMessage).toHaveBeenCalled()
  instance.handleData(
    JSON.stringify({
      delta: 'Hello',
      item_id: 'input',
      type: 'conversation.item.input_audio_transcription.delta',
    }),
  )
  instance.handleData(
    JSON.stringify({
      delta: 'Hi',
      item_id: 'output',
      type: 'response.output_audio_transcript.delta',
    }),
  )
  expect(instance.render()).toContainEqual(text('Hello'))
  expect(instance.render()).toContainEqual(text('Hi'))

  await instance.handleClickStart()
  expect(stopWebRtcAudioStream).toHaveBeenCalledWith(-1)
  expect(latestPort2?.close).toHaveBeenCalled()
})

test('instance - recovers from one animation read failure', async () => {
  const instance = await createInstance()
  readMicLevels
    .mockRejectedValueOnce(new Error('read failed'))
    .mockResolvedValueOnce({
      micAnalyzerData: new Uint8Array([128]),
      remoteAnalyzerData: new Uint8Array([128]),
    })
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce({
      json: async () => ({ value: 'ephemeral-key' }),
      ok: true,
    } as Response)
    .mockResolvedValueOnce({ text: async () => 'answer-sdp' } as Response)
  const consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined)

  await instance.handleClickStart()
  await flushAnimation()

  expect(consoleError).toHaveBeenCalledWith(expect.any(Error))
  await instance.stop()
})

test('instance - keeps updating the bubble scale for microphone and remote audio', async () => {
  const instance = await createInstance()
  type AudioLevels = Awaited<ReturnType<typeof readMicLevels>>
  const firstRead = Promise.withResolvers<AudioLevels>()
  const secondRead = Promise.withResolvers<AudioLevels>()
  const thirdRead = Promise.withResolvers<AudioLevels>()
  readMicLevels
    .mockReturnValueOnce(firstRead.promise)
    .mockReturnValueOnce(secondRead.promise)
    .mockReturnValueOnce(thirdRead.promise)

  instance.setAnimation(true, 1)
  const animation = instance.doAnimate()
  firstRead.resolve({
    micAnalyzerData: new Uint8Array([160]),
    remoteAnalyzerData: new Uint8Array([128]),
  })
  await flushAnimation()

  expect(readMicLevels).toHaveBeenCalledTimes(2)
  expect(instance.getCss()).toContain('scale(1.8)')

  secondRead.resolve({
    micAnalyzerData: new Uint8Array([128]),
    remoteAnalyzerData: new Uint8Array([144]),
  })
  await flushAnimation()

  expect(readMicLevels).toHaveBeenCalledTimes(3)
  expect(instance.getCss()).toContain('scale(1.4)')

  instance.setAnimation(false, 1)
  thirdRead.resolve({
    micAnalyzerData: new Uint8Array([255]),
    remoteAnalyzerData: new Uint8Array([128]),
  })
  await animation
  expect(instance.getCss()).toContain('scale(1)')
})

test('instance - switches models while idle', async () => {
  const instance = await createInstance()

  instance.setRealtimeModelMini()
  instance.setRealtimeModelStandard()
  instance.setRealtimeModelStandard()
  expect(instance.render()).toContainEqual(
    text('Model: Realtime 2.1 (better quality)'),
  )
  instance.setRealtimeModelMini()
  expect(instance.render()).toContainEqual(
    text('Model: Realtime 2.1 mini (cheaper)'),
  )
})

test('instance - handles tool call without connected data channel', async () => {
  const instance = await createInstance()
  const consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined)

  instance.handleData(
    JSON.stringify({
      arguments: JSON.stringify({ location: 'Paris' }),
      call_id: 'call',
      name: 'getweather',
      type: 'response.function_call_arguments.done',
    }),
  )
  await flushAnimation()

  expect(consoleError).toHaveBeenCalledWith(expect.any(Error))
  expect(instance.render()).toContainEqual(text('Ran getweather'))
  instance.toggleToolCall('call')
  expect(instance.render()).toContainEqual(text('{\n  "temperature": 21\n}'))
  instance.toggleToolCall('missing')
  instance.updateTranscript('call', 'ignored')
})

test('instance - shows a tool call while it is running and ignores duplicate events', async () => {
  const instance = await createInstance()
  const response = Promise.withResolvers<readonly string[]>()
  executeFunctionToolCall.mockReturnValueOnce(response.promise)
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  const event = {
    arguments: JSON.stringify({ path: 'src' }),
    call_id: 'pending-call',
    name: 'list_workspace_directory',
    type: 'response.function_call_arguments.done',
  }

  instance.handleData(JSON.stringify(event))
  instance.handleData(JSON.stringify(event))

  expect(instance.render()).toContainEqual(
    text('Running list_workspace_directory…'),
  )
  expect(executeFunctionToolCall).toHaveBeenCalledTimes(1)

  response.resolve([
    createToolOutput('pending-call', JSON.stringify({ files: ['a.ts'] })),
  ])
  await flushAnimation()

  expect(instance.render()).toContainEqual(text('Ran list_workspace_directory'))
})

test('instance - stops talking when the stop talking tool is called', async () => {
  const instance = await createInstance()
  executeFunctionToolCall.mockResolvedValueOnce([
    createToolOutput('stop-call', JSON.stringify({ stopped: true })),
  ])

  instance.handleData(
    JSON.stringify({
      arguments: '{}',
      call_id: 'stop-call',
      name: 'stop_talking',
      type: 'response.function_call_arguments.done',
    }),
  )
  await flushAnimation()

  expect(instance.render()).toContainEqual(text('Start talking'))
  expect(instance.render()).toContainEqual(text('Ran stop_talking'))
  expect(stopWebRtcAudioStream).toHaveBeenCalledWith(-1)
})

test('instance - hides silent wait tool calls', async () => {
  const instance = await createInstance()
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  executeFunctionToolCall.mockResolvedValueOnce([
    createToolOutput('wait-call', JSON.stringify({ waiting: true })),
  ])

  instance.handleData(
    JSON.stringify({
      arguments: '{}',
      call_id: 'wait-call',
      name: 'wait_for_user',
      type: 'response.function_call_arguments.done',
    }),
  )
  instance.handleData(
    JSON.stringify({
      item: {
        arguments: '{}',
        call_id: 'wait-call',
        name: 'wait_for_user',
        type: 'function_call',
      },
      type: 'response.output_item.done',
    }),
  )
  await flushAnimation()

  expect(executeFunctionToolCall).toHaveBeenCalledTimes(1)
  expect(instance.render()).not.toContainEqual(text('Ran wait_for_user'))
})

test('instance - shows failed tool calls', async () => {
  const instance = await createInstance()
  const consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined)
  executeFunctionToolCall
    .mockRejectedValueOnce(new Error('tool failed'))
    .mockRejectedValueOnce('worker stopped')

  instance.handleData(
    JSON.stringify({
      arguments: '{}',
      call_id: 'failed-call',
      name: 'read_workspace_file',
      type: 'response.function_call_arguments.done',
    }),
  )
  instance.handleData(
    JSON.stringify({
      arguments: '{}',
      call_id: 'stopped-call',
      name: 'read_workspace_file',
      type: 'response.function_call_arguments.done',
    }),
  )
  await flushAnimation()

  expect(instance.render()).toContainEqual(text('Failed read_workspace_file'))
  instance.toggleToolCall('failed-call')
  expect(instance.render()).toContainEqual(text('tool failed'))
  instance.toggleToolCall('stopped-call')
  expect(instance.render()).toContainEqual(text('worker stopped'))
  expect(consoleError).toHaveBeenCalledTimes(2)
})

test('instance - replays a fixture through tool handling and reports mismatches', async () => {
  const instance = await createInstance()
  const fixture = {
    schemaVersion: 1,
    trace: [
      {
        atMs: 0,
        direction: 'server',
        event: {
          delta: 'Weather?',
          item_id: 'user',
          type: 'conversation.item.input_audio_transcription.delta',
        },
      },
      {
        atMs: 1,
        direction: 'server',
        event: {
          arguments: '{"location":"Paris"}',
          call_id: 'call',
          name: 'getweather',
          type: 'response.function_call_arguments.done',
        },
      },
      {
        atMs: 2,
        direction: 'client',
        event: {
          item: {
            call_id: 'call',
            output: '{"temperature":21}',
            type: 'function_call_output',
          },
          type: 'conversation.item.create',
        },
      },
      {
        atMs: 3,
        direction: 'client',
        event: { type: 'response.create' },
      },
      {
        atMs: 4,
        direction: 'server',
        event: {
          delta: '21 degrees',
          item_id: 'assistant',
          type: 'response.output_audio_transcript.delta',
        },
      },
    ],
  }

  await instance.replayFixture(fixture)
  expect(instance.render()).toContainEqual(text('Weather?'))
  expect(instance.render()).toContainEqual(text('Ran getweather'))
  expect(instance.render()).toContainEqual(text('21 degrees'))

  await expect(
    instance.replayFixture({
      schemaVersion: 1,
      trace: [
        {
          atMs: 0,
          direction: 'client',
          event: { type: 'missing' },
        },
      ],
    }),
  ).rejects.toThrow('Missing client event')
})

test('instance - records a live fixture and writes it after completion', async () => {
  const instance = await createInstance()
  readMicLevels.mockReturnValue(new Promise(() => {}))
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce({
      json: async () => ({ value: 'ephemeral-key' }),
      ok: true,
    } as Response)
    .mockResolvedValueOnce({ text: async () => 'answer-sdp' } as Response)

  const capture = instance.captureFixture({
    outputUri: 'file:///tmp/raw-recording.json',
    source: { name: 'arithmetic', text: 'What is 1+1?' },
  })
  await flushAnimation()
  await flushAnimation()
  if (!latestPort2?.onmessage) {
    throw new Error('Expected fixture capture data channel')
  }
  latestPort2.onmessage({
    data: JSON.stringify({
      delta: 'What is 1+1?',
      item_id: 'user',
      type: 'conversation.item.input_audio_transcription.delta',
    }),
  })
  latestPort2.onmessage({
    data: JSON.stringify({
      delta: '2',
      item_id: 'assistant',
      type: 'response.output_audio_transcript.delta',
    }),
  })
  latestPort2.onmessage({ data: JSON.stringify({ type: 'response.done' }) })
  await capture

  expect(writeFile).toHaveBeenCalledWith(
    'file:///tmp/raw-recording.json',
    expect.stringContaining('"direction": "server"'),
  )
  expect(stopWebRtcAudioStream).toHaveBeenCalledWith(-1)
})

test('instance - enters test mode before and after creation', async () => {
  const createdBeforeTestMode = await createInstance()
  enableTestMode()

  await createdBeforeTestMode.handleClickStart()
  expect(createdBeforeTestMode.render()).toContainEqual(text('Stop talking'))
  await createdBeforeTestMode.handleClickStart()

  getSecret.mockResolvedValueOnce(undefined)
  const createdInTestMode = await createInstance()
  await createdInTestMode.handleClickStart()
  expect(createdInTestMode.render()).toContainEqual(text('Stop talking'))
  createdInTestMode.handleData(
    JSON.stringify({
      arguments: JSON.stringify({ location: 'Paris' }),
      call_id: 'test-call',
      name: 'getweather',
      type: 'response.function_call_arguments.done',
    }),
  )
  await flushAnimation()
  expect(createdInTestMode.render()).toContainEqual(text('Ran getweather'))
  await createdInTestMode.stop()
  expect(stopWebRtcAudioStream).not.toHaveBeenCalled()
})
