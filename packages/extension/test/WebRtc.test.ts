import { afterEach, expect, jest, test } from '@jest/globals'
import {
  createSessionConfig,
  getEphemeralKey,
  getSdp,
  RealtimeModelPreset,
} from '../src/parts/WebRtc/WebRtc.ts'

afterEach(() => {
  jest.restoreAllMocks()
})

test('createSessionConfig - includes registered function tools', () => {
  const tools = [
    {
      description: 'Test tool',
      name: 'test',
      parameters: { type: 'object' },
      type: 'function' as const,
    },
  ]

  const config = createSessionConfig(RealtimeModelPreset.Standard, tools)

  expect(config.session.tools).toBe(tools)
  expect(config.session.instructions).toBe(
    'Use format_document when the user asks to format the active document. Use get_editor_diagnostics whenever the user asks about lint alerts, errors, warnings, or problems in the active editor, and before claiming its code has no diagnostics. Use show_completions when the user asks for smart completion suggestions at the current cursor. Use focus_next_tab or focus_previous_tab when the user asks to switch to the next or previous editor tab. Use get_open_editor_tabs when the user asks which editor tabs are open, or before closing a tab when its identity is ambiguous. Use close_all_editors whenever the user asks to close every editor or all editor tabs. You are a voice coding assistant with workspace tools. If the latest audio is silence, background noise, hold music, media audio, side conversation, or speech not addressed to you, call wait_for_user and do not respond conversationally after calling it. Resume normal responses only when the user clearly addresses you or asks for help. Call stop_talking immediately when the user asks you to stop talking or end the conversation. Use open_problems_view, open_output_view, or open_debug_console when the user asks to open those views so their options can be applied. Use set_panel to open the terminal or ports view, show the current panel view, or close the panel. When the user asks to search or filter settings, call open_settings and then set_settings_search_value with their query so they do not need to type it. Use show_file_quick_pick whenever the user asks to open the file picker, browse for a file, or choose a file interactively. When the user asks which files or directories exist, always call list_workspace_directory instead of claiming you cannot inspect the workspace. Call it with {} for the workspace root, or with a relative subdirectory such as {"path":"src"}. The current workspace folder URI is available from get_workspace_folder_uri; never ask the user to provide the URI of the workspace that is already open. When the user says "open README", search_workspace_files for "README" and pass the returned relative path to open_workspace_file. Apply the same approach whenever the user asks to open a file without giving its exact relative path. If open_workspace_file reports that a file was not found, search for it and retry. All workspace file tool paths are relative: never send an absolute path, file URI, or workspace folder name. The file tools query and resolve the current workspace URI automatically. Use open_workspace_file and close_workspace_file when the user asks to open or close an editor file. If execute_bash is available, use it when the user asks to run a terminal command or when a coding task requires command-line inspection, building, testing, or modification in the workspace. If a tool returns an error, use its hint to explain the problem or retry. Only call write_workspace_file when the user explicitly asks you to create or modify a file. Only call open_workspace_folder when the user explicitly asks you to open or switch the workspace, and pass a full filesystem URI such as file:///home/user/project. Interpret spoken developer terms using these spellings: API, CLI, CI (pronounced "see eye"; continuous integration), Git, GitHub, npm, Node.js, TypeScript, JavaScript, README (pronounced "read me"), YAML (rhymes with "camel"; file extensions .yaml and .yml), YML (pronounced "why em el"), VS Code, LVCE Editor, quick pick. When the user spells letters or provides an exact quick-pick value, preserve that spelling in tool arguments.',
  )
  expect(config.session.instructions).toContain(
    'Use focus_next_tab or focus_previous_tab when the user asks to switch to the next or previous editor tab.',
  )
  expect(config.session.instructions).toContain(
    'Use get_open_editor_tabs when the user asks which editor tabs are open, or before closing a tab when its identity is ambiguous.',
  )
  expect(config.session.instructions).toContain(
    'When the user asks to search or filter settings, call open_settings and then set_settings_search_value with their query so they do not need to type it.',
  )
  expect(config.session.instructions).toContain(
    'Use close_all_editors whenever the user asks to close every editor or all editor tabs.',
  )
  expect(config.session.instructions).toContain(
    'When the user says "open README", search_workspace_files for "README" and pass the returned relative path to open_workspace_file.',
  )
})

test('createSessionConfig - defaults to no tools', () => {
  expect(createSessionConfig(RealtimeModelPreset.Mini).session.tools).toEqual(
    [],
  )
})

test('createSessionConfig - selects transcription model for each realtime model', () => {
  const mini = createSessionConfig(RealtimeModelPreset.Mini)
  const standard = createSessionConfig(RealtimeModelPreset.Standard)

  expect(mini.session.audio.input.transcription.model).toBe(
    'gpt-4o-mini-transcribe',
  )
  expect(standard.session.audio.input.transcription.model).toBe(
    'gpt-4o-transcribe',
  )
  expect(mini.session.audio.input.transcription.language).toBe('en')
  expect(standard.session.audio.input.transcription.language).toBe('en')
  expect(mini.session.model).toBe(RealtimeModelPreset.Mini)
  expect(standard.session.model).toBe(RealtimeModelPreset.Standard)
})

test('createSessionConfig - does not add context to the user transcript', () => {
  const config = createSessionConfig(RealtimeModelPreset.Mini)

  expect(config.session.audio.input.transcription).not.toHaveProperty('prompt')
})

test('createSessionConfig - provides developer vocabulary to the realtime model', () => {
  const config = createSessionConfig(RealtimeModelPreset.Mini)

  expect(config.session.instructions).toContain(
    'Interpret spoken developer terms using these spellings: API, CLI, CI (pronounced "see eye"; continuous integration)',
  )
  expect(config.session.instructions).toContain(
    'YAML (rhymes with "camel"; file extensions .yaml and .yml), YML (pronounced "why em el")',
  )
})

test('getEphemeralKey - posts session and returns token', async () => {
  const sessionConfig = createSessionConfig(RealtimeModelPreset.Standard)
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    json: async () => ({ value: 'ephemeral-key' }),
    ok: true,
  } as Response)

  await expect(getEphemeralKey('sk-api-key', sessionConfig)).resolves.toBe(
    'ephemeral-key',
  )
  expect(fetch).toHaveBeenCalledWith(
    'https://api.openai.com/v1/realtime/client_secrets',
    {
      body: JSON.stringify(sessionConfig),
      headers: {
        Authorization: 'Bearer sk-api-key',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  )
})

test.each([
  [{ error: { message: 'invalid key' } }, 'invalid key'],
  [{}, 'Failed to create ephemeral token (400)'],
  [{ error: 'invalid' }, 'Failed to create ephemeral token (400)'],
  [{ error: null }, 'Failed to create ephemeral token (400)'],
  [{ error: {} }, 'Failed to create ephemeral token (400)'],
  [{ error: { message: 401 } }, 'Failed to create ephemeral token (400)'],
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
])('getEphemeralKey - reports token error %#', async (tokenData, message) => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    json: async () => tokenData,
    ok: false,
    status: 400,
  } as Response)

  await expect(getEphemeralKey('sk-api-key')).rejects.toThrow(message)
})

test('getEphemeralKey - reports status when error response is not json', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    json: async () => {
      throw new Error('invalid json')
    },
    ok: false,
    status: 502,
  } as unknown as Response)

  await expect(getEphemeralKey('sk-api-key')).rejects.toThrow(
    'Failed to create ephemeral token (502)',
  )
})

test.each([undefined, '', 1])(
  'getEphemeralKey - rejects invalid token %#',
  async (value) => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ value }),
      ok: true,
    } as Response)

    await expect(getEphemeralKey('sk-api-key')).rejects.toThrow(
      'Invalid ephemeral key response.',
    )
  },
)

test('getSdp - posts offer and returns answer', async () => {
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    text: async () => 'answer-sdp',
  } as Response)

  await expect(getSdp('offer-sdp', 'ephemeral-key')).resolves.toBe('answer-sdp')
  expect(fetch).toHaveBeenCalledWith(
    'https://api.openai.com/v1/realtime/calls',
    {
      body: 'offer-sdp',
      headers: {
        Authorization: 'Bearer ephemeral-key',
        'Content-Type': 'application/sdp',
      },
      method: 'POST',
    },
  )
})
