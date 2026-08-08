import type { Test } from '@lvce-editor/test-with-playwright'

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
  await new Promise((resolve) => {
    setTimeout(resolve, 1000)
  })

  await expect(button).toHaveText('Start talking')
}
