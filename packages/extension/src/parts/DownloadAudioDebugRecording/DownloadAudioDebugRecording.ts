import type { AudioDebugStorage } from 'voice-shared'
import { executeCommand } from '@lvce-editor/api'

interface DownloadAudioDebugRecordingDependencies {
  readonly createObjectUrl: (blob: Blob) => string
  readonly executeCommand: (
    id: string,
    ...args: readonly unknown[]
  ) => Promise<unknown>
  readonly revokeObjectUrl: (url: string) => void
  readonly waitForDownload: () => Promise<void>
}

const defaultDependencies: DownloadAudioDebugRecordingDependencies = {
  createObjectUrl(blob: Blob): string {
    return URL.createObjectURL(blob)
  },
  executeCommand,
  revokeObjectUrl(url: string): void {
    URL.revokeObjectURL(url)
  },
  async waitForDownload(): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  },
}

export const downloadAudioDebugRecordingWithDependencies = async (
  storage: AudioDebugStorage,
  uri: string,
  name: string,
  dependencies: Readonly<DownloadAudioDebugRecordingDependencies>,
): Promise<void> => {
  const blob = await storage.read(uri)
  const url = dependencies.createObjectUrl(blob)
  try {
    await dependencies.executeCommand('Download.downloadFile', name, url)
  } finally {
    await dependencies.waitForDownload()
    dependencies.revokeObjectUrl(url)
  }
}

export const downloadAudioDebugRecording = (
  storage: AudioDebugStorage,
  uri: string,
  name: string,
): Promise<void> => {
  return downloadAudioDebugRecordingWithDependencies(
    storage,
    uri,
    name,
    defaultDependencies,
  )
}
