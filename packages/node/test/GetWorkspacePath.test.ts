import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { getWorkspacePath } from '../src/parts/GetWorkspacePath/GetWorkspacePath.ts'

const invalidWorkspaceErrorRegex = /invalid/
const localWorkspaceErrorRegex = /local file:\/\//
const escapedSpaceRegex = /%20/

test('returns the path of a local workspace URI', () => {
  const workspacePath = path.join(process.cwd(), 'workspace', 'example')

  assert.equal(
    getWorkspacePath(pathToFileURL(workspacePath).href),
    workspacePath,
  )
})

test('decodes escaped path characters', () => {
  const workspacePath = path.join(process.cwd(), 'workspace', 'with space')
  const workspaceUri = pathToFileURL(workspacePath).href

  assert.match(workspaceUri, escapedSpaceRegex)
  assert.equal(getWorkspacePath(workspaceUri), workspacePath)
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
