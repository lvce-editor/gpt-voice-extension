import {
  text,
  type VirtualDomNode,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'
import type { IState } from '../CreateInstance/CreateInstance.ts'
import * as ClassNames from '../ClassNames/ClassNames.ts'
import * as DomEventListenerFunctions from '../DomEventListenerFunctions/DomEventListenerFunctions.ts'
import * as GptVoiceStrings from '../GptVoiceStrings/GptVoiceStrings.ts'
import { renderAudio } from '../RenderAudio/RenderAudio.ts'
import { renderButton } from '../RenderButton/RenderButton.ts'
import { renderModelSettings } from '../RenderModelSettings/RenderModelSettings.ts'
import { renderStage } from '../RenderStage/RenderStage.ts'
import { renderStatus } from '../RenderStatus/RenderStatus.ts'
import { renderTranscript } from '../RenderTranscript/RenderTranscript.ts'
import { renderWelcome } from '../RenderWelcome/RenderWelcome.ts'

const voiceContainerNode: VirtualDomNode = {
  childCount: 6,
  className: ClassNames.GptVoice,
  type: VirtualDomElements.Div,
}

const toolbarNode: VirtualDomNode = {
  childCount: 2,
  className: ClassNames.GptVoiceToolbar,
  type: VirtualDomElements.Div,
}

const apiKeyActionsNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceApiKeyActions,
  type: VirtualDomElements.Div,
}

export const render = (state: IState): readonly VirtualDomNode[] => {
  const { hasOpenAiApiKey, inProgress } = state
  if (!hasOpenAiApiKey) {
    return renderWelcome(state)
  }

  return [
    voiceContainerNode,
    toolbarNode,
    ...renderModelSettings(state),
    apiKeyActionsNode,
    {
      childCount: 1,
      className: ClassNames.GptVoiceApiKeyClearButton,
      disabled: inProgress,
      onClick: DomEventListenerFunctions.HandleClearOpenAiApiKey,
      type: VirtualDomElements.Button,
    },
    text(GptVoiceStrings.changeApiKey()),
    ...renderStage(state),
    ...renderStatus(state),
    ...renderButton(state),
    ...renderTranscript(state),
    ...renderAudio(),
  ]
}
