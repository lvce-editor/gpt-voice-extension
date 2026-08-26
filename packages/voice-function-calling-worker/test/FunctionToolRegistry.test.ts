import { expect, test } from '@jest/globals'
import {
  executeRegisteredFunctionTool,
  getRealtimeTools,
  getRegisteredTools,
  getWorkTools,
} from '../src/parts/FunctionToolRegistry/FunctionToolRegistry.ts'

test('returns registered function tool definitions', () => {
  expect(getRegisteredTools()).toEqual([
    {
      description: 'Get weather for a location.',
      name: 'getweather',
      parameters: {
        additionalProperties: false,
        properties: {
          location: {
            description: 'Location to get the weather for',
            type: 'string',
          },
        },
        required: ['location'],
        type: 'object',
      },
      type: 'function',
    },
    {
      description:
        'Stop the voice conversation immediately when the user asks you to stop talking or end the conversation.',
      name: 'stop_talking',
      parameters: {
        additionalProperties: false,
        properties: {},
        type: 'object',
      },
      type: 'function',
    },
    {
      description:
        'Wait silently when the latest audio is silence, background noise, hold music, media audio, side conversation, or speech not addressed to the assistant.',
      name: 'wait_for_user',
      parameters: {
        additionalProperties: false,
        properties: {},
        type: 'object',
      },
      type: 'function',
    },
    expect.objectContaining({ name: 'format_document' }),
    expect.objectContaining({ name: 'get_editor_diagnostics' }),
    expect.objectContaining({ name: 'get_editor_selections' }),
    expect.objectContaining({ name: 'set_editor_selections' }),
    expect.objectContaining({ name: 'show_completions' }),
    expect.objectContaining({ name: 'close_sidebar' }),
    expect.objectContaining({ name: 'toggle_sidebar_position' }),
    expect.objectContaining({ name: 'focus_next_tab' }),
    expect.objectContaining({ name: 'focus_previous_tab' }),
    expect.objectContaining({ name: 'get_open_editor_tabs' }),
    expect.objectContaining({ name: 'close_all_editors' }),
    expect.objectContaining({ name: 'set_panel' }),
    expect.objectContaining({ name: 'open_problems_view' }),
    expect.objectContaining({ name: 'open_output_view' }),
    expect.objectContaining({ name: 'open_debug_console' }),
    expect.objectContaining({ name: 'open_process_explorer' }),
    expect.objectContaining({ name: 'open_html_preview' }),
    expect.objectContaining({ name: 'close_html_preview' }),
    expect.objectContaining({ name: 'get_preview_runtime_diagnostics' }),
    expect.objectContaining({ name: 'open_settings' }),
    expect.objectContaining({ name: 'set_settings_search_value' }),
    expect.objectContaining({ name: 'get_recently_opened_folders' }),
    expect.objectContaining({ name: 'get_workspace_folder_uri' }),
    expect.objectContaining({ name: 'open_workspace_folder' }),
    expect.objectContaining({ name: 'list_workspace_directory' }),
    expect.objectContaining({ name: 'search_workspace_files' }),
    expect.objectContaining({ name: 'read_workspace_file' }),
    expect.objectContaining({ name: 'write_workspace_file' }),
    expect.objectContaining({ name: 'open_workspace_file' }),
    expect.objectContaining({ name: 'close_workspace_file' }),
    expect.objectContaining({ name: 'show_file_quick_pick' }),
    expect.objectContaining({ name: 'set_quick_pick_value' }),
  ])
})

test('separates conversational tools from delegated work tools', () => {
  expect(getRealtimeTools().map((tool) => tool.name)).toEqual([
    'getweather',
    'stop_talking',
    'wait_for_user',
  ])
  expect(
    getWorkTools().some((tool) => tool.name === 'write_workspace_file'),
  ).toBe(true)
  expect(getWorkTools().some((tool) => tool.name === 'stop_talking')).toBe(
    false,
  )
})

test('includes the terminal tool only when enabled', () => {
  expect(
    getRegisteredTools().some((tool) => tool.name === 'execute_bash'),
  ).toBe(false)
  expect(
    getRegisteredTools(true).find((tool) => tool.name === 'execute_bash'),
  ).toEqual(
    expect.objectContaining({
      name: 'execute_bash',
      type: 'function',
    }),
  )
  expect(
    getRegisteredTools(true).find((tool) => tool.name === 'run_in_terminal'),
  ).toEqual(
    expect.objectContaining({
      name: 'run_in_terminal',
      type: 'function',
    }),
  )
})

test('executes a registered function tool call', () => {
  expect(
    executeRegisteredFunctionTool('getweather', '{"location":"London"}'),
  ).toEqual({
    conditions: 'Rain',
    humidity: 84,
    location: 'london',
    temperature: 14,
    unit: 'C',
  })
})

test('executes the stop talking function tool', () => {
  expect(executeRegisteredFunctionTool('stop_talking', '{}')).toEqual({
    stopped: true,
  })
})

test('executes the wait for user function tool', () => {
  expect(executeRegisteredFunctionTool('wait_for_user', '{}')).toEqual({
    waiting: true,
  })
})

test('rejects unknown function tools', () => {
  expect(() => executeRegisteredFunctionTool('unknown', '{}')).toThrow(
    'Unknown function tool: unknown',
  )
})

test.each(['[]', 'null', '"value"'])(
  'rejects non-object arguments: %s',
  (value) => {
    expect(() => executeRegisteredFunctionTool('getweather', value)).toThrow(
      'Function tool arguments must be a JSON object',
    )
  },
)

test('rejects malformed JSON arguments', () => {
  expect(() => executeRegisteredFunctionTool('getweather', '{')).toThrow()
})
