import {
  AriaRoles,
  mergeClassNames,
  type VirtualDomNode,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'
import * as DomEventListenerFunctions from '../DomEventListenerFunctions/DomEventListenerFunctions.ts'

const actionsNode: VirtualDomNode = {
  ariaLabel: 'Voice audio recording actions',
  childCount: 3,
  className: 'Actions',
  role: AriaRoles.ToolBar,
  type: VirtualDomElements.Div,
}

const renderAction = (
  command: string,
  icon: string,
  label: string,
  name: string,
): readonly VirtualDomNode[] => {
  return [
    {
      ariaLabel: label,
      childCount: 1,
      className: 'IconButton',
      'data-command': command,
      name,
      onClick: DomEventListenerFunctions.HandleAudioDebugClick,
      title: label,
      type: VirtualDomElements.Button,
    },
    {
      childCount: 0,
      className: mergeClassNames('MaskIcon', icon),
      name,
      role: AriaRoles.None,
      type: VirtualDomElements.Div,
    },
  ]
}

export const renderAudioDebugActionsDom = (): readonly VirtualDomNode[] => {
  return [
    actionsNode,
    ...renderAction(
      'GptVoiceAudioDebug.refresh',
      'MaskIconRefresh',
      'Refresh Recordings',
      'refresh',
    ),
    ...renderAction(
      'GptVoiceAudioDebug.clearAll',
      'MaskIconClearAll',
      'Clear All Recordings',
      'clearAll',
    ),
    ...renderAction(
      'GptVoiceAudioDebug.openSettings',
      'MaskIconSettingsGear',
      'Open Audio Debug Settings',
      'openSettings',
    ),
  ]
}
