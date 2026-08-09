import { spawn } from 'node:child_process'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { closeControlServer, startControlServer } from './ControlServer.ts'
import { createE2eTestSource } from './CreateE2eTest.ts'
import { createInputWav, generateSpeechPcm } from './CreateInputAudio.ts'
import { loadCachedFixture } from './LoadCachedFixture.ts'
import { normalizeRecording } from './NormalizeTrace.ts'
import { parseCliArgs } from './ParseCliArgs.ts'

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(packageRoot, '..', '..', '..')

const run = async (command: string, args: readonly string[]): Promise<void> => {
  const child = spawn(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  })
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', resolve)
  })
  if (exitCode !== 0) {
    throw new Error(`${command} exited with code ${exitCode}`)
  }
}

const writeE2eTest = async (
  e2eTestPath: string,
  fixture: Parameters<typeof createE2eTestSource>[0],
): Promise<void> => {
  await writeFile(e2eTestPath, createE2eTestSource(fixture))
  await run(process.execPath, [
    'node_modules/prettier/bin/prettier.cjs',
    '--write',
    e2eTestPath,
  ])
}

const main = async (): Promise<void> => {
  const options = parseCliArgs(process.argv.slice(2))
  const fixtureDir = path.join(
    root,
    'packages',
    'e2e',
    'fixtures',
    options.name,
  )
  const temporaryDir = path.join(root, '.tmp', 'voice-fixtures', options.name)
  const e2eTestPath = path.join(
    root,
    'packages',
    'e2e',
    'src',
    `gpt-voice-fixture-${options.name}.ts`,
  )
  const fixturePath = path.join(fixtureDir, 'fixture.json')
  const cachedFixture = await loadCachedFixture(
    fixturePath,
    options.regenerateExisting,
  )
  if (cachedFixture) {
    await writeE2eTest(e2eTestPath, cachedFixture)
    return
  }

  const apiKey = process.env['OPENAI_API_KEY']
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to generate a voice fixture')
  }

  await rm(temporaryDir, { force: true, recursive: true })
  await mkdir(temporaryDir, { recursive: true })
  const inputAudioPath = path.join(temporaryDir, 'input.wav')
  const rawRecordingPath = path.join(temporaryDir, 'raw-recording.json')
  const pcm = await generateSpeechPcm({
    apiKey,
    text: options.text,
  })
  await writeFile(inputAudioPath, createInputWav(pcm))

  const source = {
    inputAudio: 'input.wav',
    name: options.name,
    realtimeModel: 'gpt-realtime-2.1-mini',
    recordedAt: new Date().toISOString(),
    text: options.text,
    ttsModel: 'gpt-4o-mini-tts',
    ttsVoice: 'marin',
  }
  const server = await startControlServer({
    apiKey,
    outputUri: pathToFileURL(rawRecordingPath).href,
    source,
  })
  try {
    await run(process.execPath, ['packages/build/src/build-extension.ts'])
    await run(process.execPath, [
      'node_modules/@lvce-editor/test-with-playwright/bin/test-with-playwright.js',
      '--electron',
      '--only-extension=packages/extension',
      '--test-path=packages/fixture-generator/e2e',
      '--electron-arg=--use-fake-device-for-media-stream',
      '--electron-arg=--use-fake-ui-for-media-stream',
      `--electron-arg=--use-file-for-fake-audio-capture=${inputAudioPath}`,
    ])
  } finally {
    await closeControlServer(server)
  }

  const rawRecording = JSON.parse(await readFile(rawRecordingPath, 'utf8'))
  const fixture = normalizeRecording(rawRecording)
  if (options.regenerateExisting) {
    await rm(fixtureDir, { force: true, recursive: true })
  }
  await mkdir(fixtureDir, { recursive: true })
  await copyFile(inputAudioPath, path.join(fixtureDir, 'input.wav'))
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`)
  await writeE2eTest(e2eTestPath, fixture)
}

await main()
