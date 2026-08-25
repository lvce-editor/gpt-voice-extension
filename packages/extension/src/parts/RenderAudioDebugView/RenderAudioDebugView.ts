import {
  text,
  VirtualDomElements,
  type VirtualDomNode,
} from '@lvce-editor/virtual-dom-worker'
import type { AudioDebugRecording } from '../AudioDebugStorage/AudioDebugStorage.ts'

const handleClick = 'handleClick'
const handleContextMenu = 'handleContextMenu'

export interface AudioDebugViewState {
  readonly enabled: boolean
  readonly error: string
  readonly recordings: readonly AudioDebugRecording[]
}

const messageNode: VirtualDomNode = {
  childCount: 1,
  className: 'GptVoiceAudioDebugMessage',
  type: VirtualDomElements.Div,
}

const listItemNode: VirtualDomNode = {
  childCount: 1,
  className: 'GptVoiceAudioDebugListItem',
  type: VirtualDomElements.Li,
}

const recordingNameNode: VirtualDomNode = {
  childCount: 1,
  className: 'GptVoiceAudioDebugRecordingName',
  type: VirtualDomElements.Span,
}

const recordingDetailsNode: VirtualDomNode = {
  childCount: 1,
  className: 'GptVoiceAudioDebugRecordingDetails',
  type: VirtualDomElements.Span,
}

const viewNode: VirtualDomNode = {
  childCount: 1,
  className: 'GptVoiceAudioDebugView',
  type: VirtualDomElements.Div,
}

const renderMessage = (message: string): readonly VirtualDomNode[] => {
  return [messageNode, text(message)]
}

const formatSize = (size: number): string => {
  if (size < 1024) {
    return `${size} B`
  }
  return `${(size / 1024).toFixed(1)} KB`
}

const renderRecording = (
  recording: AudioDebugRecording,
): readonly VirtualDomNode[] => {
  return [
    listItemNode,
    {
      childCount: 2,
      className: 'GptVoiceAudioDebugRecording',
      name: recording.uri,
      onClick: handleClick,
      onContextMenu: handleContextMenu,
      title: `Open ${recording.name}`,
      type: VirtualDomElements.Button,
    },
    recordingNameNode,
    text(`Voice message ${recording.sequence}`),
    recordingDetailsNode,
    text(
      `${new Date(recording.createdAt).toISOString()} · ${formatSize(recording.size)}`,
    ),
  ]
}

export const renderAudioDebugView = (
  state: Readonly<AudioDebugViewState>,
): readonly VirtualDomNode[] => {
  const { enabled, error, recordings } = state
  let content: readonly VirtualDomNode[]
  if (!enabled) {
    content = renderMessage(
      'Enable “Gpt Voice: Audio Debug” in settings, then start a new voice session to capture recordings.',
    )
  } else if (error) {
    content = renderMessage(error)
  } else if (recordings.length === 0) {
    content = renderMessage('No voice audio recordings have been captured yet.')
  } else {
    content = [
      {
        'aria-label': 'Voice audio recordings',
        childCount: recordings.length,
        className: 'GptVoiceAudioDebugList',
        type: VirtualDomElements.Ul,
      },
      ...recordings.flatMap(renderRecording),
    ]
  }
  return [viewNode, ...content]
}
