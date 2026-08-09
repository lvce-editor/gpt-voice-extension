import { expect, test } from '@jest/globals'
import { AriaRoles, VirtualDomElements } from '@lvce-editor/virtual-dom-worker'
import * as DomEventListenerFunctions from '../src/parts/DomEventListenerFunctions/DomEventListenerFunctions.ts'
import { mergeClassNames } from '../src/parts/MergeClassNames/MergeClassNames.ts'
import { renderActionsDom } from '../src/parts/RenderActionsDom/RenderActionsDom.ts'

test('renderActionsDom - renders a disabled clear chat action for an empty chat', () => {
  expect(renderActionsDom({ messages: [] })).toEqual([
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
      disabled: true,
      onClick: DomEventListenerFunctions.HandleClearChat,
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

test('renderActionsDom - enables the clear chat action when messages exist', () => {
  const messages = [{ id: 'one', text: 'Hello', type: 'user' as const }]

  expect(renderActionsDom({ messages })[1]).toMatchObject({ disabled: false })
})
