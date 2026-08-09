import type { Test } from '@lvce-editor/test-with-playwright'

export const name = 'gpt-voice.auto-scroll-transcript'

export const test: Test = async ({ Command, expect, Locator, SideBar }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')

  await Command.executeExtensionCommand(
    'GptVoice.addTranscript',
    'long-message',
    'Long message '.repeat(400),
    'ai',
  )

  const transcript = Locator('.GptVoiceTranscript')
  await expect(transcript).not.toHaveJSProperty('scrollTop', 0)
}
