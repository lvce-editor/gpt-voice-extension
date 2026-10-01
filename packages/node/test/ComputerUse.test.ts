import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import * as ComputerUse from '../src/parts/ComputerUse/ComputerUse.ts'

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
)
const missingBinaryError = /bundled computer-use-linux executable is missing/

test(
  'starts the bundled MCP server, discovers desktop tools, and disposes it',
  { skip: process.platform !== 'linux' },
  async () => {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
    ComputerUse.state.executablePath = path.join(
      root,
      'packages',
      'extension',
      'dist',
      'computer-use-linux',
      `computer-use-linux-linux-${arch}`,
    )
    try {
      const tools = await ComputerUse.getTools()
      assert.ok(tools.some((tool) => tool.name === 'doctor'))
    } finally {
      await ComputerUse.stop()
      ComputerUse.state.executablePath = undefined
    }
  },
)

test('reports a missing bundled backend as an actionable error', async () => {
  if (process.platform !== 'linux') return
  ComputerUse.state.executablePath = path.join(
    root,
    'packages',
    'extension',
    'dist',
    'computer-use-linux',
    'missing-computer-use-linux',
  )
  try {
    await assert.rejects(ComputerUse.getTools(), missingBinaryError)
  } finally {
    await ComputerUse.stop()
    ComputerUse.state.executablePath = undefined
  }
})
