import { cpSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { root } from './root.ts'

const binaryNames = [
  'computer-use-linux-linux-x64',
  'computer-use-linux-linux-arm64',
  'computer-use-linux-cosmic',
]

export const copyComputerUseLinux = (destination: string): void => {
  const packageDir = path.join(
    root,
    'node_modules',
    '@agent-sh',
    'computer-use-linux',
    'npm',
    'bin',
  )
  if (!existsSync(packageDir)) return
  const included = binaryNames.filter((name) =>
    existsSync(path.join(packageDir, name)),
  )
  if (included.length === 0) return
  mkdirSync(destination, { recursive: true })
  for (const name of included) {
    cpSync(path.join(packageDir, name), path.join(destination, name))
  }
}
