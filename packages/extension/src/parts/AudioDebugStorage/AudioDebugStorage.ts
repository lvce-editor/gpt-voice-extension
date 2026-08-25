import { audioDebugScheme } from '../AudioDebugConstants/AudioDebugConstants.ts'

const cacheName = 'gpt-voice-audio-debug-v1'
const cacheUrlPrefix = 'https://gpt-voice-audio.invalid/'
const createdAtHeader = 'x-gpt-voice-created-at'

export interface AudioDebugRecording {
  readonly createdAt: number
  readonly mimeType: string
  readonly name: string
  readonly size: number
  readonly uri: string
}

export interface AudioDebugStorage {
  readonly list: () => Promise<readonly AudioDebugRecording[]>
  readonly read: (uri: string) => Promise<Blob>
  readonly remove: (uri: string) => Promise<void>
  readonly save: (blob: Blob) => Promise<AudioDebugRecording>
}

interface AudioDebugStorageDependencies {
  readonly cacheStorage: Pick<CacheStorage, 'open'> | undefined
  readonly createId: () => string
  readonly now: () => number
}

const defaultDependencies: AudioDebugStorageDependencies = {
  cacheStorage: globalThis.caches,
  createId: () => crypto.randomUUID(),
  now: Date.now,
}

const getExtension = (mimeType: string): string => {
  switch (mimeType) {
    case 'audio/mpeg':
      return 'mp3'
    case 'audio/ogg':
      return 'ogg'
    default:
      return 'webm'
  }
}

const getCacheUrl = (name: string): string => {
  return `${cacheUrlPrefix}${encodeURIComponent(name)}`
}

const getNameFromCacheUrl = (url: string): string | undefined => {
  if (!url.startsWith(cacheUrlPrefix)) {
    return undefined
  }
  return decodeURIComponent(url.slice(cacheUrlPrefix.length))
}

const getNameFromUri = (uri: string): string => {
  const prefix = `${audioDebugScheme}:///`
  if (!uri.startsWith(prefix)) {
    throw new Error(`Invalid Gpt Voice audio URI: ${uri}`)
  }
  const name = uri.slice(prefix.length)
  if (!name || name.includes('/')) {
    throw new Error(`Invalid Gpt Voice audio URI: ${uri}`)
  }
  return name
}

// CacheStorage and Blob are mutable DOM types, but this module only uses their
// read-only APIs and never mutates callers' values.
export const createAudioDebugStorage = (
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  dependencies: Readonly<AudioDebugStorageDependencies> = defaultDependencies,
): AudioDebugStorage => {
  const getCache = async (): Promise<Cache> => {
    const { cacheStorage } = dependencies
    if (!cacheStorage) {
      throw new Error('Cache storage is unavailable')
    }
    return cacheStorage.open(cacheName)
  }

  return {
    async list(): Promise<readonly AudioDebugRecording[]> {
      const cache = await getCache()
      const requests = await cache.keys()
      const recordings = await Promise.all(
        requests.map(
          async (
            // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
            request: Readonly<Request>,
          ): Promise<AudioDebugRecording | undefined> => {
            const name = getNameFromCacheUrl(request.url)
            if (!name) {
              return undefined
            }
            const response = await cache.match(request)
            if (!response) {
              return undefined
            }
            const blob = await response.blob()
            return {
              createdAt: Number(response.headers.get(createdAtHeader)) || 0,
              mimeType: blob.type,
              name,
              size: blob.size,
              uri: `${audioDebugScheme}:///${name}`,
            }
          },
        ),
      )
      return recordings
        .filter((recording): recording is AudioDebugRecording =>
          Boolean(recording),
        )
        .toSorted((a, b) => b.createdAt - a.createdAt)
    },
    async read(uri: string): Promise<Blob> {
      const cache = await getCache()
      const name = getNameFromUri(uri)
      const response = await cache.match(getCacheUrl(name))
      if (!response) {
        throw new Error(`Gpt Voice audio recording not found: ${name}`)
      }
      return response.blob()
    },
    async remove(uri: string): Promise<void> {
      const cache = await getCache()
      const name = getNameFromUri(uri)
      await cache.delete(getCacheUrl(name))
    },
    async save(blob: Blob): Promise<AudioDebugRecording> {
      const cache = await getCache()
      const createdAt = dependencies.now()
      const name = `${createdAt}-${dependencies.createId()}.${getExtension(blob.type)}`
      await cache.put(
        getCacheUrl(name),
        new Response(blob, {
          headers: {
            [createdAtHeader]: String(createdAt),
          },
        }),
      )
      return {
        createdAt,
        mimeType: blob.type,
        name,
        size: blob.size,
        uri: `${audioDebugScheme}:///${name}`,
      }
    },
  }
}

export const audioDebugStorage = createAudioDebugStorage()
