export interface SecretStorageApi {
  readonly deleteSecret: (key: string) => Promise<void>
  readonly getSecret: (key: string) => Promise<string | undefined>
  readonly storeSecret: (key: string, value: string) => Promise<void>
}

export interface OpenAiApiKeyStorage {
  readonly delete: () => Promise<void>
  readonly read: () => Promise<string | undefined>
  readonly write: (value: string) => Promise<void>
}

const openAiApiKeySecretStorageKey = 'builtin.gpt-voice.openai-api-key'

const cacheName = 'builtin.gpt-voice'
const cacheRequestUrl = '/gpt-voice-openai-api-key'

const isSecretStorageUnsupported = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false
  }
  return [
    'Extensions.deleteSecret',
    'Extensions.getSecret',
    'Extensions.storeSecret',
  ].some((command) => error.message.includes(`Command not found ${command}`))
}

const createLegacyStorage = (): OpenAiApiKeyStorage => {
  let fallbackValue: string | undefined

  const read = async (): Promise<string | undefined> => {
    if (typeof caches === 'undefined') {
      return fallbackValue
    }
    const cache = await caches.open(cacheName)
    const response = await cache.match(cacheRequestUrl)
    if (!response) {
      return fallbackValue
    }
    const value = await response.text()
    return value || undefined
  }

  const write = async (value: string): Promise<void> => {
    fallbackValue = value
    if (typeof caches === 'undefined') {
      return
    }
    const cache = await caches.open(cacheName)
    await cache.put(cacheRequestUrl, new Response(value))
  }

  const deleteStorage = async (): Promise<void> => {
    fallbackValue = undefined
    if (typeof caches === 'undefined') {
      return
    }
    const cache = await caches.open(cacheName)
    await cache.delete(cacheRequestUrl)
  }

  return {
    delete: deleteStorage,
    read,
    write,
  }
}

export const createOpenAiApiKeyStorage = (
  secretStorage: SecretStorageApi,
  legacyStorage: OpenAiApiKeyStorage = createLegacyStorage(),
): OpenAiApiKeyStorage => {
  let isSecretStorageSupported = true

  const handleSecretStorageError = (error: unknown): void => {
    if (!isSecretStorageUnsupported(error)) {
      throw error
    }
    isSecretStorageSupported = false
  }

  return {
    async delete(): Promise<void> {
      if (isSecretStorageSupported) {
        try {
          await secretStorage.deleteSecret(openAiApiKeySecretStorageKey)
        } catch (error) {
          handleSecretStorageError(error)
        }
      }
      await legacyStorage.delete()
    },
    async read(): Promise<string | undefined> {
      if (!isSecretStorageSupported) {
        return legacyStorage.read()
      }
      try {
        return await secretStorage.getSecret(openAiApiKeySecretStorageKey)
      } catch (error) {
        handleSecretStorageError(error)
        return legacyStorage.read()
      }
    },
    async write(value: string): Promise<void> {
      if (isSecretStorageSupported) {
        try {
          await secretStorage.storeSecret(openAiApiKeySecretStorageKey, value)
        } catch (error) {
          handleSecretStorageError(error)
        }
      }
      if (isSecretStorageSupported) {
        await legacyStorage.delete()
      } else {
        await legacyStorage.write(value)
      }
    },
  }
}
