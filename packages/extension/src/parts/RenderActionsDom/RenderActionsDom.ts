import {
  AriaRoles,
  type VirtualDomNode,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'
import * as ClassNames from '../ClassNames/ClassNames.ts'
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

export const renderActionsDom = (): readonly VirtualDomNode[] => {
  const label = GptVoiceStrings.clearChat()
  return [
    actionsNode,
    {
      ariaLabel: label,
      childCount: 1,
      className: ClassNames.IconButton,
      'data-command': 'GptVoice.handleClearChat',
      title: label,
      type: VirtualDomElements.Button,
    },
    clearChatIconNode,
  ]
}
