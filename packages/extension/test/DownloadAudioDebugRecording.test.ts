import { expect, jest, test } from '@jest/globals'
import type { AudioDebugStorage } from '../src/parts/AudioDebugStorage/AudioDebugStorage.ts'
import { downloadAudioDebugRecordingWithDependencies } from '../src/parts/DownloadAudioDebugRecording/DownloadAudioDebugRecording.ts'

const blob = new Blob(['recorded audio'], { type: 'audio/webm' })

const createStorage = (): AudioDebugStorage => ({
  list: jest.fn(async () => []),
  read: jest.fn(async () => blob),
  remove: jest.fn(async () => undefined),
  save: jest.fn<AudioDebugStorage['save']>(),
})

test('downloads the cached recording and revokes its object url', async () => {
  const storage = createStorage()
  const createObjectUrl = jest.fn<(blob: Blob) => string>(
    () => 'blob:recording',
  )
  const executeCommand = jest.fn<
    (id: string, ...args: readonly unknown[]) => Promise<unknown>
  >(async () => undefined)
  const revokeObjectUrl = jest.fn<(url: string) => void>()
  const waitForDownload = jest.fn(async () => undefined)

  await downloadAudioDebugRecordingWithDependencies(
    storage,
    'gpt-voice-audio:///recording.webm',
    'recording.webm',
    { createObjectUrl, executeCommand, revokeObjectUrl, waitForDownload },
  )

  expect(storage.read).toHaveBeenCalledWith('gpt-voice-audio:///recording.webm')
  expect(createObjectUrl).toHaveBeenCalledWith(blob)
  expect(executeCommand).toHaveBeenCalledWith(
    'Download.downloadFile',
    'recording.webm',
    'blob:recording',
  )
  expect(waitForDownload).toHaveBeenCalledTimes(1)
  expect(revokeObjectUrl).toHaveBeenCalledWith('blob:recording')
})

test('revokes the object url when the download fails', async () => {
  const storage = createStorage()
  const error = new Error('download failed')
  const revokeObjectUrl = jest.fn()

  await expect(
    downloadAudioDebugRecordingWithDependencies(
      storage,
      'gpt-voice-audio:///recording.webm',
      'recording.webm',
      {
        createObjectUrl: () => 'blob:recording',
        executeCommand: jest.fn(async () => {
          throw error
        }),
        revokeObjectUrl,
        waitForDownload: jest.fn(async () => undefined),
      },
    ),
  ).rejects.toThrow(error)
  expect(revokeObjectUrl).toHaveBeenCalledWith('blob:recording')
})
