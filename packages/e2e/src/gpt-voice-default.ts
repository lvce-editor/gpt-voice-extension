import type { Test } from '@lvce-editor/test-with-playwright'

export const name = 'gpt-voice.basic'

export const test: Test = async ({ Command, expect, Locator }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await Command.execute('Layout.toggleSideBarView', 'gpt-voice.views.default')
  const main = Locator('.GptVoice')
  await expect(main).toBeVisible()
}
