import {
  text,
  type VirtualDomNode,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'
import type { IState } from '../CreateInstance/CreateInstance.ts'
import * as ClassNames from '../ClassNames/ClassNames.ts'
import * as DomEventListenerFunctions from '../DomEventListenerFunctions/DomEventListenerFunctions.ts'
import * as GptVoiceStrings from '../GptVoiceStrings/GptVoiceStrings.ts'
import { renderAllowanceExceeded } from '../RenderAllowanceExceeded/RenderAllowanceExceeded.ts'
import { renderAudio } from '../RenderAudio/RenderAudio.ts'
import { renderButton } from '../RenderButton/RenderButton.ts'
import { renderFundedError } from '../RenderFundedError/RenderFundedError.ts'
import { renderModelSettings } from '../RenderModelSettings/RenderModelSettings.ts'
import { renderOfflineError } from '../RenderOfflineError/RenderOfflineError.ts'
import { renderStage } from '../RenderStage/RenderStage.ts'
import { renderStatus } from '../RenderStatus/RenderStatus.ts'
import { renderTranscript } from '../RenderTranscript/RenderTranscript.ts'
import { renderWelcome } from '../RenderWelcome/RenderWelcome.ts'

const voiceContainerNode: VirtualDomNode = {
  childCount: 6,
  className: ClassNames.GptVoice,
  type: VirtualDomElements.Div,
}

const byokToolbarNode: VirtualDomNode = {
  childCount: 2,
  className: ClassNames.GptVoiceToolbar,
  type: VirtualDomElements.Div,
}

const fundedToolbarNode: VirtualDomNode = {
  ...byokToolbarNode,
  childCount: 1,
}

const apiKeyActionsNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceApiKeyActions,
  type: VirtualDomElements.Div,
}

const renderApiKeyActions = (
  voiceProvider: IState['voiceProvider'],
  inProgress: boolean,
): readonly VirtualDomNode[] => {
  if (voiceProvider !== 'byok') {
    return []
  }
  return [
    apiKeyActionsNode,
    {
      childCount: 1,
      className: ClassNames.GptVoiceApiKeyClearButton,
      disabled: inProgress,
      onClick: DomEventListenerFunctions.HandleClearOpenAiApiKey,
      type: VirtualDomElements.Button,
    },
    text(GptVoiceStrings.changeApiKey()),
  ]
}

export const render = (state: IState): readonly VirtualDomNode[] => {
  const {
    allowanceExceeded,
    fundedError,
    fundedErrorDetails,
    hasOpenAiApiKey,
    inProgress,
    offlineError,
    voiceProvider,
  } = state
  if (offlineError) {
    return renderOfflineError()
  }
  if (voiceProvider === 'funded' && fundedError) {
    if (allowanceExceeded) {
      return renderAllowanceExceeded(fundedErrorDetails)
    }
    return renderFundedError(
      GptVoiceStrings.fundedVoiceUnavailable(),
      fundedError,
    )
  }
  if (voiceProvider === 'byok' && !hasOpenAiApiKey) {
    return renderWelcome(state)
  }

  return [
    voiceContainerNode,
    voiceProvider === 'funded' ? fundedToolbarNode : byokToolbarNode,
    ...renderModelSettings(state),
    ...renderApiKeyActions(voiceProvider, inProgress),
    ...renderStage(state),
    ...renderStatus(state),
    ...renderButton(state),
    ...renderTranscript(state),
    ...renderAudio(),
  ]
}
