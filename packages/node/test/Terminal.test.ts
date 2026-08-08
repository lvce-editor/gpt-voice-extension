import { strict as assert } from 'node:assert'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { commandMap, executeBash } from '../src/parts/Terminal/Terminal.ts'

const temporaryDirectories: string[] = []
const localWorkspaceErrorRegex = /local file:\/\//
const nonEmptyCommandErrorRegex = /non-empty/

afterEach(async () => {
  const directories = [...temporaryDirectories]
  temporaryDirectories.length = 0
  await Promise.all(
    directories.map((directory) =>
      rm(directory, {
        force: true,
        recursive: true,
      }),
    ),
  )
})

test('executes Bash in the opened workspace', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'gpt-voice-terminal-'))
  temporaryDirectories.push(workspace)
  await writeFile(path.join(workspace, 'workspace-marker'), '')

  const result = await executeBash(
    'test -f workspace-marker && printf workspace; printf output; printf error >&2',
    pathToFileURL(workspace).href,
  )

  assert.deepEqual(result, {
    exitCode: 0,
    stderr: 'error',
    stdout: 'workspaceoutput',
    timedOut: false,
  })
})

test('returns stdout, stderr, and a nonzero exit code', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'gpt-voice-terminal-'))
  temporaryDirectories.push(workspace)

  const result = await executeBash(
    'printf partial; printf failed >&2; exit 7',
    pathToFileURL(workspace).href,
  )

  assert.deepEqual(result, {
    exitCode: 7,
    stderr: 'failed',
    stdout: 'partial',
    timedOut: false,
  })
})

test('rejects empty commands and non-local workspaces', async () => {
  await assert.rejects(
    executeBash(' ', 'file:///workspace'),
    nonEmptyCommandErrorRegex,
  )
  await assert.rejects(
    executeBash('pwd', 'remote-ssh://host/workspace'),
    localWorkspaceErrorRegex,
  )
})

test('exports the node RPC command', () => {
  assert.equal(commandMap['Terminal.executeBash'], executeBash)
})
