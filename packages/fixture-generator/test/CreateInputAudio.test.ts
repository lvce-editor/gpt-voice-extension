import { expect, jest, test } from '@jest/globals'
import { createInputWav, generateSpeechPcm } from '../src/CreateInputAudio.ts'

test('createInputWav - creates 24kHz mono PCM16 wav with silence', () => {
  const wav = createInputWav(new Uint8Array([1, 2, 3, 4]), 1000, 500)
  expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
  expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
  expect(wav.readUInt32LE(24)).toBe(24_000)
  expect(wav.readUInt16LE(34)).toBe(16)
  expect(wav.subarray(44 + 48_000, 44 + 48_004)).toEqual(
    Buffer.from([1, 2, 3, 4]),
  )
  expect(() => createInputWav(new Uint8Array([1]))).toThrow(
    'complete 16-bit samples',
  )
})

test('generateSpeechPcm - sends authenticated pcm request', async () => {
  const fetchImplementation = jest.fn<typeof fetch>(async () => {
    return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 })
  })
  const result = await generateSpeechPcm({
    apiKey: 'secret',
    fetchImplementation,
    text: 'hello',
  })
  expect(result).toEqual(new Uint8Array([1, 2, 3, 4]))
  expect(fetchImplementation).toHaveBeenCalledWith(
    'https://api.openai.com/v1/audio/speech',
    expect.objectContaining({ method: 'POST' }),
  )
  const request = fetchImplementation.mock.calls[0]?.[1]
  expect(request?.body).toContain('"response_format":"pcm"')
  expect(request?.body).not.toContain('secret')
})

test('generateSpeechPcm - reports API errors', async () => {
  await expect(
    generateSpeechPcm({
      apiKey: 'secret',
      fetchImplementation: async () =>
        new Response('rate limited', { status: 429 }),
      text: 'hello',
    }),
  ).rejects.toThrow('OpenAI speech generation failed (429): rate limited')
})
