import type { VirtualDomNode } from '@lvce-editor/virtual-dom-worker'
import {
  executeCommand,
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
import { renderAudioDebugActionsDom } from '../RenderAudioDebugActionsDom/RenderAudioDebugActionsDom.ts'
import {
  renderAudioDebugView,
  type AudioDebugViewState,
} from '../RenderAudioDebugView/RenderAudioDebugView.ts'
import { audioDebugStorage } from '../VoiceSessionWorker/VoiceSessionWorker.ts'

interface AudioDebugViewDependencies {
  readonly downloadRecording?: typeof downloadAudioDebugRecording
  readonly executeCommand: typeof executeCommand
  readonly getPreference: typeof getPreference
  readonly openUri: typeof openUri
  readonly storage: AudioDebugStorage
}

const defaultDependencies: AudioDebugViewDependencies = {
  downloadRecording: downloadAudioDebugRecording,
  executeCommand,
  getPreference,
  openUri,
  storage: audioDebugStorage,
}

export interface ActiveAudioDebugViewInstance extends VirtualDomViewInstance {
  readonly download: (uri: string, name: string) => Promise<void>
  readonly getMenuEntries: (menuId: string) => readonly MenuEntry[]
  readonly handleClick: (uri: string) => Promise<void>
  readonly openSettings: () => Promise<void>
  readonly refresh: () => Promise<void>
  readonly remove: (uri: string) => Promise<void>
  readonly renderActionsDom: () => readonly VirtualDomNode[]
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
      const { recordings } = state
      const recording = recordings.find((candidate) => candidate.uri === menuId)
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
      const { recordings } = state
      if (event.type === 'click' && event.name) {
        await instance.handleClick(event.name)
      } else if (
        event.type === 'contextmenu' &&
        event.name &&
        recordings.some((recording) => recording.uri === event.name)
      ) {
        await context?.showContextMenu(
          event.name,
          typeof event.x === 'number' ? event.x : 0,
          typeof event.y === 'number' ? event.y : 0,
        )
      }
    },
    async openSettings(): Promise<void> {
      await dependencies.executeCommand('Preferences.openSettingsUi')
    },
    async refresh(): Promise<void> {
      await refresh()
    },
    async remove(uri: string): Promise<void> {
      await dependencies.storage.remove(uri)
      await refreshActiveAudioDebugViewInstances()
    },
    render(): readonly VirtualDomNode[] {
      return renderAudioDebugView(state)
    },
    renderActionsDom(): readonly VirtualDomNode[] {
      return renderAudioDebugActionsDom()
    },
  }
  activeInstances.add(instance)
  await refresh()
  return instance
}

type AudioDebugView = Omit<View<ActiveAudioDebugViewInstance>, 'commands'> & {
  readonly commands: NonNullable<View<ActiveAudioDebugViewInstance>['commands']>
}

export const audioDebugView: AudioDebugView = {
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
    async 'GptVoiceAudioDebug.openSettings'(instance) {
      await instance.openSettings()
      return instance
    },
    async 'GptVoiceAudioDebug.refresh'(instance) {
      await instance.refresh()
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
