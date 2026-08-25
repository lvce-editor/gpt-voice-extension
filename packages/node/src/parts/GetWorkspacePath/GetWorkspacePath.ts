import { fileURLToPath } from 'node:url'

export const getWorkspacePath = (workspaceUri: string): string => {
  if (!URL.canParse(workspaceUri)) {
    throw new TypeError('The opened workspace URI is invalid.')
  }
  const url = new URL(workspaceUri)
  if (url.protocol !== 'file:') {
    throw new TypeError(
      'Bash commands can only run in a local file:// workspace.',
    )
  }
  return fileURLToPath(url)
}
