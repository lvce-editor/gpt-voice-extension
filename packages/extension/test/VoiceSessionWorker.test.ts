import type * as Api from '@lvce-editor/api'
import type {
  VoiceWorkConfiguration,
  VoiceWorkResult,
  VoiceWorkToolCallEvent,
} from 'voice-shared'
import { beforeAll, beforeEach, expect, jest, test } from '@jest/globals'
import { createRenderState } from '../src/parts/RenderTestHelpers.ts'

const createRpc = jest.fn<typeof Api.createRpc>()
const deleteSecret = jest.fn<typeof Api.deleteSecret>()
const getPreference = jest.fn<typeof Api.getPreference>()
const getSecret = jest.fn<typeof Api.getSecret>()
const setRemoteDescription = jest.fn<typeof Api.setRemoteDescription>()
const startWebRtcAudioStream = jest.fn<typeof Api.startWebRtcAudioStream>()
const stopWebRtcAudioStream = jest.fn<typeof Api.stopWebRtcAudioStream>()
const storeSecret = jest.fn<typeof Api.storeSecret>()
const writeFile = jest.fn<typeof Api.writeFile>()
const getRealtimeTools = jest.fn(async () => [])
const executeFunctionToolCall = jest.fn(async () => [])
const executeWorkTask = jest.fn<
  (
    task: string,
    configuration: VoiceWorkConfiguration,
    onToolCall: (event: VoiceWorkToolCallEvent) => Promise<void>,
  ) => Promise<VoiceWorkResult>
>(async () => ({
  success: true,
  summary: 'finished',
}))
const getWorkToolDefinition = jest.fn(async () => ({
  name: 'do_work',
  type: 'function',
}))
const invoke =
  jest.fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()
const disposeRpc = jest.fn<() => Promise<void>>()

class FakeMessagePort {
  onmessage: ((event: Readonly<{ data: unknown }>) => void) | null = null
  readonly close = jest.fn()
  readonly postMessage = jest.fn()
  readonly start = jest.fn()
}

const channels: Array<
  Readonly<{ port1: FakeMessagePort; port2: FakeMessagePort }>
> = []

// eslint-disable-next-line jest/no-restricted-jest-methods
jest.unstable_mockModule('@lvce-editor/api', () => {
  const actual = jest.requireActual<typeof Api>('@lvce-editor/api')
  return {
    ...actual,
    createRpc,
    deleteSecret,
    getPreference,
    getSecret,
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
  () => ({ executeFunctionToolCall, getRealtimeTools }),
)

// eslint-disable-next-line jest/no-restricted-jest-methods
jest.unstable_mockModule(
  '../src/parts/VoiceWorkWorker/VoiceWorkWorker.ts',
  () => ({
    execute: executeWorkTask,
    getToolDefinition: getWorkToolDefinition,
  }),
)

const VoiceSessionWorker =
  await import('../src/parts/VoiceSessionWorker/VoiceSessionWorker.ts')

beforeAll(() => {
  Object.defineProperty(globalThis, 'MessageChannel', {
    configurable: true,
    value: class {
      readonly port1 = new FakeMessagePort()
      readonly port2 = new FakeMessagePort()

      constructor() {
        channels.push({ port1: this.port1, port2: this.port2 })
      }
    },
  })
})

beforeEach(() => {
  channels.length = 0
  createRpc.mockReset().mockResolvedValue({
    dispose: disposeRpc,
    invoke,
  } as never)
  deleteSecret.mockReset().mockResolvedValue(undefined)
  disposeRpc.mockReset().mockResolvedValue(undefined)
  getPreference.mockReset().mockImplementation(async (key) => {
    switch (key) {
      case 'gptvoice.audio.echoCancellation':
      case 'gptvoice.audio.noiseSuppression':
        return true
      default:
        return false
    }
  })
  getSecret.mockReset().mockResolvedValue('')
  getRealtimeTools.mockClear()
  getWorkToolDefinition.mockClear()
  executeWorkTask.mockClear()
  invoke.mockReset().mockImplementation(async (method) => {
    switch (method) {
      case 'AudioDebug.clearAll':
        return undefined
      case 'AudioDebug.list':
        return []
      case 'AudioDebug.read':
        return new Blob(['audio'])
      case 'AudioDebug.save':
        return { name: 'recording.webm' }
      case 'VoiceSession.create':
      case 'VoiceSession.dispatch':
        return createRenderState()
      default:
        return undefined
    }
  })
  setRemoteDescription.mockReset().mockResolvedValue(undefined)
  startWebRtcAudioStream.mockReset().mockResolvedValue('offer-sdp')
  stopWebRtcAudioStream.mockReset().mockResolvedValue('')
  storeSecret.mockReset().mockResolvedValue(undefined)
  writeFile.mockReset().mockResolvedValue(undefined)
  VoiceSessionWorker.state.nextSessionId = 1
  VoiceSessionWorker.state.rpcPromise = undefined
  VoiceSessionWorker.setRefreshAudioDebugViews(async () => undefined)
})

const getCommandMap = (): Record<
  string,
  (...args: readonly unknown[]) => unknown
> => {
  const options = createRpc.mock.calls[0]?.[0]
  if (!options?.commandMap) {
    throw new Error('Expected voice session RPC command map')
  }
  return options.commandMap as Record<
    string,
    (...args: readonly unknown[]) => unknown
  >
}

test('creates one ID-based worker RPC and forwards session operations', async () => {
  const listener = jest.fn()
  const first = await VoiceSessionWorker.create(false, 'byok', listener)
  const second = await VoiceSessionWorker.create(true, 'funded', listener)

  expect(createRpc).toHaveBeenCalledTimes(1)
  expect(createRpc).toHaveBeenCalledWith({
    commandMap: expect.any(Object),
    id: 'builtin.gpt-voice.voice-session-worker',
  })
  expect(invoke).toHaveBeenCalledWith('VoiceSession.create', 1, false, 'byok')
  expect(invoke).toHaveBeenCalledWith('VoiceSession.create', 2, true, 'funded')

  await first.session.dispatch('start')
  await first.session.dispose()
  await second.session.dispose()
  expect(invoke).toHaveBeenCalledWith('VoiceSession.dispatch', 1, 'start')
  expect(invoke).toHaveBeenCalledWith('VoiceSession.dispose', 1)
})

test('exposes delegated work and only realtime-safe tools to the session worker', async () => {
  await VoiceSessionWorker.create(false, 'byok', jest.fn())
  const commandMap = getCommandMap()

  await expect(commandMap['VoiceHost.getRegisteredTools']?.()).resolves.toEqual(
    [{ name: 'do_work', type: 'function' }],
  )
  await expect(
    commandMap['VoiceHost.executeWorkTask']?.(1, 'work-call', 'task', {
      accessToken: 'token',
      endpoint: 'https://api.openai.com/v1/responses',
    }),
  ).resolves.toEqual({ success: true, summary: 'finished' })
  expect(getRealtimeTools).toHaveBeenCalled()
  expect(getWorkToolDefinition).toHaveBeenCalled()
  expect(executeWorkTask).toHaveBeenCalledWith(
    'task',
    {
      accessToken: 'token',
      endpoint: 'https://api.openai.com/v1/responses',
    },
    expect.any(Function),
  )
  const onToolCall = executeWorkTask.mock.calls[0]?.[2]
  await onToolCall?.({
    argumentsValue: '{}',
    callId: 'read-call',
    name: 'read_workspace_file',
    type: 'started',
  })
  expect(invoke).toHaveBeenCalledWith(
    'VoiceSession.dispatch',
    1,
    'reportWorkToolCall',
    'work-call',
    {
      argumentsValue: '{}',
      callId: 'read-call',
      name: 'read_workspace_file',
      type: 'started',
    },
  )
})

test('adapts WebRTC data channels and worker state updates', async () => {
  const listener = jest.fn()
  await VoiceSessionWorker.create(false, 'byok', listener)
  const commandMap = getCommandMap()

  await commandMap['VoiceHost.startWebRtc']?.(1, -1, 'ephemeral-key')
  expect(startWebRtcAudioStream).toHaveBeenCalledWith(
    expect.objectContaining({
      audioConstraints: {
        autoGainControl: false,
        echoCancellation: true,
        noiseSuppression: true,
      },
      elementLocator: '.GptVoiceAudio',
      ephemeralKey: 'ephemeral-key',
      trackAudioData: true,
      uid: -1,
    }),
  )
  const dataChannel = channels[0]
  dataChannel?.port2.onmessage?.({ data: { type: 'server-event' } })
  dataChannel?.port2.onmessage?.({ data: 'raw-server-event' })
  await Promise.resolve()
  expect(invoke).toHaveBeenCalledWith(
    'VoiceSession.dispatch',
    1,
    'data',
    '{"type":"server-event"}',
  )

  await commandMap['VoiceHost.sendWebRtcMessage']?.(1, 'client-event')
  expect(dataChannel?.port2.postMessage).toHaveBeenCalledWith('client-event')
  await commandMap['VoiceHost.setRemoteDescription']?.(-1, 'answer-sdp')
  expect(setRemoteDescription).toHaveBeenCalledWith({
    sdp: 'answer-sdp',
    type: 'answer',
    uid: -1,
  })

  const nextState = createRenderState({ inProgress: true })
  commandMap['VoiceHost.updateState']?.(1, nextState, true)
  commandMap['VoiceHost.updateState']?.(99, nextState, false)
  expect(listener).toHaveBeenCalledWith(nextState, true)
  await commandMap['VoiceHost.stopWebRtc']?.(1, -1)
  expect(stopWebRtcAudioStream).toHaveBeenCalledWith(-1)
  expect(dataChannel?.port2.close).toHaveBeenCalled()
  await expect(
    commandMap['VoiceHost.sendWebRtcMessage']?.(1, 'late-event'),
  ).rejects.toThrow('Voice WebRTC data channel is not connected')
})

test('uses configured microphone audio processing constraints', async () => {
  getPreference.mockImplementation(async (key) => {
    switch (key) {
      case 'gptvoice.audio.autoGainControl':
        return true
      case 'gptvoice.audio.echoCancellation':
      case 'gptvoice.audio.noiseSuppression':
        return false
      default:
        return false
    }
  })
  await VoiceSessionWorker.create(false, 'byok', jest.fn())
  const commandMap = getCommandMap()

  await commandMap['VoiceHost.startWebRtc']?.(1, -1, 'ephemeral-key')

  expect(startWebRtcAudioStream).toHaveBeenCalledWith(
    expect.objectContaining({
      audioConstraints: {
        autoGainControl: true,
        echoCancellation: false,
        noiseSuppression: false,
      },
    }),
  )
})

test('routes audio-debug capture and storage through the worker', async () => {
  const refresh = jest.fn(async () => undefined)
  VoiceSessionWorker.setRefreshAudioDebugViews(refresh)
  getPreference.mockResolvedValue(true)
  await VoiceSessionWorker.create(false, 'byok', jest.fn())
  const commandMap = getCommandMap()

  await commandMap['VoiceHost.startWebRtc']?.(1, -1, 'ephemeral-key')
  const audioChannel = channels[1]
  const audio = new Blob(['audio'], { type: 'audio/webm' })
  audioChannel?.port2.onmessage?.({ data: 'not-a-blob' })
  audioChannel?.port2.onmessage?.({ data: audio })
  await Promise.resolve()
  await Promise.resolve()
  expect(invoke).toHaveBeenCalledWith('AudioDebug.save', audio)
  expect(refresh).toHaveBeenCalled()

  await expect(
    VoiceSessionWorker.audioDebugStorage.clearAll(),
  ).resolves.toBeUndefined()
  await expect(VoiceSessionWorker.audioDebugStorage.list()).resolves.toEqual([])
  await expect(
    VoiceSessionWorker.audioDebugStorage.read('gpt-voice-audio:///test.webm'),
  ).resolves.toBeInstanceOf(Blob)
  await expect(
    VoiceSessionWorker.audioDebugStorage.save(audio),
  ).resolves.toEqual({ name: 'recording.webm' })
  expect(invoke).toHaveBeenCalledWith('AudioDebug.clearAll')
})

test('closes a partially created transport when WebRTC startup fails', async () => {
  startWebRtcAudioStream.mockRejectedValue(new Error('microphone denied'))
  await VoiceSessionWorker.create(false, 'byok', jest.fn())
  const commandMap = getCommandMap()

  await expect(
    commandMap['VoiceHost.startWebRtc']?.(1, -1, 'ephemeral-key'),
  ).rejects.toThrow('microphone denied')
  expect(channels[0]?.port2.close).toHaveBeenCalled()
})

test('cleans up a listener when worker session creation fails', async () => {
  invoke.mockRejectedValueOnce(new Error('worker failed'))

  await expect(
    VoiceSessionWorker.create(false, 'byok', jest.fn()),
  ).rejects.toThrow('worker failed')
})
