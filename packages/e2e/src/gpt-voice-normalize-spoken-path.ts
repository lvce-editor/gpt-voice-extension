import type { Test } from '@lvce-editor/test-with-playwright'

export const name = 'gpt-voice.normalize-spoken-path'

export const test: Test = async ({ Command, expect, Locator, SideBar }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')

  await Command.executeExtensionCommand(
    'GptVoice.addTranscript',
    'assistant-message',
    "It's located at slash home slash simon slash Videos.",
    'ai',
  )

  const assistantMessage = Locator('.GptVoiceTranscriptItemAi')
  await expect(assistantMessage).toHaveText(
    "It's located at /home/simon/Videos.",
  )
}
