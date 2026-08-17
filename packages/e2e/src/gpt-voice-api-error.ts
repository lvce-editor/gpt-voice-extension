import type { Test } from '@lvce-editor/test-with-playwright'

export const name = 'gpt-voice.api-error'

export const test: Test = async ({ Command, expect, Locator, SideBar }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')
  await Command.executeExtensionCommand('GptVoice.handleClickStart')
  await Command.executeExtensionCommand(
    'GptVoice.handleData',
    JSON.stringify({
      error: {
        code: 'credit_balance_exhausted',
        message:
          'You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.',
        type: 'insufficient_quota',
      },
      type: 'error',
    }),
  )

  const status = Locator('.GptVoiceStatus')
  await expect(status).toContainText('credit_balance_exhausted')
  await expect(status).toContainText(
    'You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.',
  )
}
