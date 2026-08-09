import {
  AriaRoles,
  type VirtualDomNode,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'
import type { IMessage } from '../CreateInstance/CreateInstance.ts'
import * as ClassNames from '../ClassNames/ClassNames.ts'
import * as DomEventListenerFunctions from '../DomEventListenerFunctions/DomEventListenerFunctions.ts'
import * as GptVoiceStrings from '../GptVoiceStrings/GptVoiceStrings.ts'
import { mergeClassNames } from '../MergeClassNames/MergeClassNames.ts'

const clearChatIconNode: VirtualDomNode = {
  childCount: 0,
  className: mergeClassNames(ClassNames.MaskIcon, ClassNames.MaskIconClearAll),
  role: AriaRoles.None,
  type: VirtualDomElements.Div,
}

const actionsNode: VirtualDomNode = {
  ariaLabel: 'Voice chat actions',
  childCount: 1,
  className: ClassNames.Actions,
  role: AriaRoles.ToolBar,
  type: VirtualDomElements.Div,
}

export const renderActionsDom = (state: {
  readonly messages: readonly IMessage[]
}): readonly VirtualDomNode[] => {
  const { messages } = state
  const label = GptVoiceStrings.clearChat()
  return [
    actionsNode,
    {
      ariaLabel: label,
      childCount: 1,
      className: ClassNames.IconButton,
      disabled: messages.length === 0,
      onClick: DomEventListenerFunctions.HandleClearChat,
      title: label,
      type: VirtualDomElements.Button,
    },
    clearChatIconNode,
  ]
}
