import { expect, test } from '@jest/globals'
import { AriaRoles, VirtualDomElements } from '@lvce-editor/virtual-dom-worker'
import { mergeClassNames } from '../src/parts/MergeClassNames/MergeClassNames.ts'
import { renderActionsDom } from '../src/parts/RenderActionsDom/RenderActionsDom.ts'

test('renderActionsDom - renders a command-backed clear chat action', () => {
  expect(renderActionsDom()).toEqual([
    {
      ariaLabel: 'Voice chat actions',
      childCount: 1,
      className: 'Actions',
      role: AriaRoles.ToolBar,
      type: VirtualDomElements.Div,
    },
    {
      ariaLabel: 'Clear Chat',
      childCount: 1,
      className: 'IconButton',
      'data-command': 'GptVoice.handleClearChat',
      title: 'Clear Chat',
      type: VirtualDomElements.Button,
    },
    {
      childCount: 0,
      className: mergeClassNames('MaskIcon', 'MaskIconClearAll'),
      role: AriaRoles.None,
      type: VirtualDomElements.Div,
    },
  ])
})
