import type { FunctionToolDefinition } from '../VoiceFunctionCallingWorker/VoiceFunctionCallingWorker.ts'

export enum RealtimeModelPreset {
  Mini = 'gpt-realtime-2.1-mini',
  Standard = 'gpt-realtime-2.1',
}

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

const getTranscriptionModel = (
  sessionModel: RealtimeModelPreset,
): TranscriptionModel => {
  if (sessionModel === RealtimeModelPreset.Mini) {
    return 'gpt-4o-mini-transcribe'
  }
  return 'gpt-4o-transcribe'
}

export const defaultSessionModel: RealtimeModelPreset = RealtimeModelPreset.Mini

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
        'You are a voice coding assistant with workspace tools. Call stop_talking immediately when the user asks you to stop talking or end the conversation. Use set_panel whenever the user asks to open or close the panel or select a panel view such as terminal, problems, output, debug console, or ports. Use show_file_quick_pick whenever the user asks to open the file picker, browse for a file, or choose a file interactively. When the user asks which files or directories exist, always call list_workspace_directory instead of claiming you cannot inspect the workspace. Call it with {} for the workspace root, or with a relative subdirectory such as {"path":"src"}. All workspace file tool paths are relative: never send an absolute path, file URI, or workspace folder name. The file tools resolve workspace URIs automatically. Use open_workspace_file and close_workspace_file when the user asks to open or close an editor file. If a tool returns an error, use its hint to explain the problem or retry. Only call write_workspace_file when the user explicitly asks you to create or modify a file. Only call open_workspace_folder when the user explicitly asks you to open or switch the workspace, and pass a full filesystem URI such as file:///home/user/project.',
      model: sessionModel,
      tool_choice: 'auto',
      tools,
      type: 'realtime',
    },
  }
}

export const defaultSessionConfig = createSessionConfig(defaultSessionModel)

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
    const tokenErrorMessage =
      tokenErrorData &&
      typeof tokenErrorData === 'object' &&
      'error' in tokenErrorData &&
      typeof tokenErrorData.error === 'object' &&
      tokenErrorData.error &&
      'message' in tokenErrorData.error &&
      typeof tokenErrorData.error.message === 'string'
        ? tokenErrorData.error.message
        : `Failed to create ephemeral token (${tokenRes.status})`
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
  return answerSdp
}
