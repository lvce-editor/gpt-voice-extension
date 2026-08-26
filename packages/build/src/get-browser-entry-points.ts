import path from 'node:path'

export const getBrowserEntryPoints = (
  root: string,
): Readonly<Record<string, string>> => {
  return {
    gptVoiceMain: path.join(
      root,
      'packages',
      'extension',
      'src',
      'gptVoiceMain.ts',
    ),
    voiceFunctionCallingWorkerMain: path.join(
      root,
      'packages',
      'voice-function-calling-worker',
      'src',
      'voiceFunctionCallingWorkerMain.ts',
    ),
    voiceSessionWorkerMain: path.join(
      root,
      'packages',
      'voice-session-worker',
      'src',
      'voiceSessionWorkerMain.ts',
    ),
    voiceWorkWorkerMain: path.join(
      root,
      'packages',
      'voice-work-worker',
      'src',
      'voiceWorkWorkerMain.ts',
    ),
  }
}
