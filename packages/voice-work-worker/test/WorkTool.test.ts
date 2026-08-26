import { expect, test } from '@jest/globals'
import { doWorkTool } from '../src/parts/WorkTool/WorkTool.ts'

test('defines the high-level work delegation tool', () => {
  expect(doWorkTool).toEqual(
    expect.objectContaining({
      name: 'do_work',
      type: 'function',
    }),
  )
  expect(doWorkTool.parameters).toEqual(
    expect.objectContaining({
      required: ['task'],
      type: 'object',
    }),
  )
})
