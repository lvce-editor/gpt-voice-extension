import {
  activate as activateExtensionApi,
  executeCommand,
  registerCommand,
  registerFileSystemProvider,
  registerView,
} from '@lvce-editor/api'
import { createAudioDebugFileSystemProvider } from '../AudioDebugFileSystemProvider/AudioDebugFileSystemProvider.ts'
import { audioDebugView } from '../AudioDebugView/AudioDebugView.ts'
import { enableTestMode } from '../TestMode/TestMode.ts'
import { view } from '../View/View.ts'

const floatingWindowUrl =
  'lvce-oss://-/?floatingWindowMode=extensionView&floatingExtensionViewId=gpt-voice.views.default'

const state = {
  isActivated: false,
}

export const activate = async (): Promise<void> => {
  const { isActivated } = state
  if (isActivated) {
    return
  }
  state.isActivated = true
  await activateExtensionApi()
  registerFileSystemProvider(createAudioDebugFileSystemProvider())
  registerView(audioDebugView)
  registerView(view)
  registerCommand({
    async execute() {
      await executeCommand('Open.openUrl', floatingWindowUrl)
    },
    id: 'gpt-voice.show',
  })
  registerCommand({
    async execute(voiceProvider?: unknown) {
      enableTestMode(voiceProvider === 'funded' ? 'funded' : 'byok')
    },
    id: 'GptVoice.setIsTest',
  })
}
