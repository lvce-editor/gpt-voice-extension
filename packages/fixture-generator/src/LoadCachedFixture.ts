import { readFile } from 'node:fs/promises'
import type { NormalizedRecording } from './NormalizeTrace.ts'

const isFileNotFoundError = (error: unknown): boolean => {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'ENOENT'
  )
}

export const loadCachedFixture = async (
  fixturePath: string,
  regenerateExisting: boolean,
): Promise<NormalizedRecording | undefined> => {
  if (regenerateExisting) {
    return undefined
  }
  try {
    return JSON.parse(
      await readFile(fixturePath, 'utf8'),
    ) as NormalizedRecording
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return undefined
    }
    throw error
  }
}
