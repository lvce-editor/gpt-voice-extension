import { expect, jest, test } from '@jest/globals'
import type { ActiveGptVoiceViewInstance } from '../src/parts/CreateInstance/CreateInstance.ts'
import { view } from '../src/parts/View/View.ts'

test('view commands forward every event to the view adapter', async () => {
  const context = {
    addTranscript: jest.fn(async () => undefined),
    captureFixture: jest.fn(async () => undefined),
    handleClearChat: jest.fn(async () => undefined),
    handleClearOpenAiApiKey: jest.fn(async () => undefined),
    handleClickStart: jest.fn(async () => undefined),
    handleData: jest.fn(async () => undefined),
    handleOpenAiApiKeyInput: jest.fn(async () => undefined),
    handleSaveOpenAiApiKey: jest.fn(async () => undefined),
    handleUseOwnApiKey: jest.fn(async () => undefined),
    replayFixture: jest.fn(async () => undefined),
    setAnimation: jest.fn(),
    setOfflineError: jest.fn(async () => undefined),
    setRealtimeModelMini: jest.fn(async () => undefined),
    setRealtimeModelStandard: jest.fn(async () => undefined),
    stop: jest.fn(async () => undefined),
    toggleToolCall: jest.fn(async () => undefined),
  } as unknown as ActiveGptVoiceViewInstance

  await view.commands['GptVoice.addTranscript'](context, 'one', 'hello')
  await view.commands['GptVoice.captureFixture'](context, {
    outputUri: 'file:///fixture.json',
    source: {},
  })
  await view.commands['GptVoice.handleClearChat'](context)
  await view.commands['GptVoice.handleClearOpenAiApiKey'](context)
  await view.commands['GptVoice.handleClickStart'](context)
  await view.commands['GptVoice.handleData'](context, '{}')
  await view.commands['GptVoice.handleOpenAiApiKeyInput'](context, 'key')
  await view.commands['GptVoice.handleSaveOpenAiApiKey'](context)
  await view.commands['GptVoice.handleUseOwnApiKey'](context)
  await view.commands['GptVoice.replayFixture'](context, {})
  await view.commands['GptVoice.setAnimation'](context, true, 1.5)
  await view.commands['GptVoice.setOfflineError'](context, new Error('offline'))
  await view.commands['GptVoice.setRealtimeModelMini'](context)
  await view.commands['GptVoice.setRealtimeModelStandard'](context)
  await view.commands['GptVoice.stop'](context)
  await view.commands['GptVoice.toggleToolCall'](context, 'call-1')

  expect(context.addTranscript).toHaveBeenCalledWith('one', 'hello', 'ai')
  expect(context.captureFixture).toHaveBeenCalled()
  expect(context.handleClearChat).toHaveBeenCalled()
  expect(context.handleClearOpenAiApiKey).toHaveBeenCalled()
  expect(context.handleClickStart).toHaveBeenCalled()
  expect(context.handleData).toHaveBeenCalledWith('{}')
  expect(context.handleOpenAiApiKeyInput).toHaveBeenCalledWith('key')
  expect(context.handleSaveOpenAiApiKey).toHaveBeenCalled()
  expect(context.handleUseOwnApiKey).toHaveBeenCalled()
  expect(context.replayFixture).toHaveBeenCalledWith({})
  expect(context.setAnimation).toHaveBeenCalledWith(true, 1.5)
  expect(context.setOfflineError).toHaveBeenCalled()
  expect(context.setRealtimeModelMini).toHaveBeenCalled()
  expect(context.setRealtimeModelStandard).toHaveBeenCalled()
  expect(context.stop).toHaveBeenCalled()
  expect(context.toggleToolCall).toHaveBeenCalledWith('call-1')
})
