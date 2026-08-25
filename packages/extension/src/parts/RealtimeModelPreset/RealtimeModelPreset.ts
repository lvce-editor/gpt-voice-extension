import type { RealtimeModelPreset as RealtimeModelPresetType } from 'voice-shared'

export const RealtimeModelPreset = {
  Mini: 'gpt-realtime-2.1-mini',
  Standard: 'gpt-realtime-2.1',
} as const satisfies Readonly<Record<string, RealtimeModelPresetType>>

export type RealtimeModelPreset = RealtimeModelPresetType
