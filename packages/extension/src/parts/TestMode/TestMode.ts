const testModeState = {
  isEnabled: false,
  voiceProvider: 'byok' as 'byok' | 'funded',
}

export const enableTestMode = (
  voiceProvider: 'byok' | 'funded' = 'byok',
): void => {
  testModeState.isEnabled = true
  testModeState.voiceProvider = voiceProvider
}

export const isInTestMode = (): boolean => {
  return testModeState.isEnabled
}

export const getTestVoiceProvider = (): 'byok' | 'funded' => {
  return testModeState.voiceProvider
}
