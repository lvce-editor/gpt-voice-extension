import { expect, test } from '@jest/globals'
import { commandMap } from '../src/parts/CommandMap/CommandMap.ts'
import * as VoiceSession from '../src/parts/VoiceSession/VoiceSession.ts'

test('exposes the deep voice session worker interface', () => {
  expect(commandMap).toEqual({
    'AudioDebug.clearAll': expect.any(Function),
    'AudioDebug.list': expect.any(Function),
    'AudioDebug.read': expect.any(Function),
    'AudioDebug.remove': expect.any(Function),
    'AudioDebug.save': expect.any(Function),
    'VoiceSession.create': VoiceSession.create,
    'VoiceSession.dispatch': VoiceSession.dispatch,
    'VoiceSession.dispose': VoiceSession.dispose,
  })
})
