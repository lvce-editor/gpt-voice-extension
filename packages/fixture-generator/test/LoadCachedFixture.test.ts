import { expect, test } from '@jest/globals'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadCachedFixture } from '../src/LoadCachedFixture.ts'

test('loadCachedFixture - reuses a recorded fixture by default', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'voice-fixture-'))
  const fixturePath = path.join(directory, 'fixture.json')
  const fixture = {
    expect: { assistantText: 'Done.', toolCalls: [], userText: 'Hello' },
    name: 'cached',
    schemaVersion: 1,
    source: { text: 'Hello' },
    trace: [],
  } as const
  await writeFile(fixturePath, JSON.stringify(fixture))
  try {
    await expect(loadCachedFixture(fixturePath, false)).resolves.toEqual(
      fixture,
    )
    await expect(loadCachedFixture(fixturePath, true)).resolves.toBeUndefined()
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
})

test('loadCachedFixture - returns undefined when no fixture exists', async () => {
  await expect(
    loadCachedFixture('/fixture-that-does-not-exist.json', false),
  ).resolves.toBeUndefined()
})
