import type * as Api from '@lvce-editor/api'
import { expect, jest, test } from '@jest/globals'
import { text } from '@lvce-editor/virtual-dom-worker'
import {
  createAudioDebugViewInstance,
  refreshActiveAudioDebugViewInstances,
} from '../src/parts/AudioDebugView/AudioDebugView.ts'

const recording = {
  createdAt: 1_777_072_496_000,
  mimeType: 'audio/webm',
  name: 'recording.webm',
  size: 2048,
  uri: 'gpt-voice-audio:///recording.webm',
}

const createStorage = (
  list: () => Promise<readonly (typeof recording)[]> = async () => [],
): {
  readonly list: jest.Mock<() => Promise<readonly (typeof recording)[]>>
  readonly read: jest.Mock<(uri: string) => Promise<Blob>>
  readonly save: jest.Mock<(blob: Blob) => Promise<typeof recording>>
} => ({
  list: jest.fn(list),
  read: jest.fn<(uri: string) => Promise<Blob>>(),
  save: jest.fn<(blob: Blob) => Promise<typeof recording>>(),
})

test('explains how to enable audio debugging', async () => {
  const instance = await createAudioDebugViewInstance(undefined, {
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
      getPreference: jest.fn(async () => true),
      openUri,
      storage: {
        ...createStorage(async () => [recording]),
      },
    },
  )

  expect(instance.render()).toContainEqual(text('Voice message 1'))
  expect(instance.render()).toContainEqual(
    text('2026-04-24T23:14:56.000Z · 2.0 KB'),
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

test('shows an empty enabled view and formats byte-sized recordings', async () => {
  const emptyInstance = await createAudioDebugViewInstance(undefined, {
    getPreference: jest.fn(async () => true),
    openUri: jest.fn<(uri: string) => Promise<void>>(),
    storage: createStorage(),
  })
  expect(emptyInstance.render()).toContainEqual(
    text('No voice audio recordings have been captured yet.'),
  )
  emptyInstance.dispose?.()

  const smallInstance = await createAudioDebugViewInstance(undefined, {
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
    getPreference: jest.fn(async () => true),
    openUri: jest.fn<(uri: string) => Promise<void>>(),
    storage: createStorage(async () => {
      throw 'cache stopped'
    }),
  })

  expect(instance.render()).toContainEqual(text('cache stopped'))
  instance.dispose?.()
})
