import type { Test } from '@lvce-editor/test-with-playwright'

export const name = 'gpt-voice.audio-debug-actions'

export const test: Test = async ({ expect, Locator, SideBar }) => {
  await SideBar.open('gpt-voice-audio.views.recordings')

  const refreshButton = Locator(
    '.SideBarTitleArea .IconButton[title="Refresh Recordings"]',
  )
  await expect(refreshButton).toBeVisible()
  await expect(refreshButton).toHaveAttribute(
    'data-command',
    'GptVoiceAudioDebug.refresh',
  )
  await expect(refreshButton.locator('.MaskIconRefresh')).toHaveCount(1)

  const clearAllButton = Locator(
    '.SideBarTitleArea .IconButton[title="Clear All Recordings"]',
  )
  await expect(clearAllButton).toBeVisible()
  await expect(clearAllButton).toHaveAttribute(
    'data-command',
    'GptVoiceAudioDebug.clearAll',
  )
  await expect(clearAllButton.locator('.MaskIconClearAll')).toHaveCount(1)

  const settingsButton = Locator(
    '.SideBarTitleArea .IconButton[title="Open Audio Debug Settings"]',
  )
  await expect(settingsButton).toBeVisible()
  await expect(settingsButton).toHaveAttribute(
    'data-command',
    'GptVoiceAudioDebug.openSettings',
  )
  await expect(settingsButton.locator('.MaskIconSettingsGear')).toHaveCount(1)
}
