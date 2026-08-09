import { expect, test } from '@jest/globals'
import {
  formatToolCallValue,
  getToolCallOutput,
  isToolCallErrorOutput,
  parseToolCall,
} from '../src/parts/ToolCall/ToolCall.ts'

const toolCall = {
  arguments: '{"path":"src"}',
  call_id: 'call-1',
  name: 'list_workspace_directory',
}

test('parseToolCall - parses supported realtime events', () => {
  expect(
    parseToolCall({
      ...toolCall,
      type: 'response.function_call_arguments.done',
    }),
  ).toEqual({
    argumentsValue: toolCall.arguments,
    callId: toolCall.call_id,
    name: toolCall.name,
  })
  expect(
    parseToolCall({
      item: { ...toolCall, type: 'function_call' },
      type: 'response.output_item.done',
    }),
  ).toEqual({
    argumentsValue: toolCall.arguments,
    callId: toolCall.call_id,
    name: toolCall.name,
  })
})

test('parseToolCall - ignores unrelated and incomplete values', () => {
  expect(parseToolCall(undefined)).toBeUndefined()
  expect(parseToolCall('event')).toBeUndefined()
  expect(parseToolCall({})).toBeUndefined()
  expect(parseToolCall({ type: 'other' })).toBeUndefined()

  for (const event of [
    { ...toolCall, call_id: 1 },
    { ...toolCall, name: 1 },
    { ...toolCall, arguments: 1 },
  ]) {
    expect(
      parseToolCall({
        ...event,
        type: 'response.function_call_arguments.done',
      }),
    ).toBeUndefined()
  }

  expect(parseToolCall({ type: 'response.output_item.done' })).toBeUndefined()
  expect(
    parseToolCall({ item: 'item', type: 'response.output_item.done' }),
  ).toBeUndefined()
  expect(
    parseToolCall({
      item: { ...toolCall, type: 'message' },
      type: 'response.output_item.done',
    }),
  ).toBeUndefined()
  for (const item of [
    { ...toolCall, call_id: 1 },
    { ...toolCall, name: 1 },
    { ...toolCall, arguments: 1 },
  ]) {
    expect(
      parseToolCall({
        item: { ...item, type: 'function_call' },
        type: 'response.output_item.done',
      }),
    ).toBeUndefined()
  }
})

test('getToolCallOutput - returns matching output', () => {
  const message = JSON.stringify({
    item: {
      call_id: 'call-1',
      output: '{"files":["a.ts"]}',
      type: 'function_call_output',
    },
    type: 'conversation.item.create',
  })
  expect(getToolCallOutput(['not-json', message], 'call-1')).toBe(
    '{"files":["a.ts"]}',
  )
})

test('getToolCallOutput - ignores unrelated messages and uses a fallback', () => {
  const values: readonly unknown[] = [
    null,
    {},
    { type: 'other' },
    { type: 'conversation.item.create' },
    { item: 'item', type: 'conversation.item.create' },
    { item: { type: 'message' }, type: 'conversation.item.create' },
    {
      item: { call_id: 'other', output: 'value', type: 'function_call_output' },
      type: 'conversation.item.create',
    },
    {
      item: { call_id: 'call-1', output: 1, type: 'function_call_output' },
      type: 'conversation.item.create',
    },
  ]
  expect(
    getToolCallOutput(
      values.map((value) => JSON.stringify(value)),
      'call-1',
    ),
  ).toBe('(no output)')
})

test.each([
  ['{"error":"Not found","tool":"open_workspace_file"}', true],
  ['{"opened":true}', false],
  ['{"error":1}', false],
  ['plain text', false],
])(
  'isToolCallErrorOutput - detects tool error output %#',
  (value, expected) => {
    expect(isToolCallErrorOutput(value)).toBe(expected)
  },
)

test('formatToolCallValue - formats JSON and preserves text', () => {
  expect(formatToolCallValue('{"path":"src"}')).toBe('{\n  "path": "src"\n}')
  expect(formatToolCallValue('plain text')).toBe('plain text')
})
