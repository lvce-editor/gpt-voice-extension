import type { AudioDebugRecording, AudioDebugStorage } from 'voice-shared'

const audioDebugScheme = 'gpt-voice-audio'

const cacheName = 'gpt-voice-audio-debug-v1'
const cacheUrlPrefix = 'https://gpt-voice-audio.invalid/'
const createdAtHeader = 'x-gpt-voice-created-at'
const recordingNamePattern = /^voice-message-(\d+)\.[^.]+$/

interface AudioDebugStorageDependencies {
  readonly cacheStorage: Pick<CacheStorage, 'open'> | undefined
  readonly now: () => number
}

const defaultDependencies: AudioDebugStorageDependencies = {
  cacheStorage: globalThis.caches,
  now: Date.now,
}

const getExtension = (mimeType: string): string => {
  switch (mimeType) {
    case 'audio/mpeg':
      return 'mp3'
    case 'audio/ogg':
      return 'ogg'
    case 'audio/webm':
      return 'weba'
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

const getPublicName = (name: string, mimeType: string): string => {
  if (mimeType === 'audio/webm' && name.endsWith('.webm')) {
    return `${name.slice(0, -'.webm'.length)}.weba`
  }
  return name
}

const getLegacyName = (name: string): string | undefined => {
  if (name.endsWith('.weba')) {
    return `${name.slice(0, -'.weba'.length)}.webm`
  }
  return undefined
}

const matchRecording = async (
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  cache: Cache,
  name: string,
): Promise<Response | undefined> => {
  const response = await cache.match(getCacheUrl(name))
  if (response) {
    return response
  }
  const legacyName = getLegacyName(name)
  if (!legacyName) {
    return undefined
  }
  return cache.match(getCacheUrl(legacyName))
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

const getSequenceFromName = (name: string): number | undefined => {
  const match = recordingNamePattern.exec(name)
  const sequence = Number(match?.[1])
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    return undefined
  }
  return sequence
}

type StoredAudioDebugRecording = Omit<AudioDebugRecording, 'sequence'> & {
  readonly sequence: number | undefined
}

const assignSequences = (
  recordings: readonly StoredAudioDebugRecording[],
): readonly AudioDebugRecording[] => {
  let nextSequence = 1
  return recordings
    .toSorted(
      (a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name),
    )
    .map((recording) => {
      const sequence = recording.sequence ?? nextSequence
      nextSequence = Math.max(nextSequence, sequence + 1)
      return {
        ...recording,
        sequence,
      }
    })
}

const listRecordings = async (
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  cache: Cache,
): Promise<readonly AudioDebugRecording[]> => {
  const requests = await cache.keys()
  const recordings = await Promise.all(
    requests.map(
      async (
        // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
        request: Readonly<Request>,
      ): Promise<StoredAudioDebugRecording | undefined> => {
        const storedName = getNameFromCacheUrl(request.url)
        if (!storedName) {
          return undefined
        }
        const response = await cache.match(request)
        if (!response) {
          return undefined
        }
        const blob = await response.blob()
        const name = getPublicName(storedName, blob.type)
        return {
          createdAt: Number(response.headers.get(createdAtHeader)) || 0,
          mimeType: blob.type,
          name,
          sequence: getSequenceFromName(storedName),
          size: blob.size,
          uri: `${audioDebugScheme}:///${name}`,
        }
      },
    ),
  )
  return assignSequences(
    recordings.filter((recording): recording is StoredAudioDebugRecording =>
      Boolean(recording),
    ),
  ).toSorted((a, b) => b.sequence - a.sequence || b.createdAt - a.createdAt)
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
    async clearAll(): Promise<void> {
      const cache = await getCache()
      const requests = await cache.keys()
      const deletions: Promise<boolean>[] = []
      for (const request of requests) {
        if (getNameFromCacheUrl(request.url) !== undefined) {
          deletions.push(cache.delete(request))
        }
      }
      await Promise.all(deletions)
    },
    async list(): Promise<readonly AudioDebugRecording[]> {
      const cache = await getCache()
      return listRecordings(cache)
    },
    async read(uri: string): Promise<Blob> {
      const cache = await getCache()
      const name = getNameFromUri(uri)
      const response = await matchRecording(cache, name)
      if (!response) {
        throw new Error(`Gpt Voice audio recording not found: ${name}`)
      }
      return response.blob()
    },
    async remove(uri: string): Promise<void> {
      const cache = await getCache()
      const name = getNameFromUri(uri)
      if (await cache.delete(getCacheUrl(name))) {
        return
      }
      const legacyName = getLegacyName(name)
      if (legacyName) {
        await cache.delete(getCacheUrl(legacyName))
      }
    },
    async save(blob: Blob): Promise<AudioDebugRecording> {
      const cache = await getCache()
      const recordings = await listRecordings(cache)
      let sequence = 1
      for (const recording of recordings) {
        sequence = Math.max(sequence, recording.sequence + 1)
      }
      const createdAt = dependencies.now()
      const name = `voice-message-${sequence}.${getExtension(blob.type)}`
      await cache.put(
        getCacheUrl(name),
        new Response(blob, {
          headers: {
            'content-length': String(blob.size),
            'content-type': blob.type,
            [createdAtHeader]: String(createdAt),
            'last-modified': new Date(createdAt).toUTCString(),
          },
        }),
      )
      return {
        createdAt,
        mimeType: blob.type,
        name,
        sequence,
        size: blob.size,
        uri: `${audioDebugScheme}:///${name}`,
      }
    },
  }
}

export const audioDebugStorage = createAudioDebugStorage()
