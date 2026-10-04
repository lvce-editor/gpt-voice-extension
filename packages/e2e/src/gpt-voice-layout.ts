import type { Test } from '@lvce-editor/test-with-playwright'

export const name = 'gpt-voice.layout'

export const test: Test = async ({ Command, expect, Locator, Panel }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await Command.executeExtensionCommand('gpt-voice.show')
  await Command.executeExtensionCommand('gpt-voice.show')
  await Panel.open('Problems')

  const main = Locator('.GptVoice')
  const tab = Locator('.SimpleBrowserTab[aria-label="Gpt Voice"]')
  const simpleBrowser = Locator('.SimpleBrowser')
  const secondaryPreviewVoice = Locator('.SecondaryPreview .GptVoice')
  const toolbar = Locator('.GptVoiceToolbar')
  const transcript = Locator('.GptVoiceTranscript')

  await expect(tab).toHaveCount(1)
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  await expect(simpleBrowser).toHaveCount(1)
  await expect(secondaryPreviewVoice).toHaveCount(0)
  await expect(main).toBeVisible()
  await expect(main).toHaveCSS('justify-content', 'flex-start')
  await expect(toolbar).toHaveCSS('display', 'flex')
  await expect(transcript).toHaveCSS('flex-grow', '1')
  await expect(transcript).toHaveCSS('overflow-y', 'auto')
}
