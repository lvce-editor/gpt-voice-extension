import {
  type VirtualDomNode,
  text,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'
import type { ITranscript } from '../CreateInstance/CreateInstance.ts'
import { getTranscriptClassName } from '../GetTranscriptClassName/GetTranscriptClassName.ts'

export const renderTranscriptItem = (
  item: ITranscript,
): readonly VirtualDomNode[] => {
  return [
    {
      childCount: 1,
      className: getTranscriptClassName(item),
      type: VirtualDomElements.Div,
    },
    text(item.text),
  ]
}
