import type { VirtualDomNode } from '@lvce-editor/virtual-dom-worker'
import {
  executeCommand,
  getPreference,
  openUri,
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
import { renderAudioDebugActionsDom } from '../RenderAudioDebugActionsDom/RenderAudioDebugActionsDom.ts'
import {
  renderAudioDebugView,
  type AudioDebugViewState,
} from '../RenderAudioDebugView/RenderAudioDebugView.ts'
import { audioDebugStorage } from '../VoiceSessionWorker/VoiceSessionWorker.ts'

interface AudioDebugViewDependencies {
  readonly executeCommand: typeof executeCommand
  readonly getPreference: typeof getPreference
  readonly openUri: typeof openUri
  readonly storage: AudioDebugStorage
}

const defaultDependencies: AudioDebugViewDependencies = {
  executeCommand,
  getPreference,
  openUri,
  storage: audioDebugStorage,
}

export interface ActiveAudioDebugViewInstance extends VirtualDomViewInstance {
  readonly handleClick: (uri: string) => Promise<void>
  readonly openSettings: () => Promise<void>
  readonly refresh: () => Promise<void>
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
    async handleClick(uri: string): Promise<void> {
      if (uri.startsWith(`${audioDebugScheme}:///`)) {
        await dependencies.openUri(uri)
      }
    },
    async handleEvent(event: Readonly<ViewEvent>): Promise<void> {
      if (event.type === 'click' && event.name) {
        await instance.handleClick(event.name)
      }
    },
    async openSettings(): Promise<void> {
      await dependencies.executeCommand('Preferences.openSettingsUi')
    },
    async refresh(): Promise<void> {
      await refresh()
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
