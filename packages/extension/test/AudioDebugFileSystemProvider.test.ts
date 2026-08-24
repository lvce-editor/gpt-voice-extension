import { expect, jest, test } from '@jest/globals'
import { createAudioDebugFileSystemProvider } from '../src/parts/AudioDebugFileSystemProvider/AudioDebugFileSystemProvider.ts'

test('provides cached audio as a readonly file system', async () => {
  const audio = new Blob(['recorded audio'], { type: 'audio/webm' })
  const read = jest.fn<(uri: string) => Promise<Blob>>(async () => audio)
  const provider = createAudioDebugFileSystemProvider({ read } as never)

  expect(provider.id).toBe('gpt-voice-audio')
  expect(provider.isReadonly?.()).toBe(true)
  await expect(
    provider.readFile('gpt-voice-audio:///recording.webm'),
  ).resolves.toBe(audio)
  expect(read).toHaveBeenCalledWith('gpt-voice-audio:///recording.webm')
})
