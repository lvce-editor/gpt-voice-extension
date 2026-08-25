import type { FileSystemProvider } from '@lvce-editor/api'
import type { AudioDebugStorage } from '../AudioDebugStorage/AudioDebugStorage.ts'
import { audioDebugScheme } from '../AudioDebugConstants/AudioDebugConstants.ts'
import { audioDebugStorage } from '../VoiceSessionWorker/VoiceSessionWorker.ts'

export const createAudioDebugFileSystemProvider = (
  storage: Readonly<AudioDebugStorage> = audioDebugStorage,
): FileSystemProvider => {
  return {
    id: audioDebugScheme,
    isReadonly: () => true,
    pathSeparator: '/',
    readFile: (uri: string) => storage.read(uri),
  }
}
