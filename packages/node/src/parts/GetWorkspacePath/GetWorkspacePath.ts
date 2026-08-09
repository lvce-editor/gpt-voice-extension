import { fileURLToPath } from 'node:url'

export const getWorkspacePath = (workspaceUri: string): string => {
  let url: URL
  try {
    url = new URL(workspaceUri)
  } catch {
    throw new TypeError('The opened workspace URI is invalid.')
  }
  if (url.protocol !== 'file:') {
    throw new TypeError(
      'Bash commands can only run in a local file:// workspace.',
    )
  }
  return fileURLToPath(url)
}
