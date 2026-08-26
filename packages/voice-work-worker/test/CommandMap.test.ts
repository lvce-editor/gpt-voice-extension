import { expect, test } from '@jest/globals'
import { commandMap } from '../src/parts/CommandMap/CommandMap.ts'
import * as WorkTask from '../src/parts/WorkTask/WorkTask.ts'

test('exposes the voice work worker RPC interface', () => {
  expect(commandMap).toEqual({
    'VoiceWork.execute': WorkTask.execute,
    'VoiceWork.getToolDefinition': expect.any(Function),
  })
})

test('returns the work tool definition over RPC', () => {
  const getToolDefinition = commandMap[
    'VoiceWork.getToolDefinition'
  ] as () => unknown
  expect(getToolDefinition()).toEqual(
    expect.objectContaining({ name: 'do_work' }),
  )
})
