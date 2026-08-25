import { expect, test } from '@jest/globals'
import { formatToolCallValue } from '../src/parts/ToolCall/ToolCall.ts'

test('formatToolCallValue - formats JSON and preserves text', () => {
  expect(formatToolCallValue('{"path":"src"}')).toBe('{\n  "path": "src"\n}')
  expect(formatToolCallValue('plain text')).toBe('plain text')
})
