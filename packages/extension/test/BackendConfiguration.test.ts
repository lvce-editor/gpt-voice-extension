import { describe, expect, it, jest } from '@jest/globals'
import {
  resolveBackendVoiceConfiguration,
  type BackendConfigurationHost,
} from '../src/parts/BackendConfiguration/BackendConfiguration.ts'

const createHost = (
  backendUrl: unknown,
  accessToken: unknown,
): BackendConfigurationHost => ({
  executeCommand: jest.fn(async () => backendUrl),
  getAccessToken: jest.fn(async () => accessToken),
})

describe('resolveBackendVoiceConfiguration', () => {
  it('resolves the editor backend and refreshes the access token if needed', async () => {
    const host = createHost('https://lvce.example/', 'access-token')

    await expect(resolveBackendVoiceConfiguration(host)).resolves.toEqual({
      accessToken: 'access-token',
      baseUrl: 'https://lvce.example',
    })
    expect(host.executeCommand).toHaveBeenCalledWith('Layout.getBackendUrl')
    expect(host.getAccessToken).toHaveBeenCalledWith({
      refresh: 'if-needed',
    })
  })

  it.each([
    ['', 'access-token'],
    ['https://lvce.example', ''],
    ['https://lvce.example', undefined],
  ])(
    'returns undefined when backend authentication is incomplete',
    async (url, token) => {
      await expect(
        resolveBackendVoiceConfiguration(createHost(url, token)),
      ).resolves.toBeUndefined()
    },
  )

  it('returns undefined when the editor API is unavailable', async () => {
    const host = createHost('', '')
    jest
      .mocked(host.executeCommand)
      .mockRejectedValueOnce(new Error('not available'))

    await expect(
      resolveBackendVoiceConfiguration(host),
    ).resolves.toBeUndefined()
  })
})
