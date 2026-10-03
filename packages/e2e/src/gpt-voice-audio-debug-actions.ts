import type { Test } from '@lvce-editor/test-with-playwright'

export const name = 'gpt-voice.audio-debug-actions'

export const test: Test = async ({ Command, expect, Locator, SideBar }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await Command.execute('Preferences.update', {
    'gptvoice.audioDebug.enabled': true,
  })
  await SideBar.open('gpt-voice-audio.views.recordings')

  await Command.executeExtensionCommand('GptVoiceAudioDebug.saveForTest')
  const recordings = Locator('.GptVoiceAudioDebugRecording')
  await expect(recordings).toHaveCount(1)

  const refreshButton = Locator(
    '.SideBarTitleArea .IconButton[title="Refresh Recordings"]',
  )
  const refreshIcon = refreshButton.locator('.MaskIconRefresh')
  await expect(refreshButton).toBeVisible()
  await expect(refreshButton).toHaveAttribute(
    'data-command',
    'GptVoiceAudioDebug.refresh',
  )
  await expect(refreshIcon).toHaveCount(1)

  const clearAllButton = Locator(
    '.SideBarTitleArea .IconButton[title="Clear All Recordings"]',
  )
  const clearAllIcon = clearAllButton.locator('.MaskIconClearAll')
  await expect(clearAllButton).toBeVisible()
  await expect(clearAllButton).toHaveAttribute(
    'data-command',
    'GptVoiceAudioDebug.clearAll',
  )
  await expect(clearAllIcon).toHaveCount(1)

  await Command.executeExtensionCommand('GptVoiceAudioDebug.clearAll')
  await expect(recordings).toHaveCount(0)

  const settingsButton = Locator(
    '.SideBarTitleArea .IconButton[title="Open Audio Debug Settings"]',
  )
  const settingsIcon = settingsButton.locator('.MaskIconSettingsGear')
  await expect(settingsButton).toBeVisible()
  await expect(settingsButton).toHaveAttribute(
    'data-command',
    'GptVoiceAudioDebug.openSettings',
  )
  await expect(settingsIcon).toHaveCount(1)
}
