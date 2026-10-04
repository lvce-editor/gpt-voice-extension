import {
  activate as activateExtensionApi,
  executeCommand,
  registerCommand,
  registerFileSystemProvider,
  registerView,
} from '@lvce-editor/api'
import { createAudioDebugFileSystemProvider } from '../AudioDebugFileSystemProvider/AudioDebugFileSystemProvider.ts'
import {
  audioDebugView,
  refreshActiveAudioDebugViewInstances,
} from '../AudioDebugView/AudioDebugView.ts'
import { enableTestMode } from '../TestMode/TestMode.ts'
import { view } from '../View/View.ts'
import { setRefreshAudioDebugViews } from '../VoiceSessionWorker/VoiceSessionWorker.ts'

const voiceExtensionViewUrl = 'extension-view:///gpt-voice.views.default'

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
  setRefreshAudioDebugViews(refreshActiveAudioDebugViewInstances)
  registerFileSystemProvider(createAudioDebugFileSystemProvider())
  registerView(audioDebugView)
  registerView(view)
  registerCommand({
    async execute() {
      await executeCommand('Layout.showPreview', 'simple-browser://')
      await executeCommand('SimpleBrowser.openOrRevealTab', voiceExtensionViewUrl)
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
