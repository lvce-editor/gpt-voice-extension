import {
  text,
  type VirtualDomNode,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'
import * as ClassNames from '../ClassNames/ClassNames.ts'
import * as DomEventListenerFunctions from '../DomEventListenerFunctions/DomEventListenerFunctions.ts'
import * as GptVoiceStrings from '../GptVoiceStrings/GptVoiceStrings.ts'
import { mergeClassNames } from '../MergeClassNames/MergeClassNames.ts'

const welcomeContainerNode: VirtualDomNode = {
  childCount: 1,
  className: mergeClassNames(ClassNames.GptVoice, ClassNames.GptVoiceSetup),
  type: VirtualDomElements.Div,
}

const welcomeNode: VirtualDomNode = {
  childCount: 5,
  className: ClassNames.GptVoiceWelcome,
  type: VirtualDomElements.Div,
}

const welcomeTitleNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceWelcomeTitle,
  type: VirtualDomElements.Div,
}

const welcomeDescriptionNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceWelcomeDescription,
  type: VirtualDomElements.Div,
}

const statusNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceStatus,
  type: VirtualDomElements.Div,
}

export const renderWelcome = (state: {
  readonly apiKeyError: string
  readonly apiKeyInput: string
  readonly isSavingApiKey: boolean
  readonly tokenError: string
}): readonly VirtualDomNode[] => {
  const { apiKeyError, apiKeyInput, isSavingApiKey, tokenError } = state
  const statusText = apiKeyError || tokenError
  return [
    welcomeContainerNode,
    welcomeNode,
    welcomeTitleNode,
    text(GptVoiceStrings.setUpOpenAiApiKey()),
    welcomeDescriptionNode,
    text(GptVoiceStrings.welcomeDescription()),
    {
      childCount: 0,
      className: ClassNames.GptVoiceApiKeyInput,
      disabled: isSavingApiKey,
      inputType: 'password',
      name: 'openAiApiKey',
      onInput: DomEventListenerFunctions.HandleOpenAiApiKeyInput,
      placeholder: 'sk-...',
      type: VirtualDomElements.Input,
      value: apiKeyInput,
    },
    {
      childCount: 1,
      className: ClassNames.GptVoiceButton,
      disabled: isSavingApiKey,
      onClick: DomEventListenerFunctions.HandleSaveOpenAiApiKey,
      type: VirtualDomElements.Button,
    },
    text(
      isSavingApiKey ? GptVoiceStrings.saving() : GptVoiceStrings.saveApiKey(),
    ),
    statusNode,
    text(statusText || GptVoiceStrings.openAiApiKeyRequiredForVoice()),
  ]
}
