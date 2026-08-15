import {
  text,
  type VirtualDomNode,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'
import * as ClassNames from '../ClassNames/ClassNames.ts'
import * as DomEventListenerFunctions from '../DomEventListenerFunctions/DomEventListenerFunctions.ts'
import * as GptVoiceStrings from '../GptVoiceStrings/GptVoiceStrings.ts'

const buttonNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceButton,
  id: 'toggle',
  onClick: DomEventListenerFunctions.HandleClickStart,
  type: VirtualDomElements.Button,
}

const disabledButtonNode: VirtualDomNode = {
  ...buttonNode,
  disabled: true,
}

export const renderButton = (state: {
  readonly inProgress: boolean
  readonly hasOpenAiApiKey: boolean
  readonly isCreatingToken: boolean
  readonly isSavingApiKey: boolean
  readonly voiceProvider: 'byok' | 'funded'
}): readonly VirtualDomNode[] => {
  const {
    hasOpenAiApiKey,
    inProgress,
    isCreatingToken,
    isSavingApiKey,
    voiceProvider,
  } = state
  if (
    (voiceProvider === 'byok' && !hasOpenAiApiKey) ||
    isCreatingToken ||
    isSavingApiKey
  ) {
    let label = GptVoiceStrings.startTalking()
    if (isCreatingToken) {
      label = GptVoiceStrings.creatingToken()
    } else if (isSavingApiKey) {
      label = GptVoiceStrings.savingKey()
    }
    return [disabledButtonNode, text(label)]
  }

  if (inProgress) {
    return [buttonNode, text(GptVoiceStrings.stopTalking())]
  }

  return [buttonNode, text(GptVoiceStrings.startTalking())]
}
