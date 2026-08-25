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

export const name = 'gpt-voice.stop-animation'

export const test: Test = async ({ Command, expect, Locator, SideBar }) => {
  // arrange
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')
  const button = Locator('.GptVoiceButton')
  await expect(button).toBeVisible()
  await Command.executeExtensionCommand('GptVoice.handleClickStart')
  await Command.executeExtensionCommand('GptVoice.setAnimation', true, 2.1)
  const bubble = Locator('.GptVoiceBubble')
  await waitForAssertion(() =>
    expect(bubble).toHaveCSS(`transform`, `matrix(2.1, 0, 0, 2.1, 0, 0)`),
  )

  // act
  await Command.executeExtensionCommand('GptVoice.setAnimation', false, 1)

  // assert
  await expect(bubble).toBeVisible()
  await waitForAssertion(() =>
    expect(bubble).toHaveCSS(`transform`, `matrix(1, 0, 0, 1, 0, 0)`),
  )
}
