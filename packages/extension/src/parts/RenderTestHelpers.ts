import type { IState } from './CreateInstance/CreateInstance.ts'
import { RealtimeModelPreset } from './WebRtc/WebRtc.ts'

export const createRenderState = (state: Partial<IState> = {}): IState => {
  return {
    allowanceExceeded: false,
    animationEnabled: false,
    animationFrame: -1,
    animationScale: 1,
    apiKeyError: '',
    apiKeyInput: '',
    fundedAvailable: false,
    fundedError: '',
    hasOpenAiApiKey: true,
    inProgress: false,
    isCreatingToken: false,
    isSavingApiKey: false,
    isTest: false,
    messages: [],
    parsedData: [],
    sessionModel: RealtimeModelPreset.Mini,
    tokenError: '',
    transcribedText: '',
    uid: 1,
    voiceProvider: 'byok',
    ...state,
  }
}
