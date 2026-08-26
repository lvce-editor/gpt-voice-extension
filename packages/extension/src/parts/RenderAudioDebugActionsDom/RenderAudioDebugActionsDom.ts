import {
  AriaRoles,
  mergeClassNames,
  type VirtualDomNode,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'

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
): readonly VirtualDomNode[] => {
  return [
    {
      ariaLabel: label,
      childCount: 1,
      className: 'IconButton',
      'data-command': command,
      title: label,
      type: VirtualDomElements.Button,
    },
    {
      childCount: 0,
      className: mergeClassNames('MaskIcon', icon),
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
    ),
    ...renderAction(
      'GptVoiceAudioDebug.clearAll',
      'MaskIconClearAll',
      'Clear All Recordings',
    ),
    ...renderAction(
      'GptVoiceAudioDebug.openSettings',
      'MaskIconSettingsGear',
      'Open Audio Debug Settings',
    ),
  ]
}
