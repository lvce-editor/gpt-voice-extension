import * as AudioDebugStorage from '../AudioDebugStorage/AudioDebugStorage.ts'
import * as VoiceSession from '../VoiceSession/VoiceSession.ts'

export const commandMap: Readonly<Record<string, unknown>> = {
  'AudioDebug.list': AudioDebugStorage.audioDebugStorage.list,
  'AudioDebug.read': AudioDebugStorage.audioDebugStorage.read,
  'AudioDebug.remove': AudioDebugStorage.audioDebugStorage.remove,
  'AudioDebug.save': AudioDebugStorage.audioDebugStorage.save,
  'VoiceSession.create': VoiceSession.create,
  'VoiceSession.dispatch': VoiceSession.dispatch,
  'VoiceSession.dispose': VoiceSession.dispose,
}
