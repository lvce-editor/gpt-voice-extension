import type {
  FunctionToolDefinition,
  RealtimeModelPreset as RealtimeModelPresetType,
} from 'voice-shared'

export const RealtimeModelPreset = {
  Mini: 'gpt-realtime-2.1-mini',
  Standard: 'gpt-realtime-2.1',
} as const satisfies Readonly<Record<string, RealtimeModelPresetType>>

export type RealtimeModelPreset = RealtimeModelPresetType

type TranscriptionModel = 'gpt-4o-mini-transcribe' | 'gpt-4o-transcribe'
type ServerVadMode = 'server_vad'
type TurnDetectionConfig = {
  readonly create_response: boolean
  readonly interrupt_response: boolean
  readonly prefix_padding_ms: number
  readonly silence_duration_ms: number
  readonly threshold: number
  readonly type: ServerVadMode
}

type NoiseReductionMode = 'near_field' | 'far_field'
type NoiseReductionConfig = {
  readonly type: NoiseReductionMode
}

const developerVocabulary = [
  'API',
  'CLI',
  'CI (pronounced "see eye"; continuous integration)',
  'Git',
  'GitHub',
  'Knip (pronounced "nip"; configuration file knip.json)',
  'npm',
  'Node.js',
  'TypeScript',
  'JavaScript',
  'README (pronounced "read me")',
  'YAML (rhymes with "camel"; file extensions .yaml and .yml)',
  'YML (pronounced "why em el")',
  'VS Code',
  'LVCE Editor',
  'quick pick',
]

const developerVocabularyText = developerVocabulary.join(', ')
// Keep this content-free so it guides the language without leaking vocabulary.
const transcriptionPrompt = 'English speech.'

const getTranscriptionModel = (
  sessionModel: RealtimeModelPreset,
): TranscriptionModel => {
  if (sessionModel === RealtimeModelPreset.Mini) {
    return 'gpt-4o-mini-transcribe'
  }
  return 'gpt-4o-transcribe'
}

export const defaultSessionModel: RealtimeModelPreset = RealtimeModelPreset.Mini

const workDelegationInstructions =
  'Whenever the user asks you to create, modify, inspect, debug, test, run, open, configure, or otherwise perform work in the editor or workspace, call do_work exactly once with their complete request. This includes small editor actions and substantial coding tasks. Do not attempt the work conversationally. You may briefly acknowledge the request before the tool call. Wait for the tool result, then narrate its success and summary accurately. Never claim the work is complete before do_work reports success. Answer general knowledge questions conversationally when they do not require inspecting or changing the workspace.'

type SessionConfig = {
  readonly session: {
    readonly instructions: string
    readonly tool_choice: 'auto' | 'none' | 'required'
    readonly tools: readonly FunctionToolDefinition[]
    readonly audio: {
      readonly input: {
        readonly transcription: {
          readonly language: 'en'
          readonly model: TranscriptionModel
          readonly prompt: string
        }
        readonly turn_detection: TurnDetectionConfig
        readonly noise_reduction: NoiseReductionConfig
      }
      readonly output: {
        readonly voice: 'marin'
      }
    }
    readonly model: RealtimeModelPreset
    readonly type: 'realtime'
  }
}

export const createSessionConfig = (
  sessionModel: RealtimeModelPreset,
  tools: readonly FunctionToolDefinition[] = [],
): SessionConfig => {
  return {
    session: {
      audio: {
        input: {
          noise_reduction: {
            type: 'near_field',
          },
          transcription: {
            language: 'en',
            model: getTranscriptionModel(sessionModel),
            prompt: transcriptionPrompt,
          },
          turn_detection: {
            create_response: true,
            interrupt_response: false,
            prefix_padding_ms: 300,
            silence_duration_ms: 800,
            threshold: 0.7,
            type: 'server_vad',
          },
        },
        output: {
          voice: 'marin',
        },
      },
      instructions:
        'You are a pleasant voice coding assistant. Keep spoken responses concise. If the latest audio is silence, background noise, hold music, media audio, side conversation, or speech not addressed to you, call wait_for_user and do not respond conversationally after calling it. Resume normal responses only when the user clearly addresses you or asks for help. Call stop_talking immediately when the user asks you to stop talking or end the conversation. ' +
        workDelegationInstructions +
        ` Interpret spoken developer terms using these spellings: ${developerVocabularyText}. When the user spells letters or provides an exact value, preserve that spelling in tool arguments.`,
      model: sessionModel,
      tool_choice: 'auto',
      tools,
      type: 'realtime',
    },
  }
}

export const defaultSessionConfig = createSessionConfig(defaultSessionModel)

export const getOpenAiErrorMessage = (
  errorData: unknown,
  fallbackMessage: string,
): string => {
  if (
    !errorData ||
    typeof errorData !== 'object' ||
    !('error' in errorData) ||
    !errorData.error ||
    typeof errorData.error !== 'object'
  ) {
    return fallbackMessage
  }
  const { error } = errorData
  const code =
    'code' in error && typeof error.code === 'string' ? error.code : ''
  const message =
    'message' in error && typeof error.message === 'string' ? error.message : ''
  if (code && message) {
    return `${code}: ${message}`
  }
  if (message) {
    return message
  }
  if (code) {
    return `${code}: ${fallbackMessage}`
  }
  return fallbackMessage
}

export const getEphemeralKey = async (
  apiKey: string,
  sessionConfig: unknown = defaultSessionConfig,
): Promise<string> => {
  const tokenRes = await fetch(
    'https://api.openai.com/v1/realtime/client_secrets',
    {
      body: JSON.stringify(sessionConfig),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  )
  if (!tokenRes.ok) {
    let tokenErrorData: unknown
    try {
      tokenErrorData = await tokenRes.json()
    } catch {
      tokenErrorData = null
    }
    const tokenErrorMessage = getOpenAiErrorMessage(
      tokenErrorData,
      `Failed to create ephemeral token (${tokenRes.status})`,
    )
    throw new Error(tokenErrorMessage)
  }
  const tokenData = await tokenRes.json()
  const ephemeralKey = tokenData.value
  if (typeof ephemeralKey !== 'string' || ephemeralKey.length === 0) {
    throw new Error('Invalid ephemeral key response.')
  }
  return ephemeralKey
}

export const getSdp = async (
  offerSdp: string,
  ephemeralKey: string,
): Promise<string> => {
  const sdpResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
    body: offerSdp,
    headers: {
      Authorization: `Bearer ${ephemeralKey}`,
      'Content-Type': 'application/sdp',
    },
    method: 'POST',
  })
  const answerSdp = await sdpResponse.text()
  if (!sdpResponse.ok) {
    let errorData: unknown
    try {
      errorData = JSON.parse(answerSdp)
    } catch {
      errorData = null
    }
    throw new Error(
      getOpenAiErrorMessage(
        errorData,
        `Failed to create realtime session (${sdpResponse.status})`,
      ),
    )
  }
  return answerSdp
}
