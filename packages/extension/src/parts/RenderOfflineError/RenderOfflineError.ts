import {
  text,
  type VirtualDomNode,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'
import * as ClassNames from '../ClassNames/ClassNames.ts'
import * as DomEventListenerFunctions from '../DomEventListenerFunctions/DomEventListenerFunctions.ts'
import * as GptVoiceStrings from '../GptVoiceStrings/GptVoiceStrings.ts'
import { mergeClassNames } from '../MergeClassNames/MergeClassNames.ts'

const containerNode: VirtualDomNode = {
  childCount: 1,
  className: mergeClassNames(ClassNames.GptVoice, ClassNames.GptVoiceSetup),
  type: VirtualDomElements.Div,
}

const contentNode: VirtualDomNode = {
  childCount: 5,
  className: ClassNames.GptVoiceOffline,
  type: VirtualDomElements.Div,
}

const illustrationNode: VirtualDomNode = {
  childCount: 0,
  className: ClassNames.GptVoiceOfflineIllustration,
  type: VirtualDomElements.Div,
}

const titleNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceOfflineTitle,
  type: VirtualDomElements.Div,
}

const descriptionNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceOfflineDescription,
  type: VirtualDomElements.Div,
}

const errorCodeNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceOfflineCode,
  type: VirtualDomElements.Div,
}

const retryButtonNode: VirtualDomNode = {
  childCount: 1,
  className: mergeClassNames(
    ClassNames.GptVoiceButton,
    ClassNames.GptVoiceOfflineRetryButton,
  ),
  onClick: DomEventListenerFunctions.HandleClickStart,
  type: VirtualDomElements.Button,
}

export const renderOfflineError = (): readonly VirtualDomNode[] => [
  containerNode,
  contentNode,
  illustrationNode,
  titleNode,
  text(GptVoiceStrings.offlineTitle()),
  descriptionNode,
  text(GptVoiceStrings.offlineDescription()),
  errorCodeNode,
  text(GptVoiceStrings.offlineErrorCode()),
  retryButtonNode,
  text(GptVoiceStrings.tryAgain()),
]
