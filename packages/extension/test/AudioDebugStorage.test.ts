import { expect, jest, test } from '@jest/globals'
import { createAudioDebugStorage } from '../src/parts/AudioDebugStorage/AudioDebugStorage.ts'

type FakeRequest = Request | string | URL

const getRequestUrl = (
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  request: FakeRequest,
): string => {
  if (request instanceof Request) {
    return request.url
  }
  if (request instanceof URL) {
    return request.href
  }
  return request
}

class FakeCache {
  readonly entries = new Map<string, Response>()

  async keys(): Promise<readonly Request[]> {
    return Array.from(this.entries.keys(), (url) => new Request(url))
  }

  async match(
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
    request: FakeRequest,
  ): Promise<Response | undefined> {
    const url = getRequestUrl(request)
    return this.entries.get(url)?.clone()
  }

  async put(
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
    request: FakeRequest,
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
    response: Readonly<Response>,
  ): Promise<void> {
    const url = getRequestUrl(request)
    this.entries.set(url, response.clone())
  }
}

const createStorage = (
  // FakeCache intentionally exposes mutable test state.
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  cache: FakeCache,
  now = 123,
): ReturnType<typeof createAudioDebugStorage> => {
  return createAudioDebugStorage({
    cacheStorage: {
      open: jest.fn(async () => cache as unknown as Cache),
    },
    createId: () => 'recording-id',
    now: () => now,
  })
}

test('saves, lists, and reads a WebM recording', async () => {
  const cache = new FakeCache()
  const storage = createStorage(cache)
  const audio = new Blob(['recorded audio'], { type: 'audio/webm' })

  await expect(storage.save(audio)).resolves.toEqual({
    createdAt: 123,
    mimeType: 'audio/webm',
    name: '123-recording-id.webm',
    size: 14,
    uri: 'gpt-voice-audio:///123-recording-id.webm',
  })
  await expect(storage.list()).resolves.toEqual([
    {
      createdAt: 123,
      mimeType: 'audio/webm',
      name: '123-recording-id.webm',
      size: 14,
      uri: 'gpt-voice-audio:///123-recording-id.webm',
    },
  ])
  const result = await storage.read('gpt-voice-audio:///123-recording-id.webm')
  expect(result.type).toBe('audio/webm')
  await expect(result.text()).resolves.toBe('recorded audio')
})

test('uses playable audio extensions for supported recorder mime types', async () => {
  const mp3Storage = createStorage(new FakeCache(), 1)
  const oggStorage = createStorage(new FakeCache(), 2)

  await expect(
    mp3Storage.save(new Blob(['mp3'], { type: 'audio/mpeg' })),
  ).resolves.toEqual(expect.objectContaining({ name: '1-recording-id.mp3' }))
  await expect(
    oggStorage.save(new Blob(['ogg'], { type: 'audio/ogg' })),
  ).resolves.toEqual(expect.objectContaining({ name: '2-recording-id.ogg' }))
})

test('lists newest recordings first', async () => {
  const cache = new FakeCache()
  await createStorage(cache, 1).save(
    new Blob(['first'], { type: 'audio/webm' }),
  )
  await createStorage(cache, 2).save(
    new Blob(['second'], { type: 'audio/webm' }),
  )

  const recordings = await createStorage(cache).list()

  expect(recordings.map((recording) => recording.createdAt)).toEqual([2, 1])
})

test('ignores unrelated and disappeared cache entries', async () => {
  const cache = new FakeCache()
  cache.entries.set(
    'https://gpt-voice-audio.invalid/no-date.webm',
    new Response(new Blob(['audio'], { type: 'audio/webm' })),
  )
  const originalKeys = cache.keys.bind(cache)
  cache.keys = async (): Promise<readonly Request[]> => [
    ...(await originalKeys()),
    new Request('https://unrelated.invalid/recording.webm'),
    new Request('https://gpt-voice-audio.invalid/disappeared.webm'),
  ]

  await expect(createStorage(cache).list()).resolves.toEqual([
    expect.objectContaining({
      createdAt: 0,
      name: 'no-date.webm',
    }),
  ])
})

test('rejects missing recordings and invalid uris', async () => {
  const storage = createStorage(new FakeCache())

  await expect(storage.read('gpt-voice-audio:///missing.webm')).rejects.toThrow(
    'Gpt Voice audio recording not found: missing.webm',
  )
  await expect(storage.read('file:///recording.webm')).rejects.toThrow(
    'Invalid Gpt Voice audio URI',
  )
  await expect(
    storage.read('gpt-voice-audio:///folder/recording.webm'),
  ).rejects.toThrow('Invalid Gpt Voice audio URI')
  await expect(storage.read('gpt-voice-audio:///')).rejects.toThrow(
    'Invalid Gpt Voice audio URI',
  )
})

test('reports unavailable cache storage', async () => {
  const storage = createAudioDebugStorage({
    cacheStorage: undefined,
    createId: () => 'id',
    now: () => 1,
  })

  await expect(storage.list()).rejects.toThrow('Cache storage is unavailable')
})
