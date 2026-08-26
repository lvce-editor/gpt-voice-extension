export interface AudioDebugRecording {
  readonly createdAt: number
  readonly mimeType: string
  readonly name: string
  readonly sequence: number
  readonly size: number
  readonly uri: string
}

export interface AudioDebugStorage {
  readonly clearAll: () => Promise<void>
  readonly list: () => Promise<readonly AudioDebugRecording[]>
  readonly read: (uri: string) => Promise<Blob>
  readonly remove: (uri: string) => Promise<void>
  readonly save: (blob: Blob) => Promise<AudioDebugRecording>
}

export interface BackendVoiceConfiguration {
  readonly accessToken: string
  readonly baseUrl: string
}

export interface CaptureFixtureOptions {
  readonly outputUri: string
  readonly source: Readonly<Record<string, unknown>>
}

export interface FunctionToolDefinition {
  readonly description: string
  readonly name: string
  readonly parameters: Readonly<Record<string, unknown>>
  readonly type: 'function'
}

export interface VoiceWorkConfiguration {
  readonly accessToken: string
  readonly endpoint: string
}

export interface VoiceWorkResult {
  readonly success: boolean
  readonly summary: string
}

export type RealtimeModelPreset = 'gpt-realtime-2.1-mini' | 'gpt-realtime-2.1'

export interface TranscriptMessage {
  readonly id: string
  readonly text: string
  readonly type: 'user' | 'ai'
}

export interface ToolCallMessage {
  readonly argumentsValue: string
  readonly expanded: boolean
  readonly id: string
  readonly name: string
  readonly output: string
  readonly status: 'completed' | 'failed' | 'in-progress'
  readonly type: 'tool'
}

export type VoiceMessage = TranscriptMessage | ToolCallMessage

export interface VoiceSessionState {
  readonly allowanceExceeded: boolean
  readonly animationEnabled: boolean
  readonly animationFrame: number
  readonly animationScale: number
  readonly apiKeyError: string
  readonly apiKeyInput: string
  readonly fundedAvailable: boolean
  readonly fundedError: string
  readonly hasOpenAiApiKey: boolean
  readonly inProgress: boolean
  readonly isCreatingToken: boolean
  readonly isSavingApiKey: boolean
  readonly isTest: boolean
  readonly messages: readonly VoiceMessage[]
  readonly offlineError: boolean
  readonly parsedData: readonly unknown[]
  readonly sessionModel: RealtimeModelPreset
  readonly tokenError: string
  readonly transcribedText: string
  readonly uid: number
  readonly voiceProvider: 'byok' | 'funded'
}
