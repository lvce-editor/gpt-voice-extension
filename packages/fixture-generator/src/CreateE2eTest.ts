import type { NormalizedRecording } from './NormalizeTrace.ts'

export const createE2eTestSource = (fixture: NormalizedRecording): string => {
  const fixtureValue = JSON.stringify(fixture, null, 2)
  const toolCallLabels = fixture.expect.toolCalls.map(
    (toolCall) => `Ran ${toolCall.name}`,
  )
  return `import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = ${fixtureValue} as const
const expectedToolCallLabels = ${JSON.stringify(toolCallLabels)} as const

export const name = 'gpt-voice.fixture-${String(fixture.name)}'

export const test: Test = async ({ Command, expect, Locator, SideBar }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')

  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  const voice = Locator('.GptVoice')
  const userTranscript = Locator('.GptVoiceTranscriptItemUser')
  const assistantTranscript = Locator('.GptVoiceTranscriptItemAi')
  await expect(userTranscript).toHaveText(fixture.expect.userText)
  for (const label of expectedToolCallLabels) {
    await expect(voice).toContainText(label)
  }
  await expect(assistantTranscript).toHaveText(fixture.expect.assistantText)
}
`
}
