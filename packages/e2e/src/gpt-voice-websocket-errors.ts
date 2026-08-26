import type { Test } from '@lvce-editor/test-with-playwright'

export const name = 'gpt-voice.websocket-errors'

export const test: Test = async ({ Command, expect, Locator, SideBar }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest', 'funded')
  await SideBar.open('gpt-voice.views.default')

  const description = Locator('.GptVoiceWelcomeDescription')
  await Command.executeExtensionCommand('GptVoice.setFundedError', {
    error: {
      code: 'E_OPENAI_CLOSED_WEBSOCKET',
      message:
        'OpenAI closed its Realtime WebSocket connection to the LVCE voice backend unexpectedly. WebSocket close code: 1012; reason: Service restart.',
    },
    status: 502,
    type: 'error',
  })

  await expect(description).toHaveText(
    'OpenAI closed its Realtime WebSocket connection to the LVCE voice backend unexpectedly. WebSocket close code: 1012; reason: Service restart. (Error code: E_OPENAI_CLOSED_WEBSOCKET; HTTP status: 502)',
  )

  await Command.executeExtensionCommand('GptVoice.setFundedError', {
    error: {
      code: 'E_OUR_BACKEND_CLOSED_WEBSOCKET',
      message:
        'The LVCE voice backend closed its WebSocket connection to the editor unexpectedly. WebSocket close code: 1011; reason: Voice session failed.',
    },
    type: 'error',
  })

  await expect(description).toHaveText(
    'The LVCE voice backend closed its WebSocket connection to the editor unexpectedly. WebSocket close code: 1011; reason: Voice session failed. (Error code: E_OUR_BACKEND_CLOSED_WEBSOCKET)',
  )
}
