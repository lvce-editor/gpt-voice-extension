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
  childCount: 3,
  className: ClassNames.GptVoiceWelcome,
  type: VirtualDomElements.Div,
}

const titleNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceWelcomeTitle,
  type: VirtualDomElements.Div,
}

const descriptionNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceWelcomeDescription,
  type: VirtualDomElements.Div,
}

const useOwnApiKeyButtonNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceButton,
  onClick: DomEventListenerFunctions.HandleUseOwnApiKey,
  type: VirtualDomElements.Button,
}

export const renderFundedError = (
  title: string,
  message: string,
): readonly VirtualDomNode[] => [
  containerNode,
  contentNode,
  titleNode,
  text(title),
  descriptionNode,
  text(message),
  useOwnApiKeyButtonNode,
  text(GptVoiceStrings.useOwnApiKey()),
]
