import { getPreference, type WebRtcAudioConstraints } from '@lvce-editor/api'

export const autoGainControlPreference = 'gptvoice.audio.autoGainControl'
export const echoCancellationPreference = 'gptvoice.audio.echoCancellation'
export const noiseSuppressionPreference = 'gptvoice.audio.noiseSuppression'

const getBooleanPreference = async (
  key: string,
  fallback: boolean,
): Promise<boolean> => {
  const value = await getPreference(key)
  return typeof value === 'boolean' ? value : fallback
}

export const getMicrophoneAudioConstraints =
  async (): Promise<WebRtcAudioConstraints> => {
    const [autoGainControl, echoCancellation, noiseSuppression] =
      await Promise.all([
        getBooleanPreference(autoGainControlPreference, false),
        getBooleanPreference(echoCancellationPreference, true),
        getBooleanPreference(noiseSuppressionPreference, true),
      ])
    return {
      autoGainControl,
      echoCancellation,
      noiseSuppression,
    }
  }
