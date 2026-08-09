import type { Test } from '@lvce-editor/test-with-playwright'

export const name = 'gpt-voice.basic'

export const test: Test = async ({ expect, Locator, SideBar }) => {
  await SideBar.open('gpt-voice.views.default')
  const preview = Locator('.Viewlet.Preview')
  const main = preview.locator('.GptVoice')
  await expect(preview).toBeVisible()
  await expect(main).toBeVisible()
}
