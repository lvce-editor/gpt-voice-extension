import type * as Api from '@lvce-editor/api'
import { beforeEach, expect, jest, test } from '@jest/globals'
import { text } from '@lvce-editor/virtual-dom-worker'
import type { IState } from '../src/parts/CreateInstance/CreateInstance.ts'
import { createRenderState } from '../src/parts/RenderTestHelpers.ts'

const dispatch =
  jest.fn<(action: string, ...params: readonly unknown[]) => Promise<IState>>()
const dispose = jest.fn<() => Promise<void>>()
const readMicLevels = jest.fn<
  (options: Readonly<{ uid: number }>) => Promise<
    Readonly<{
      micAnalyzerData: Uint8Array
      remoteAnalyzerData: Uint8Array
    }>
  >
>(async () => ({
  micAnalyzerData: new Uint8Array([128]),
  remoteAnalyzerData: new Uint8Array([128]),
}))
const testState: {
  current: IState
  listener: ((state: IState, transcriptScroll: boolean) => void) | undefined
} = {
  current: createRenderState(),
  listener: undefined,
}

const createVoiceSession = jest.fn(
  async (
    _isTest: boolean,
    _provider: 'byok' | 'funded',
    update: (state: IState, transcriptScroll: boolean) => void,
  ) => {
    testState.listener = update
    return {
      session: { dispatch, dispose },
      voiceState: testState.current,
    }
  },
)

// eslint-disable-next-line jest/no-restricted-jest-methods
jest.unstable_mockModule('@lvce-editor/api', () => {
  const actual = jest.requireActual<typeof Api>('@lvce-editor/api')
  return { ...actual, readMicLevels }
})

// eslint-disable-next-line jest/no-restricted-jest-methods
jest.unstable_mockModule(
  '../src/parts/VoiceSessionWorker/VoiceSessionWorker.ts',
  () => ({ create: createVoiceSession }),
)

const { createInstance } =
  await import('../src/parts/CreateInstance/CreateInstance.ts')

beforeEach(() => {
  testState.current = createRenderState()
  testState.listener = undefined
  createVoiceSession.mockClear()
  dispatch.mockReset().mockImplementation(async (action, ...params) => {
    switch (action) {
      case 'addTranscript': {
        testState.current = {
          ...testState.current,
          messages: [
            ...testState.current.messages,
            {
              id: String(params[0]),
              text: String(params[1]),
              type: params[2] === 'user' ? 'user' : 'ai',
            },
          ],
        }
        testState.listener?.(testState.current, true)
        break
      }
      case 'clearChat': {
        testState.current = { ...testState.current, messages: [] }
        testState.listener?.(testState.current, false)
        break
      }
      case 'start': {
        testState.current = { ...testState.current, inProgress: true }
        testState.listener?.(testState.current, false)
        break
      }
    }
    return testState.current
  })
  dispose.mockReset().mockResolvedValue(undefined)
  readMicLevels.mockReset().mockResolvedValue({
    micAnalyzerData: new Uint8Array([128]),
    remoteAnalyzerData: new Uint8Array([128]),
  })
})

test('view adapter renders worker state and forwards view events', async () => {
  const requestRerender = jest.fn()
  const instance = await createInstance({
    requestRerender,
  } as unknown as Api.ViewContext)

  expect(createVoiceSession).toHaveBeenCalledWith(
    false,
    'byok',
    expect.any(Function),
  )
  expect(instance.render()).toContainEqual(text('Start talking'))

  await instance.handleOpenAiApiKeyInput('sk-test-key')
  await instance.handleClickStart()
  expect(dispatch).toHaveBeenCalledWith('inputApiKey', 'sk-test-key')
  expect(dispatch).toHaveBeenCalledWith('start')
  expect(instance.render()).toContainEqual(text('Stop talking'))
  expect(requestRerender).toHaveBeenCalled()
})

test('view adapter owns render helpers and transcript scrolling', async () => {
  const instance = await createInstance()

  expect(instance.getContext()).toEqual({})
  expect(instance.getCss()).toContain('scale(1)')
  expect(instance.getMenuEntries('test')).toEqual([])
  expect(instance.renderActionsDom()).not.toHaveLength(0)
  expect(instance.renderFocus?.({}, {})).toBe('.main')
  expect(instance.renderSelections?.()).toEqual([])
  expect(instance.renderScrollPosition()).toEqual([])
  expect(instance.renderTitle()).toBe('')
  expect(instance.saveState?.()).toEqual({})

  await instance.addTranscript('one', 'Hello', 'user')
  expect(instance.render()).toContainEqual(text('Hello'))
  expect(instance.renderScrollPosition()).toEqual([
    '.GptVoiceTranscript',
    9_999_999,
  ])
  expect(instance.renderScrollPosition()).toEqual([])

  await instance.handleClearChat()
  expect(instance.render()).not.toContainEqual(text('Hello'))
})

test('view adapter forwards business commands and disposes worker session', async () => {
  const instance = await createInstance()
  const fixture = { schemaVersion: 1, trace: [] }
  const captureOptions = { outputUri: 'file:///fixture.json', source: {} }

  await instance.captureFixture(captureOptions)
  await instance.handleClearOpenAiApiKey()
  await instance.handleData('{}')
  await instance.handleSaveOpenAiApiKey()
  await instance.handleUseOwnApiKey()
  await instance.replayFixture(fixture)
  await instance.setFundedError({ type: 'error' })
  await instance.setOfflineError(new Error('offline'))
  await instance.setRealtimeModelMini()
  await instance.setRealtimeModelStandard()
  await instance.stop()
  await instance.toggleToolCall('call-1')
  await instance.dispose?.()

  // Jest exposes mutable call tuples, but this assertion only reads them.
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  expect(dispatch.mock.calls.map(([action]) => action)).toEqual([
    'captureFixture',
    'clearApiKey',
    'data',
    'saveApiKey',
    'useOwnApiKey',
    'replayFixture',
    'setFundedError',
    'setOfflineError',
    'setModel',
    'setModel',
    'stop',
    'toggleToolCall',
  ])
  expect(dispose).toHaveBeenCalledTimes(1)
})

test('view adapter owns microphone animation and ignores updates after disposal', async () => {
  const requestRerender = jest.fn()
  const instance = await createInstance({
    requestRerender,
  } as unknown as Api.ViewContext)
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value(callback: FrameRequestCallback): number {
      testState.listener?.(
        createRenderState({ animationEnabled: false }),
        false,
      )
      callback(0)
      return 1
    },
  })

  testState.listener?.(
    createRenderState({ animationEnabled: true, uid: 9 }),
    false,
  )
  await Promise.resolve()
  await Promise.resolve()
  expect(readMicLevels).toHaveBeenCalledWith({ uid: 9 })

  instance.setAnimation(true, 1.5)
  expect(instance.getCss()).toContain('scale(1.5)')
  await instance.dispose?.()
  requestRerender.mockClear()
  testState.listener?.(createRenderState({ inProgress: true }), false)
  expect(requestRerender).not.toHaveBeenCalled()
})

test('view adapter keeps animation read errors inside the view', async () => {
  const error = new Error('analyser unavailable')
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  readMicLevels.mockImplementationOnce(async () => {
    testState.listener?.(createRenderState({ animationEnabled: false }), false)
    throw error
  })
  const instance = await createInstance()

  testState.listener?.(createRenderState({ animationEnabled: true }), false)
  await instance.doAnimate()

  expect(console.error).toHaveBeenCalledWith(error)
})

test('view adapter renders live microphone levels', async () => {
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value(callback: FrameRequestCallback): number {
      callback(0)
      return 1
    },
  })
  readMicLevels
    .mockResolvedValueOnce({
      micAnalyzerData: new Uint8Array([255]),
      remoteAnalyzerData: new Uint8Array([255]),
    })
    .mockImplementationOnce(async () => {
      testState.listener?.(
        createRenderState({ animationEnabled: false }),
        false,
      )
      return {
        micAnalyzerData: new Uint8Array([128]),
        remoteAnalyzerData: new Uint8Array([128]),
      }
    })
  await createInstance()

  testState.listener?.(createRenderState({ animationEnabled: true }), false)
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()

  expect(readMicLevels).toHaveBeenCalledTimes(2)
})
