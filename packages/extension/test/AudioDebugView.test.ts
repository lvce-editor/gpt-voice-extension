import type * as Api from '@lvce-editor/api'
import type { AudioDebugStorage } from 'voice-shared'
import { expect, jest, test } from '@jest/globals'
import { text } from '@lvce-editor/virtual-dom-worker'
import {
  audioDebugView,
  createAudioDebugViewInstance,
  refreshActiveAudioDebugViewInstances,
} from '../src/parts/AudioDebugView/AudioDebugView.ts'
import * as DomEventListenerFunctions from '../src/parts/DomEventListenerFunctions/DomEventListenerFunctions.ts'
import { enableTestMode } from '../src/parts/TestMode/TestMode.ts'

const recording = {
  createdAt: 1_777_072_496_000,
  mimeType: 'audio/webm',
  name: 'voice-message-7.webm',
  sequence: 7,
  size: 2048,
  uri: 'gpt-voice-audio:///voice-message-7.webm',
}

const createStorage = (
  list: () => Promise<readonly (typeof recording)[]> = async () => [],
): {
  readonly clearAll: jest.Mock<() => Promise<void>>
  readonly list: jest.Mock<() => Promise<readonly (typeof recording)[]>>
  readonly read: jest.Mock<(uri: string) => Promise<Blob>>
  readonly remove: jest.Mock<(uri: string) => Promise<void>>
  readonly save: jest.Mock<(blob: Blob) => Promise<typeof recording>>
} => ({
  clearAll: jest.fn(async () => undefined),
  list: jest.fn(list),
  read: jest.fn<(uri: string) => Promise<Blob>>(),
  remove: jest.fn(async () => undefined),
  save: jest.fn<(blob: Blob) => Promise<typeof recording>>(),
})

const createDependencies = (
  overrides: Readonly<Record<string, unknown>> = {},
): Parameters<typeof createAudioDebugViewInstance>[1] => ({
  executeCommand: jest.fn(async () => undefined),
  getPreference: jest.fn(async () => true),
  openUri: jest.fn<(uri: string) => Promise<void>>(),
  storage: createStorage(),
  ...overrides,
})

test('explains how to enable audio debugging', async () => {
  const instance = await createAudioDebugViewInstance(undefined, {
    executeCommand: jest.fn(async () => undefined),
    getPreference: jest.fn(async () => false),
    openUri: jest.fn<(uri: string) => Promise<void>>(),
    storage: createStorage(),
  })

  expect(instance.render()).toContainEqual(
    text(
      'Enable “Gpt Voice: Audio Debug” in settings, then start a new voice session to capture recordings.',
    ),
  )
  instance.dispose?.()
})

test('lists cached recordings and opens a clicked provider uri', async () => {
  const openUri = jest.fn<(uri: string) => Promise<void>>(async () => undefined)
  const requestRerender = jest.fn(async () => undefined)
  const instance = await createAudioDebugViewInstance(
    { requestRerender } as unknown as Api.ViewContext,
    {
      executeCommand: jest.fn(async () => undefined),
      getPreference: jest.fn(async () => true),
      openUri,
      storage: {
        ...createStorage(async () => [recording]),
      },
    },
  )

  expect(instance.render()).toContainEqual(text('Voice message 7'))
  expect(instance.render()).toContainEqual(
    text('2026-04-24T23:14:56.000Z · 2.0 KB'),
  )
  expect(instance.render()).toContainEqual(
    expect.objectContaining({
      className: 'GptVoiceAudioDebugRecording',
      name: recording.uri,
      onClick: DomEventListenerFunctions.HandleAudioDebugClick,
      onContextMenu: 'handleContextMenu',
    }),
  )
  await instance.handleClick(recording.uri)
  await instance.handleClick('file:///tmp/not-a-recording.webm')
  await instance.handleEvent?.({ name: recording.uri, type: 'click' })
  await instance.handleEvent?.({ name: recording.uri, type: 'keydown' })
  await instance.handleEvent?.({ type: 'click' })

  expect(openUri).toHaveBeenCalledTimes(2)
  expect(openUri).toHaveBeenCalledWith(recording.uri)
  await refreshActiveAudioDebugViewInstances()
  expect(requestRerender).toHaveBeenCalledTimes(2)
  instance.dispose?.()
})

test('shows recording context menu entries', async () => {
  const showContextMenu = jest.fn<
    (menuId: string, x: number, y: number) => Promise<void>
  >(async () => undefined)
  const downloadRecording = jest.fn<
    (storage: AudioDebugStorage, uri: string, name: string) => Promise<void>
  >(async () => undefined)
  const storage = createStorage(async () => [recording])
  const instance = await createAudioDebugViewInstance(
    {
      requestRerender: jest.fn(async () => undefined),
      showContextMenu,
    } as unknown as Api.ViewContext,
    createDependencies({
      downloadRecording,
      storage,
    }),
  )

  await instance.handleEvent?.({
    name: recording.uri,
    type: 'contextmenu',
    x: 10,
    y: 20,
  })
  await instance.handleEvent?.({
    name: recording.uri,
    type: 'contextmenu',
  })
  await instance.handleEvent?.({
    name: 'gpt-voice-audio:///missing.webm',
    type: 'contextmenu',
    x: 30,
    y: 40,
  })

  expect(showContextMenu).toHaveBeenCalledTimes(2)
  expect(showContextMenu).toHaveBeenCalledWith(recording.uri, 10, 20)
  expect(showContextMenu).toHaveBeenCalledWith(recording.uri, 0, 0)
  expect(instance.getMenuEntries(recording.uri)).toEqual([
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
  ])
  expect(instance.getMenuEntries('gpt-voice-audio:///missing.webm')).toEqual([])
  await instance.download(recording.uri, recording.name)
  expect(downloadRecording).toHaveBeenCalledWith(
    storage,
    recording.uri,
    recording.name,
  )
  instance.dispose?.()
})

test('removes a cached recording and refreshes the view', async () => {
  const storage = createStorage(async () => [recording])
  const requestRerender = jest.fn(async () => undefined)
  const instance = await createAudioDebugViewInstance(
    { requestRerender } as unknown as Api.ViewContext,
    createDependencies({ storage }),
  )

  await instance.remove(recording.uri)

  expect(storage.remove).toHaveBeenCalledWith(recording.uri)
  expect(storage.list).toHaveBeenCalledTimes(2)
  expect(requestRerender).toHaveBeenCalledTimes(2)
  instance.dispose?.()
})

test('clears all cached recordings and refreshes the view', async () => {
  const storage = createStorage(async () => [recording])
  const requestRerender = jest.fn(async () => undefined)
  const instance = await createAudioDebugViewInstance(
    { requestRerender } as unknown as Api.ViewContext,
    createDependencies({ storage }),
  )

  await instance.clearAll()

  expect(storage.clearAll).toHaveBeenCalledTimes(1)
  expect(storage.list).toHaveBeenCalledTimes(2)
  expect(requestRerender).toHaveBeenCalledTimes(2)
  instance.dispose?.()
})

test('handles audio debug title action events', async () => {
  const executeCommand = jest.fn<(command: string) => Promise<unknown>>(
    async () => undefined,
  )
  const storage = createStorage(async () => [recording])
  const requestRerender = jest.fn(async () => undefined)
  const instance = await createAudioDebugViewInstance(
    { requestRerender } as unknown as Api.ViewContext,
    createDependencies({ executeCommand, storage }),
  )

  await instance.handleEvent?.({ name: 'refresh', type: 'click' })
  await instance.handleEvent?.({ name: 'openSettings', type: 'click' })
  await instance.handleEvent?.({ name: 'clearAll', type: 'click' })

  expect(storage.clearAll).toHaveBeenCalledTimes(1)
  expect(storage.list).toHaveBeenCalledTimes(3)
  expect(executeCommand).toHaveBeenCalledWith('Preferences.openSettingsUi')
  expect(requestRerender).toHaveBeenCalledTimes(3)
  instance.dispose?.()
})

test('seeds an audio recording only in test mode', async () => {
  const storage = createStorage()
  const requestRerender = jest.fn(async () => undefined)
  const instance = await createAudioDebugViewInstance(
    { requestRerender } as unknown as Api.ViewContext,
    createDependencies({ storage }),
  )

  await expect(instance.saveForTest()).rejects.toThrow(
    'Audio debug test recordings require test mode',
  )
  enableTestMode()
  await instance.saveForTest()

  expect(storage.save).toHaveBeenCalledTimes(1)
  expect(storage.save.mock.calls[0]?.[0]).toBeInstanceOf(Blob)
  expect(storage.list).toHaveBeenCalledTimes(2)
  expect(requestRerender).toHaveBeenCalledTimes(2)
  instance.dispose?.()
})

test('runs recording menu commands', async () => {
  const storage = createStorage(async () => [recording])
  const downloadRecording = jest.fn<
    (storage: AudioDebugStorage, uri: string, name: string) => Promise<void>
  >(async () => undefined)
  const instance = await createAudioDebugViewInstance(
    undefined,
    createDependencies({
      downloadRecording,
      storage,
    }),
  )
  const downloadCommand =
    audioDebugView.commands?.['GptVoice.downloadAudioDebugRecording']
  const removeCommand =
    audioDebugView.commands?.['GptVoice.removeAudioDebugRecording']

  await instance.handleEvent?.({
    name: recording.uri,
    type: 'contextmenu',
  })
  await downloadCommand?.(instance, recording.uri, recording.name)
  await downloadCommand?.(instance, 1, 2)
  await removeCommand?.(instance, recording.uri)
  await removeCommand?.(instance, 1)

  expect(downloadRecording).toHaveBeenCalledTimes(1)
  expect(storage.remove).toHaveBeenCalledTimes(1)
  expect(storage.remove).toHaveBeenCalledWith(recording.uri)
  instance.dispose?.()
})

test('shows an empty enabled view and formats byte-sized recordings', async () => {
  const emptyInstance = await createAudioDebugViewInstance(undefined, {
    executeCommand: jest.fn(async () => undefined),
    getPreference: jest.fn(async () => true),
    openUri: jest.fn<(uri: string) => Promise<void>>(),
    storage: createStorage(),
  })
  expect(emptyInstance.render()).toContainEqual(
    text('No voice audio recordings have been captured yet.'),
  )
  emptyInstance.dispose?.()

  const smallInstance = await createAudioDebugViewInstance(undefined, {
    executeCommand: jest.fn(async () => undefined),
    getPreference: jest.fn(async () => true),
    openUri: jest.fn<(uri: string) => Promise<void>>(),
    storage: createStorage(async () => [{ ...recording, size: 5 }]),
  })
  expect(smallInstance.render()).toContainEqual(
    text('2026-04-24T23:14:56.000Z · 5 B'),
  )
  smallInstance.dispose?.()
})

test('shows cache errors without failing the view', async () => {
  const instance = await createAudioDebugViewInstance(undefined, {
    executeCommand: jest.fn(async () => undefined),
    getPreference: jest.fn(async () => true),
    openUri: jest.fn<(uri: string) => Promise<void>>(),
    storage: {
      ...createStorage(async () => {
        throw new Error('cache unavailable')
      }),
    },
  })

  expect(instance.render()).toContainEqual(text('cache unavailable'))
  instance.dispose?.()
})

test('renders non-error cache failures', async () => {
  const instance = await createAudioDebugViewInstance(undefined, {
    executeCommand: jest.fn(async () => undefined),
    getPreference: jest.fn(async () => true),
    openUri: jest.fn<(uri: string) => Promise<void>>(),
    storage: createStorage(async () => {
      throw 'cache stopped'
    }),
  })

  expect(instance.render()).toContainEqual(text('cache stopped'))
  instance.dispose?.()
})

test('renders actions and opens settings', async () => {
  const executeCommand = jest.fn<(command: string) => Promise<unknown>>(
    async () => undefined,
  )
  const instance = await createAudioDebugViewInstance(
    undefined,
    createDependencies({ executeCommand }),
  )

  expect(instance.renderActionsDom()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        'data-command': 'GptVoiceAudioDebug.refresh',
      }),
      expect.objectContaining({
        'data-command': 'GptVoiceAudioDebug.clearAll',
      }),
      expect.objectContaining({
        'data-command': 'GptVoiceAudioDebug.openSettings',
      }),
    ]),
  )
  await instance.openSettings()

  expect(executeCommand).toHaveBeenCalledWith('Preferences.openSettingsUi')
  instance.dispose?.()
})

test('executes audio debug view commands', async () => {
  const clearAll = jest.fn(async () => undefined)
  const openSettings = jest.fn(async () => undefined)
  const refresh = jest.fn(async () => undefined)
  const saveForTest = jest.fn(async () => undefined)
  const instance = { clearAll, openSettings, refresh, saveForTest } as never

  await expect(
    audioDebugView.commands['GptVoiceAudioDebug.clearAll'](instance),
  ).resolves.toBe(instance)
  await expect(
    audioDebugView.commands['GptVoiceAudioDebug.openSettings'](instance),
  ).resolves.toBe(instance)
  await expect(
    audioDebugView.commands['GptVoiceAudioDebug.refresh'](instance),
  ).resolves.toBe(instance)
  await expect(
    audioDebugView.commands['GptVoiceAudioDebug.saveForTest'](instance),
  ).resolves.toBe(instance)

  expect(clearAll).toHaveBeenCalledTimes(1)
  expect(openSettings).toHaveBeenCalledTimes(1)
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(saveForTest).toHaveBeenCalledTimes(1)
})

test('component state edits the recording view and follows refresh', async () => {
  const instance = await createAudioDebugViewInstance(
    undefined,
    createDependencies({ storage: createStorage(async () => [recording]) }),
  )
  instance.setComponentState({
    ...instance.getComponentState(),
    error: 'Inspector error',
  })
  expect(JSON.stringify(instance.render())).toContain('Inspector error')
  await instance.refresh()
  expect(instance.getComponentState()).toEqual({
    enabled: true,
    error: '',
    recordings: [recording],
  })
  instance.dispose?.()
})
