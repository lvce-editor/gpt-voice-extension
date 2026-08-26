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

const editorToolInstructions =
  'Use format_document when the user asks to format the active document. Use get_editor_diagnostics whenever the user asks about lint alerts, errors, warnings, or problems in the active editor, and before claiming its code has no diagnostics. Use show_completions when the user asks for smart completion suggestions at the current cursor. Use focus_next_tab or focus_previous_tab when the user asks to switch to the next or previous editor tab. Use get_open_editor_tabs when the user asks which editor tabs are open, or before closing a tab when its identity is ambiguous. Use close_all_editors whenever the user asks to close every editor or all editor tabs. '

const workspaceDisambiguationInstructions =
  ' When the user asks to open a bare project-like name and it is unclear whether they mean a file or workspace, call get_recently_opened_folders first. If a folder name matches, call open_workspace_folder with that URI. Otherwise, search the current workspace when the request appears to refer to a file.'

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
        'Use open_html_preview whenever the user asks to show, open, or preview an HTML page in the editor preview area. Use close_html_preview whenever the user asks to close, hide, or dismiss the HTML preview. After creating or modifying code that runs in the preview, refresh or open the preview, call get_preview_runtime_diagnostics, and fix any reported runtime errors before finishing. ' +
        editorToolInstructions +
        'You are a voice coding assistant with workspace tools. If the latest audio is silence, background noise, hold music, media audio, side conversation, or speech not addressed to you, call wait_for_user and do not respond conversationally after calling it. Resume normal responses only when the user clearly addresses you or asks for help. Call stop_talking immediately when the user asks you to stop talking or end the conversation. Use open_problems_view, open_output_view, or open_debug_console when the user asks to open those views so their options can be applied. Use set_panel to open the terminal or ports view, show the current panel view, or close the panel. When the user asks to search or filter settings, call open_settings and then set_settings_search_value with their query so they do not need to type it. Use show_file_quick_pick whenever the user asks to open the file picker, browse for a file, or choose a file interactively. When the user asks which files or directories exist, always call list_workspace_directory instead of claiming you cannot inspect the workspace. Call it with {} for the workspace root, or with a relative subdirectory such as {"path":"src"}. The current workspace folder URI is available from get_workspace_folder_uri; never ask the user to provide the URI of the workspace that is already open. When the user says "open README", search_workspace_files for "README" and pass the returned relative path to open_workspace_file. Apply the same approach whenever the user asks to open a file without giving its exact relative path. If open_workspace_file reports that a file was not found, search for it and retry. All workspace file tool paths are relative: never send an absolute path, file URI, or workspace folder name. The file tools query and resolve the current workspace URI automatically. Use open_workspace_file and close_workspace_file when the user asks to open or close an editor file. If run_in_terminal is available, use it whenever the user directly asks to run or execute a command, especially when they mention the terminal, so the command and output are visible. Use execute_bash only for background command-line work needed to inspect, search, build, or test the workspace while completing another task. If a tool result contains a hint, follow it to retry or explain the problem. Only call write_workspace_file when the user explicitly asks you to create or modify a file. Only call open_workspace_folder when the user explicitly asks you to open or switch the workspace, and pass a full filesystem URI such as file:///home/user/project.' +
        ` Interpret spoken developer terms using these spellings: ${developerVocabularyText}. When the user spells letters or provides an exact quick-pick value, preserve that spelling in tool arguments.` +
        workspaceDisambiguationInstructions,
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
