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

export const name = 'gpt-voice.set-animation'

export const test: Test = async ({ Command, expect, Locator, SideBar }) => {
  // arrange
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')
  const button = Locator('.GptVoiceButton')
  await expect(button).toBeVisible()
  await Command.executeExtensionCommand('GptVoice.handleClickStart')

  // act
  await Command.executeExtensionCommand('GptVoice.setAnimation', true, 2.1)

  // assert
  const bubble = Locator('.GptVoiceBubble')
  await expect(bubble).toBeVisible()
  await waitForAssertion(() =>
    expect(bubble).toHaveCSS(`transform`, `matrix(2.1, 0, 0, 2.1, 0, 0)`),
  )
}
