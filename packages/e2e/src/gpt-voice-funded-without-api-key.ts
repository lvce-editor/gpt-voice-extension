import type { Test } from '@lvce-editor/test-with-playwright'

export const name = 'gpt-voice.funded-without-api-key'

export const test: Test = async ({ Command, expect, Locator, SideBar }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest', 'funded')
  await SideBar.open('gpt-voice.views.default')

  const apiKeyInput = Locator('.GptVoiceApiKeyInput')
  const button = Locator('.GptVoiceButton')
  await expect(apiKeyInput).toBeHidden()
  await expect(button).toHaveText('Start talking')

  await Command.executeExtensionCommand('GptVoice.handleClickStart')

  await expect(button).toHaveText('Stop talking')
}
