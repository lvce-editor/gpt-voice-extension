import { expect, jest, test } from '@jest/globals'
import {
  createOpenAiApiKeyStorage,
  type OpenAiApiKeyStorage,
  type SecretStorageApi,
} from '../src/parts/OpenAiApiKeyStorage/OpenAiApiKeyStorage.ts'

const createLegacyStorage = (): OpenAiApiKeyStorage => ({
  delete: jest.fn(async () => undefined),
  read: jest.fn(async () => 'legacy-value'),
  write: jest.fn(async () => undefined),
})

const createSecretStorage = (): SecretStorageApi => ({
  deleteSecret: jest.fn(async () => undefined),
  getSecret: jest.fn(async () => 'secret-value'),
  storeSecret: jest.fn(async () => undefined),
})

test('storage - uses supported secret storage', async () => {
  const secretStorage = createSecretStorage()
  const legacyStorage = createLegacyStorage()
  const storage = createOpenAiApiKeyStorage(secretStorage, legacyStorage)

  await expect(storage.read()).resolves.toBe('secret-value')
  await storage.write('new-value')
  await storage.delete()

  expect(secretStorage.getSecret).toHaveBeenCalledWith(
    'builtin.gpt-voice.openai-api-key',
  )
  expect(secretStorage.storeSecret).toHaveBeenCalledWith(
    'builtin.gpt-voice.openai-api-key',
    'new-value',
  )
  expect(secretStorage.deleteSecret).toHaveBeenCalledWith(
    'builtin.gpt-voice.openai-api-key',
  )
  expect(legacyStorage.delete).toHaveBeenCalledTimes(2)
  expect(legacyStorage.write).not.toHaveBeenCalled()
})

test('storage - falls back after unsupported read', async () => {
  const secretStorage = createSecretStorage()
  const legacyStorage = createLegacyStorage()
  jest
    .mocked(secretStorage.getSecret)
    .mockRejectedValue(new Error('Command not found Extensions.getSecret'))
  const storage = createOpenAiApiKeyStorage(secretStorage, legacyStorage)

  await expect(storage.read()).resolves.toBe('legacy-value')
  await expect(storage.read()).resolves.toBe('legacy-value')

  expect(secretStorage.getSecret).toHaveBeenCalledTimes(1)
  expect(legacyStorage.read).toHaveBeenCalledTimes(2)
})

test('storage - falls back after unsupported write', async () => {
  const secretStorage = createSecretStorage()
  const legacyStorage = createLegacyStorage()
  jest
    .mocked(secretStorage.storeSecret)
    .mockRejectedValue(new Error('Command not found Extensions.storeSecret'))
  const storage = createOpenAiApiKeyStorage(secretStorage, legacyStorage)

  await storage.write('first')
  await storage.write('second')

  expect(secretStorage.storeSecret).toHaveBeenCalledTimes(1)
  expect(legacyStorage.write).toHaveBeenNthCalledWith(1, 'first')
  expect(legacyStorage.write).toHaveBeenNthCalledWith(2, 'second')
})

test('storage - falls back after unsupported delete', async () => {
  const secretStorage = createSecretStorage()
  const legacyStorage = createLegacyStorage()
  jest
    .mocked(secretStorage.deleteSecret)
    .mockRejectedValue(new Error('Command not found Extensions.deleteSecret'))
  const storage = createOpenAiApiKeyStorage(secretStorage, legacyStorage)

  await storage.delete()
  await storage.delete()

  expect(secretStorage.deleteSecret).toHaveBeenCalledTimes(1)
  expect(legacyStorage.delete).toHaveBeenCalledTimes(2)
})

test.each([
  ['read', 1],
  ['read', new Error('permission denied')],
  ['write', new Error('permission denied')],
  ['delete', new Error('permission denied')],
] as const)(
  'storage - rethrows unexpected %s failure',
  async (method, error) => {
    const storage = createOpenAiApiKeyStorage(
      {
        deleteSecret: async () => {
          throw error
        },
        getSecret: async () => {
          throw error
        },
        storeSecret: async () => {
          throw error
        },
      },
      createLegacyStorage(),
    )

    if (method === 'read') {
      // eslint-disable-next-line jest/no-conditional-expect
      await expect(storage.read()).rejects.toBe(error)
    } else if (method === 'write') {
      // eslint-disable-next-line jest/no-conditional-expect
      await expect(storage.write('value')).rejects.toBe(error)
    } else {
      // eslint-disable-next-line jest/no-conditional-expect
      await expect(storage.delete()).rejects.toBe(error)
    }
  },
)

test('storage - legacy fallback works without cache api', async () => {
  const secretStorage = createSecretStorage()
  jest
    .mocked(secretStorage.storeSecret)
    .mockRejectedValue(new Error('Command not found Extensions.storeSecret'))
  const storage = createOpenAiApiKeyStorage(secretStorage)

  await storage.write('fallback-value')
  await expect(storage.read()).resolves.toBe('fallback-value')
  await storage.delete()
  await expect(storage.read()).resolves.toBeUndefined()
})

test('storage - legacy fallback uses cache api when available', async () => {
  const originalCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches')
  const match = jest
    .fn<() => Promise<Response | undefined>>()
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(new Response(''))
    .mockResolvedValueOnce(new Response('cached-value'))
  const cache = {
    delete: jest.fn<(request: string) => Promise<boolean>>(async () => true),
    match,
    put: jest.fn<(request: string, response: Response) => Promise<void>>(
      async () => undefined,
    ),
  }
  const open = jest.fn(async () => cache)
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: { open },
  })

  try {
    const secretStorage = createSecretStorage()
    jest
      .mocked(secretStorage.getSecret)
      .mockRejectedValue(new Error('Command not found Extensions.getSecret'))
    const storage = createOpenAiApiKeyStorage(secretStorage)

    await expect(storage.read()).resolves.toBeUndefined()
    await expect(storage.read()).resolves.toBeUndefined()
    await expect(storage.read()).resolves.toBe('cached-value')
    await storage.write('new-value')
    await storage.delete()

    expect(cache.put).toHaveBeenCalledWith(
      '/gpt-voice-openai-api-key',
      expect.any(Response),
    )
    expect(cache.delete).toHaveBeenCalledWith('/gpt-voice-openai-api-key')
  } finally {
    if (originalCaches) {
      Object.defineProperty(globalThis, 'caches', originalCaches)
    } else {
      Object.defineProperty(globalThis, 'caches', {
        configurable: true,
        value: undefined,
      })
    }
  }
})
