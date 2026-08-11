import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'Done. I ran it in the terminal.',
    toolCalls: [
      {
        arguments: {
          command: 'echo hello world',
        },
        name: 'run_in_terminal',
        output: {
          command: 'echo hello world',
          success: true,
        },
      },
    ],
    userText: 'Run echo hello world in the terminal.',
  },
  name: 'run-in-terminal',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Run echo hello world in the terminal.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Run echo hello world in the terminal.',
        item_id: 'user_item_1',
        type: 'conversation.item.input_audio_transcription.delta',
      },
    },
    {
      atMs: 350,
      direction: 'server',
      event: {
        arguments: '{"command":"echo hello world"}',
        call_id: 'call_1',
        name: 'run_in_terminal',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_1',
          output: '{"command":"echo hello world","success":true}',
          type: 'function_call_output',
        },
        type: 'conversation.item.create',
      },
    },
    {
      atMs: 352,
      direction: 'client',
      event: {
        type: 'response.create',
      },
    },
    {
      atMs: 800,
      direction: 'server',
      event: {
        delta: 'Done. I ran it in the terminal.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const

const expectedToolCallLabels = ['Ran run_in_terminal'] as const

export const name = 'gpt-voice.fixture-run-in-terminal'

export const skip = 1

export const test: Test = async ({
  Command,
  expect,
  Locator,
  Settings,
  SideBar,
}) => {
  await Settings.update({
    'gptvoice.tools.terminal.enabled': true,
    'terminal.backend': 'mock',
  })

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

  const terminalTab = Locator('.PanelTab[name="Terminals"]')
  const terminal = Locator('.XtermTerminal')
  await expect(terminalTab).toBeVisible()
  await expect(terminal).toBeVisible()
  await expect(terminal).toContainText('echo hello world')
}
