import type { Test } from '@lvce-editor/test-with-playwright'

const waitForAssertion = async (
  assertion: () => Promise<void>,
): Promise<void> => {
  let lastError: unknown = new Error('Assertion did not pass')
  for (let attempt = 0; attempt < 1000; attempt++) {
    try {
      await assertion()
      return
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

export const name = 'gpt-voice.stop-talking-tool'

export const test: Test = async ({ Command, expect, Locator, SideBar }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')
  await Command.executeExtensionCommand('GptVoice.handleClickStart')

  const button = Locator('.GptVoiceButton')
  await expect(button).toHaveText('Stop talking')

  await Command.executeExtensionCommand(
    'GptVoice.handleData',
    JSON.stringify({
      arguments: '{}',
      call_id: 'stop-call',
      name: 'stop_talking',
      type: 'response.function_call_arguments.done',
    }),
  )

  await waitForAssertion(() => expect(button).toHaveText('Start talking'))
}
