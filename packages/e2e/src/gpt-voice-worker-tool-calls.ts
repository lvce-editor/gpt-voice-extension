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

export const name = 'gpt-voice.worker-tool-calls'

export const test: Test = async ({ Command, expect, Locator, SideBar }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')

  await Command.executeExtensionCommand(
    'GptVoice.reportWorkToolCall',
    'work-call',
    {
      argumentsValue: '{"path":"city.html"}',
      callId: 'read-call',
      name: 'read_workspace_file',
      type: 'started',
    },
  )

  const toolCall = Locator('.GptVoiceToolCall')
  await waitForAssertion(() =>
    expect(toolCall).toHaveText('●Running read_workspace_file…⌄'),
  )

  await Command.executeExtensionCommand(
    'GptVoice.reportWorkToolCall',
    'work-call',
    {
      callId: 'read-call',
      output: '{"content":"<!DOCTYPE html>"}',
      type: 'completed',
    },
  )

  const toggle = toolCall.locator('.GptVoiceToolCallButton')
  await waitForAssertion(() =>
    expect(toolCall).toHaveText('✓Ran read_workspace_file⌄'),
  )
  await expect(toggle).toHaveAttribute('name', 'work-call/read-call')

  // eslint-disable-next-line e2e/no-direct-click -- verifies delegated tool details use the existing disclosure UI
  await toggle.click()
  await waitForAssertion(() =>
    expect(toggle).toHaveAttribute('aria-expanded', 'true'),
  )
  await expect(toolCall.locator('.GptVoiceToolCallDetails')).toContainText(
    '"path": "city.html"',
  )
  await expect(toolCall.locator('.GptVoiceToolCallDetails')).toContainText(
    '"content": "<!DOCTYPE html>"',
  )
}
