import type { Test } from '@lvce-editor/test-with-playwright'

export const name = 'gpt-voice.monthly-allowance-exceeded'

export const test: Test = async ({ Command, expect, Locator, SideBar }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest', 'funded')
  await SideBar.open('gpt-voice.views.default')
  await Command.executeExtensionCommand('GptVoice.setFundedError', {
    error: {
      code: 'E_LVCE_USAGE_EXCEEDED',
      message:
        'Monthly virtual token allowance exceeded for your Free plan. Your plan includes 114,286 virtual tokens per month, and you have used 115,093 this month.',
      statusCode: 402,
    },
    type: 'error',
  })

  const allowanceCard = Locator('.GptVoiceAllowance')
  const illustration = Locator('.GptVoiceAllowanceIllustration')
  const title = Locator('.GptVoiceAllowanceTitle')
  const description = Locator('.GptVoiceAllowanceDescription')
  const details = Locator('.GptVoiceAllowanceDetails')
  const ownApiKeyButton = Locator('button.GptVoiceButton')
  const pricingLink = Locator('.GptVoiceAllowancePricingLink')

  await expect(allowanceCard).toBeVisible()
  await expect(illustration).toBeVisible()
  await expect(title).toHaveText('Monthly AI allowance reached')
  await expect(description).toHaveText(
    "You've used the AI included with your current plan. Upgrade to continue using voice.",
  )
  await expect(details).toContainText('HTTP status')
  await expect(details).toContainText('402')
  await expect(details).toContainText('Error code')
  await expect(details).toContainText('E_LVCE_USAGE_EXCEEDED')
  await expect(details).toContainText('Description')
  await expect(details).toContainText('Monthly allowance exceeded.')
  await expect(pricingLink).toHaveText('View plans and pricing')
  await expect(pricingLink).toHaveAttribute(
    'href',
    'https://lvce-editor.dev/pricing',
  )
  await expect(ownApiKeyButton).toBeHidden()
}
