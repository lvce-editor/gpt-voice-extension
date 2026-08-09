import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { getWorkspacePath } from '../src/parts/GetWorkspacePath/GetWorkspacePath.ts'

const invalidWorkspaceErrorRegex = /invalid/
const localWorkspaceErrorRegex = /local file:\/\//

test('returns the path of a local workspace URI', () => {
  assert.equal(
    getWorkspacePath('file:///workspace/example'),
    path.join(path.sep, 'workspace', 'example'),
  )
})

test('decodes escaped path characters', () => {
  assert.equal(
    getWorkspacePath('file:///workspace/with%20space'),
    path.join(path.sep, 'workspace', 'with space'),
  )
})

test('rejects an invalid workspace URI', () => {
  assert.throws(
    () => getWorkspacePath('invalid uri'),
    invalidWorkspaceErrorRegex,
  )
})

test('rejects a non-local workspace URI', () => {
  assert.throws(
    () => getWorkspacePath('remote-ssh://host/workspace'),
    localWorkspaceErrorRegex,
  )
})
