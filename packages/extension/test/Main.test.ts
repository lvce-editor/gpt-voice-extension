import type * as Api from '@lvce-editor/api'
import { expect, jest, test } from '@jest/globals'
import { text } from '@lvce-editor/virtual-dom-worker'

const activateExtensionApi = jest.fn(async () => {})
const executeCommand = jest.fn(async (commandId: string, url: string) => {})
const readMicLevels = jest.fn(async () => ({
  micAnalyzerData: [],
  remoteAnalyzerData: [],
}))
const registerCommand = jest.fn(
  (command: Readonly<{ id: string; execute: () => Promise<void> }>) => ({
    dispose: jest.fn(),
  }),
)
const registerView = jest.fn(() => ({
  dispose: jest.fn(),
}))

// eslint-disable-next-line jest/no-restricted-jest-methods
jest.unstable_mockModule('@lvce-editor/api', () => {
  const actual = jest.requireActual<typeof Api>('@lvce-editor/api')
  return {
    ...actual,
    activate: activateExtensionApi,
    deleteSecret: jest.fn(),
    executeCommand,
    getSecret: jest.fn(),
    readMicLevels,
    registerCommand,
    registerView,
    setRemoteDescription: jest.fn(),
    startWebRtcAudioStream: jest.fn(),
    stopWebRtcAudioStream: jest.fn(),
    storeSecret: jest.fn(),
  }
})

const Main = await import('../src/parts/Main/Main.ts')
const { view } = await import('../src/parts/View/View.ts')

test('voice view prefers the preview area', () => {
  expect(view.preferredLocation).toBe('preview')
})

test('gpt-voice.show command opens floating extension window url', async () => {
  await Main.activate()

  expect(registerCommand).toHaveBeenCalledTimes(2)
  const openFloatingCommand = registerCommand.mock.calls.at(0)?.[0]
  if (!openFloatingCommand) {
    throw new Error('Expected open floating command')
  }
  expect(openFloatingCommand.id).toBe('gpt-voice.show')
  await openFloatingCommand.execute()

  expect(executeCommand).toHaveBeenCalledWith(
    'Open.openUrl',
    'lvce-oss://-/?floatingWindowMode=extensionView&floatingExtensionViewId=gpt-voice.views.default',
  )
  expect(registerView).toHaveBeenCalledTimes(1)
  expect(activateExtensionApi).toHaveBeenCalledTimes(1)
})

test('setIsTest initializes the next view instance in test mode', async () => {
  await Main.activate()
  const requestRerender = jest.fn()
  const setIsTestCommand = registerCommand.mock.calls.at(1)?.[0]
  if (!setIsTestCommand) {
    throw new Error('Expected setIsTest command')
  }

  await setIsTestCommand.execute()

  const instance = await view.create({
    requestRerender,
  } as unknown as Api.ViewContext)
  expect(instance.render()).toContainEqual(text('Start talking'))

  await view.commands['GptVoice.handleClickStart'](instance)

  expect(instance.render()).toContainEqual(text('Stop talking'))
})
