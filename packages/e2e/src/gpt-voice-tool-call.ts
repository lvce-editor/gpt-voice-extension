import type { Test } from '@lvce-editor/test-with-playwright'

const waitForAssertion = async (
  assertion: () => Promise<void>,
): Promise<void> => {
  let lastError: unknown = new Error('Assertion did not pass')
  for (let attempt = 0; attempt < 1000; attempt++) {
    try {
      await assertion()
      return
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

export const name = 'gpt-voice.tool-call'

export const test: Test = async ({ Command, expect, Locator, SideBar }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')
  await Command.executeExtensionCommand(
    'GptVoice.addTranscript',
    'user-message',
    'What is the weather in Paris?',
    'user',
  )
  await Command.executeExtensionCommand(
    'GptVoice.handleData',
    JSON.stringify({
      arguments: JSON.stringify({ location: 'Paris' }),
      call_id: 'weather-call',
      name: 'getweather',
      type: 'response.function_call_arguments.done',
    }),
  )
  await Command.executeExtensionCommand(
    'GptVoice.addTranscript',
    'assistant-message',
    'In Paris, it is sunny and mild.',
    'ai',
  )

  const toolCall = Locator('.GptVoiceToolCall')
  const toggle = toolCall.locator('.GptVoiceToolCallButton')
  const toolCallDetails = toolCall.locator('.GptVoiceToolCallDetails')
  await waitForAssertion(() => expect(toolCall).toHaveText('✓Ran getweather⌄'))
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toHaveAttribute('name', 'weather-call')

  await Command.executeExtensionCommand(
    'GptVoice.toggleToolCall',
    'weather-call',
  )

  await waitForAssertion(() =>
    expect(toggle).toHaveAttribute('aria-expanded', 'true'),
  )
  await expect(toolCall).toHaveCSS('flex-shrink', '0')
  await expect(toolCallDetails).toContainText('"location": "Paris"')
  await expect(toolCallDetails).toContainText('"temperature": 20')
}
