import type { Test } from '@lvce-editor/test-with-playwright'

export const name = 'gpt-voice.offline-error'

export const test: Test = async ({ Command, expect, Locator, SideBar }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest', 'funded')
  await SideBar.open('gpt-voice.views.default')
  await Command.executeExtensionCommand('GptVoice.setOfflineError', {
    code: 'connection_error',
    message: 'Backend-funded voice is unavailable.',
  })

  const illustration = Locator('.GptVoiceOfflineIllustration')
  const title = Locator('.GptVoiceOfflineTitle')
  const description = Locator('.GptVoiceOfflineDescription')
  const code = Locator('.GptVoiceOfflineCode')
  const retryButton = Locator('.GptVoiceOfflineRetryButton')
  const voiceButton = Locator('.GptVoiceButton')
  await expect(illustration).toBeVisible()
  await expect(title).toHaveText("You're offline.")
  await expect(description).toHaveText(
    'Voice needs an internet connection. Reconnect, then try again.',
  )
  await expect(code).toHaveText('Error code: ERR_INTERNET_DISCONNECTED')
  await expect(retryButton).toHaveText('Try again')

  await Command.executeExtensionCommand('GptVoice.handleClickStart')

  await expect(code).toBeHidden()
  await expect(voiceButton).toHaveText('Stop talking')
}
