const sampleRate = 24_000
const bytesPerSample = 2

const getSilenceByteLength = (durationMs: number): number => {
  return Math.round((durationMs / 1000) * sampleRate) * bytesPerSample
}

const writeWavHeader = (
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- this function initializes the new WAV buffer in place
  buffer: Buffer,
  pcmByteLength: number,
): void => {
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + pcmByteLength, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28)
  buffer.writeUInt16LE(bytesPerSample, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(pcmByteLength, 40)
}

export const createInputWav = (
  pcm: Uint8Array,
  leadingSilenceMs = 2000,
  trailingSilenceMs = 1500,
): Buffer => {
  if (pcm.byteLength % bytesPerSample !== 0) {
    throw new TypeError('PCM input must contain complete 16-bit samples')
  }
  const leadingByteLength = getSilenceByteLength(leadingSilenceMs)
  const trailingByteLength = getSilenceByteLength(trailingSilenceMs)
  const pcmByteLength = leadingByteLength + pcm.byteLength + trailingByteLength
  const wav = Buffer.alloc(44 + pcmByteLength)
  writeWavHeader(wav, pcmByteLength)
  Buffer.from(pcm).copy(wav, 44 + leadingByteLength)
  return wav
}

interface GenerateSpeechOptions {
  readonly apiKey: string
  readonly fetchImplementation?: typeof fetch
  readonly model?: string
  readonly text: string
  readonly voice?: string
}

export const generateSpeechPcm = async (
  options: GenerateSpeechOptions,
): Promise<Uint8Array> => {
  const fetchImplementation = options.fetchImplementation ?? fetch
  const response = await fetchImplementation(
    'https://api.openai.com/v1/audio/speech',
    {
      body: JSON.stringify({
        input: options.text,
        model: options.model ?? 'gpt-4o-mini-tts',
        response_format: 'pcm',
        voice: options.voice ?? 'marin',
      }),
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  )
  if (!response.ok) {
    const details = await response.text()
    throw new Error(
      `OpenAI speech generation failed (${response.status}): ${details}`,
    )
  }
  return new Uint8Array(await response.arrayBuffer())
}
