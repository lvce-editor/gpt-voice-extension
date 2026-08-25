import type { VirtualDomNode } from '@lvce-editor/virtual-dom-worker'
import {
  getPreference,
  openUri,
  type MenuEntry,
  type View,
  type ViewContext,
  type ViewEvent,
  type VirtualDomViewInstance,
} from '@lvce-editor/api'
import type { AudioDebugStorage } from '../AudioDebugStorage/AudioDebugStorage.ts'
import {
  audioDebugPreference,
  audioDebugScheme,
  audioDebugViewId,
} from '../AudioDebugConstants/AudioDebugConstants.ts'
import { downloadAudioDebugRecording } from '../DownloadAudioDebugRecording/DownloadAudioDebugRecording.ts'
import {
  renderAudioDebugView,
  type AudioDebugViewState,
} from '../RenderAudioDebugView/RenderAudioDebugView.ts'
import { audioDebugStorage } from '../VoiceSessionWorker/VoiceSessionWorker.ts'

interface AudioDebugViewDependencies {
  readonly downloadRecording?: typeof downloadAudioDebugRecording
  readonly getPreference: typeof getPreference
  readonly openUri: typeof openUri
  readonly storage: AudioDebugStorage
}

const defaultDependencies: AudioDebugViewDependencies = {
  downloadRecording: downloadAudioDebugRecording,
  getPreference,
  openUri,
  storage: audioDebugStorage,
}

export interface ActiveAudioDebugViewInstance extends VirtualDomViewInstance {
  readonly download: (uri: string, name: string) => Promise<void>
  readonly getMenuEntries: (menuId: string) => readonly MenuEntry[]
  readonly handleClick: (uri: string) => Promise<void>
  readonly remove: (uri: string) => Promise<void>
  readonly refresh: () => Promise<void>
}

const activeInstances = new Set<ActiveAudioDebugViewInstance>()

export const refreshActiveAudioDebugViewInstances = async (): Promise<void> => {
  await Promise.all(
    Array.from(activeInstances, (instance) => instance.refresh()),
  )
}

export const createAudioDebugViewInstance = async (
  context?: ViewContext,
  dependencies: Readonly<AudioDebugViewDependencies> = defaultDependencies,
): Promise<ActiveAudioDebugViewInstance> => {
  let state: AudioDebugViewState = {
    enabled: false,
    error: '',
    recordings: [],
  }

  const refresh = async (): Promise<void> => {
    const enabled =
      (await dependencies.getPreference(audioDebugPreference)) === true
    try {
      state = {
        enabled,
        error: '',
        recordings: enabled ? await dependencies.storage.list() : [],
      }
    } catch (error) {
      state = {
        enabled,
        error: error instanceof Error ? error.message : String(error),
        recordings: [],
      }
    }
    await context?.requestRerender()
  }

  const instance: ActiveAudioDebugViewInstance = {
    dispose(): void {
      activeInstances.delete(instance)
    },
    async download(uri: string, name: string): Promise<void> {
      await (dependencies.downloadRecording ?? downloadAudioDebugRecording)(
        dependencies.storage,
        uri,
        name,
      )
    },
    getMenuEntries(menuId: string): readonly MenuEntry[] {
      const recording = state.recordings.find(
        (candidate) => candidate.uri === menuId,
      )
      if (!recording) {
        return []
      }
      return [
        {
          args: [recording.uri, recording.name],
          command: 'GptVoice.downloadAudioDebugRecording',
          id: 'downloadAudioDebugRecording',
          label: 'Download',
        },
        {
          args: [recording.uri],
          command: 'GptVoice.removeAudioDebugRecording',
          id: 'removeAudioDebugRecording',
          label: 'Remove',
        },
      ]
    },
    async handleClick(uri: string): Promise<void> {
      if (uri.startsWith(`${audioDebugScheme}:///`)) {
        await dependencies.openUri(uri)
      }
    },
    async handleEvent(event: Readonly<ViewEvent>): Promise<void> {
      if (event.type === 'click' && event.name) {
        await instance.handleClick(event.name)
      } else if (
        event.type === 'contextmenu' &&
        event.name &&
        state.recordings.some((recording) => recording.uri === event.name)
      ) {
        await context?.showContextMenu(
          event.name,
          typeof event.x === 'number' ? event.x : 0,
          typeof event.y === 'number' ? event.y : 0,
        )
      }
    },
    async remove(uri: string): Promise<void> {
      await dependencies.storage.remove(uri)
      await refreshActiveAudioDebugViewInstances()
    },
    async refresh(): Promise<void> {
      await refresh()
    },
    render(): readonly VirtualDomNode[] {
      return renderAudioDebugView(state)
    },
  }
  activeInstances.add(instance)
  await refresh()
  return instance
}

export const audioDebugView: View<ActiveAudioDebugViewInstance> = {
  commands: {
    async 'GptVoice.downloadAudioDebugRecording'(instance, uri, name) {
      if (typeof uri === 'string' && typeof name === 'string') {
        await instance.download(uri, name)
      }
      return instance
    },
    async 'GptVoice.removeAudioDebugRecording'(instance, uri) {
      if (typeof uri === 'string') {
        await instance.remove(uri)
      }
      return instance
    },
  },
  create: createAudioDebugViewInstance,
  displayName: 'Voice Audio Recordings',
  eventListeners: [
    {
      name: 'handleClick',
      params: ['handleClick', 'event.currentTarget.name'],
    },
  ],
  icon: 'sound',
  id: audioDebugViewId,
  kind: 'virtualDom',
  title: 'Voice Audio Recordings',
}
