import { expect, test } from '@jest/globals'
import {
  executeRegisteredFunctionTool,
  getRegisteredTools,
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
    expect.objectContaining({ name: 'set_panel' }),
    expect.objectContaining({ name: 'open_problems_view' }),
    expect.objectContaining({ name: 'open_output_view' }),
    expect.objectContaining({ name: 'open_debug_console' }),
    expect.objectContaining({ name: 'open_workspace_folder' }),
    expect.objectContaining({ name: 'list_workspace_directory' }),
    expect.objectContaining({ name: 'read_workspace_file' }),
    expect.objectContaining({ name: 'write_workspace_file' }),
    expect.objectContaining({ name: 'open_workspace_file' }),
    expect.objectContaining({ name: 'close_workspace_file' }),
    expect.objectContaining({ name: 'show_file_quick_pick' }),
  ])
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
