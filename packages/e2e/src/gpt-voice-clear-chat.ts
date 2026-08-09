import type { Test } from '@lvce-editor/test-with-playwright'

export const name = 'gpt-voice.clear-chat'

export const test: Test = async ({ Command, expect, Locator, SideBar }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')

  await Command.executeExtensionCommand(
    'GptVoice.addTranscript',
    'user-message',
    'Clear this message',
    'user',
  )

  const transcriptItems = Locator('.GptVoiceTranscriptItem')
  await expect(transcriptItems).toHaveText('Clear this message')

  const clearChat = Locator('.SideBarTitleArea .IconButton[title="Clear Chat"]')
  await expect(clearChat).toBeVisible()
  await expect(clearChat).toHaveAttribute(
    'data-command',
    'GptVoice.handleClearChat',
  )
  await expect(clearChat.locator('.MaskIconClearAll')).toHaveCount(1)

  await Command.executeExtensionCommand('GptVoice.handleClearChat')

  await expect(transcriptItems).toHaveCount(0)
}
