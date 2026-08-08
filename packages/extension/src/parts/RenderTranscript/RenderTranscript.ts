import {
  type VirtualDomNode,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'
import type { IState } from '../CreateInstance/CreateInstance.ts'
import * as ClassNames from '../ClassNames/ClassNames.ts'
import { renderMessage } from '../RenderMessage/RenderMessage.ts'

export const renderTranscript = (state: IState): readonly VirtualDomNode[] => {
  const { messages } = state
  return [
    {
      childCount: messages.length,
      className: ClassNames.GptVoiceTranscript,
      type: VirtualDomElements.Div,
    },
    ...messages.flatMap(renderMessage),
  ]
}
