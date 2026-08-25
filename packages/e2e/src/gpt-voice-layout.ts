import type { Test } from '@lvce-editor/test-with-playwright'

export const name = 'gpt-voice.layout'

export const test: Test = async ({ Command, expect, Locator, Panel }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await Command.execute('Layout.toggleSideBarView', 'gpt-voice.views.default')
  await Panel.open('Problems')

  const main = Locator('.GptVoice')
  const actions = Locator('.PreviewArea > .GptVoice + .Actions')
  const panel = Locator('.Panel')
  const toolbar = Locator('.GptVoiceToolbar')
  const transcript = Locator('.GptVoiceTranscript')

  await expect(main).toHaveCSS('justify-content', 'flex-start')
  await expect(main).toHaveJSProperty('clientHeight', 700)
  await expect(main).toHaveJSProperty('clientWidth', 640)
  await expect(panel).toHaveJSProperty('clientWidth', 640)
  await expect(actions).toHaveCSS('background-color', 'rgb(10, 12, 20)')
  await expect(toolbar).toHaveCSS('display', 'flex')
  await expect(transcript).toHaveCSS('flex-grow', '1')
  await expect(transcript).toHaveCSS('overflow-y', 'auto')
}
