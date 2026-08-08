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
    expect.objectContaining({ name: 'set_panel' }),
    expect.objectContaining({ name: 'open_workspace_folder' }),
    expect.objectContaining({ name: 'list_workspace_directory' }),
    expect.objectContaining({ name: 'read_workspace_file' }),
    expect.objectContaining({ name: 'write_workspace_file' }),
    expect.objectContaining({ name: 'open_workspace_file' }),
    expect.objectContaining({ name: 'close_workspace_file' }),
    expect.objectContaining({ name: 'show_file_quick_pick' }),
  ])
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
