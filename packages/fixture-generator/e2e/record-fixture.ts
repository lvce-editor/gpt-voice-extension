import type { Test } from '@lvce-editor/test-with-playwright'

export const name = 'gpt-voice.record-fixture'

interface RecordingConfig {
  readonly apiKey: string
  readonly outputUri: string
  readonly source: Readonly<Record<string, unknown>>
}

export const test: Test = async ({ Command, SideBar }) => {
  const response = await fetch('http://127.0.0.1:43123/config')
  if (!response.ok) {
    throw new Error(
      `Failed to load fixture recording config: ${response.status}`,
    )
  }
  const config = (await response.json()) as RecordingConfig
  await SideBar.open('gpt-voice.views.default')
  await Command.executeExtensionCommand(
    'GptVoice.handleOpenAiApiKeyInput',
    config.apiKey,
  )
  await Command.executeExtensionCommand('GptVoice.handleSaveOpenAiApiKey')
  await Command.executeExtensionCommand('GptVoice.captureFixture', {
    outputUri: config.outputUri,
    source: config.source,
  })
}
