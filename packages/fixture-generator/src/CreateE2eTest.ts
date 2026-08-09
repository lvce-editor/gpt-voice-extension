import type { NormalizedRecording } from './NormalizeTrace.ts'

const workspaceFixtureContent = 'Voice fixture workspace file'

interface CapabilityTestSource {
  readonly apiNames: readonly string[]
  readonly assertions: readonly string[]
  readonly setup: readonly string[]
}

const createCapabilityTestSource = (
  fixture: NormalizedRecording,
): CapabilityTestSource => {
  const apiNames = new Set<string>()
  const assertions: string[] = []
  const setup: string[] = []
  const opensTerminal = fixture.expect.toolCalls.some(
    (toolCall) =>
      toolCall.name === 'set_panel' &&
      toolCall.arguments &&
      typeof toolCall.arguments === 'object' &&
      'action' in toolCall.arguments &&
      toolCall.arguments.action === 'open' &&
      'view' in toolCall.arguments &&
      toolCall.arguments.view === 'terminal',
  )
  if (opensTerminal) {
    apiNames.add('Settings')
    setup.push("await Settings.update({ 'terminal.backend': 'mock' })")
    assertions.push(
      `const terminalTab = Locator('.PanelTab[name="Terminals"]')`,
      `const terminal = Locator('.XtermTerminal')`,
      'await expect(terminalTab).toBeVisible()',
      'await expect(terminal).toBeVisible()',
    )
  }

  const opensSettings = fixture.expect.toolCalls.some(
    (toolCall) => toolCall.name === 'open_settings',
  )
  if (opensSettings) {
    assertions.push(
      `const settings = Locator('.Settings')`,
      `const settingsSearchInput = Locator('.SettingsSearchInput')`,
      'await expect(settings).toBeVisible()',
      `await expect(settingsSearchInput).toHaveAttribute('placeholder', 'Search Settings')`,
    )
  }

  const setSettingsSearchValueToolCall = fixture.expect.toolCalls.find(
    (toolCall) => toolCall.name === 'set_settings_search_value',
  )
  const settingsSearchArguments = setSettingsSearchValueToolCall?.arguments
  const settingsSearchValue =
    settingsSearchArguments &&
    typeof settingsSearchArguments === 'object' &&
    'value' in settingsSearchArguments &&
    typeof settingsSearchArguments.value === 'string'
      ? settingsSearchArguments.value
      : undefined
  if (settingsSearchValue !== undefined) {
    if (!opensSettings) {
      assertions.push(
        `const settingsSearchInput = Locator('.SettingsSearchInput')`,
        'await expect(settingsSearchInput).toBeVisible()',
      )
    }
    assertions.push(
      `await expect(settingsSearchInput).toHaveValue(${JSON.stringify(settingsSearchValue)})`,
    )
  }

  const openFileToolCall = fixture.expect.toolCalls.find(
    (toolCall) =>
      toolCall.name === 'open_workspace_file' &&
      toolCall.output &&
      typeof toolCall.output === 'object' &&
      'opened' in toolCall.output &&
      toolCall.output.opened === true,
  )
  const openFileArguments = openFileToolCall?.arguments
  const openFilePath =
    openFileArguments &&
    typeof openFileArguments === 'object' &&
    'path' in openFileArguments &&
    typeof openFileArguments.path === 'string'
      ? openFileArguments.path
      : undefined
  if (openFilePath) {
    const openFileUriSuffix = JSON.stringify(`/${openFilePath}`)
    const openFilePathSegments = openFilePath.split('/').filter(Boolean)
    const openFileName = openFilePathSegments.at(-1) || openFilePath
    const openFileDirectoryPaths = openFilePathSegments
      .slice(0, -1)
      .map((_, index) => openFilePathSegments.slice(0, index + 1).join('/'))
    apiNames.add('Editor')
    apiNames.add('FileSystem')
    apiNames.add('Main')
    apiNames.add('Workspace')
    setup.push(
      'await Main.closeAllEditors()',
      'const workspaceUri = await FileSystem.getTmpDir()',
      ...openFileDirectoryPaths.map((directoryPath) => {
        const directoryUriSuffix = JSON.stringify('/' + directoryPath)
        return `await FileSystem.mkdir(workspaceUri + ${directoryUriSuffix})`
      }),
      `await FileSystem.writeFile(workspaceUri + ${openFileUriSuffix}, ${JSON.stringify(workspaceFixtureContent)})`,
      'await Workspace.setPath(workspaceUri)',
    )
    assertions.push(
      `const editorTabTitle = Locator('.MainTab .TabTitle')`,
      `await expect(editorTabTitle).toHaveText(${JSON.stringify(openFileName)})`,
      `await Editor.shouldHaveText(${JSON.stringify(workspaceFixtureContent)})`,
    )
  }

  const readFileToolCall = fixture.expect.toolCalls.find(
    (toolCall) => toolCall.name === 'read_workspace_file',
  )
  const readFileArguments = readFileToolCall?.arguments
  const readFileOutput = readFileToolCall?.output
  const readFilePath =
    readFileArguments &&
    typeof readFileArguments === 'object' &&
    'path' in readFileArguments &&
    typeof readFileArguments.path === 'string'
      ? readFileArguments.path
      : undefined
  const readFileContent =
    readFileOutput &&
    typeof readFileOutput === 'object' &&
    'content' in readFileOutput &&
    typeof readFileOutput.content === 'string'
      ? readFileOutput.content
      : undefined
  if (readFilePath && readFileContent !== undefined) {
    const readFileUriSuffix = JSON.stringify(`/${readFilePath}`)
    apiNames.add('FileSystem')
    apiNames.add('Workspace')
    setup.push(
      'const workspaceUri = await FileSystem.getTmpDir()',
      `await FileSystem.writeFile(workspaceUri + ${readFileUriSuffix}, ${JSON.stringify(readFileContent)})`,
      'await Workspace.setPath(workspaceUri)',
    )
  }

  const setQuickPickValueToolCall = fixture.expect.toolCalls.find(
    (toolCall) => toolCall.name === 'set_quick_pick_value',
  )
  const setQuickPickValueArguments = setQuickPickValueToolCall?.arguments
  const quickPickValue =
    setQuickPickValueArguments &&
    typeof setQuickPickValueArguments === 'object' &&
    'value' in setQuickPickValueArguments &&
    typeof setQuickPickValueArguments.value === 'string'
      ? setQuickPickValueArguments.value
      : undefined
  if (quickPickValue !== undefined) {
    assertions.push(
      `const quickPickInput = Locator('#QuickPick .InputBox')`,
      'await expect(quickPickInput).toBeVisible()',
      `await expect(quickPickInput).toHaveValue(${JSON.stringify(quickPickValue)})`,
    )
  }

  return {
    apiNames: [...apiNames],
    assertions,
    setup,
  }
}

export const createE2eTestSource = (fixture: NormalizedRecording): string => {
  const fixtureValue = JSON.stringify(fixture, null, 2)
  const toolCallLabels = fixture.expect.toolCalls.map((toolCall) => {
    const failed =
      toolCall.output &&
      typeof toolCall.output === 'object' &&
      'error' in toolCall.output
    return `${failed ? 'Failed' : 'Ran'} ${toolCall.name}`
  })
  const capabilityTestSource = createCapabilityTestSource(fixture)
  const apiNames = [
    'Command',
    ...capabilityTestSource.apiNames,
    'expect',
    'Locator',
    'SideBar',
  ].toSorted((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
  const setup = capabilityTestSource.setup.map((line) => `  ${line}\n`).join('')
  const assertions = capabilityTestSource.assertions
    .map((line) => `  ${line}\n`)
    .join('')
  return `import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = ${fixtureValue} as const
const expectedToolCallLabels = ${JSON.stringify(toolCallLabels)} as const

export const name = 'gpt-voice.fixture-${String(fixture.name)}'

export const test: Test = async ({ ${apiNames.join(', ')} }) => {
${setup}
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')

  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  const voice = Locator('.GptVoice')
  const userTranscript = Locator('.GptVoiceTranscriptItemUser')
  const assistantTranscript = Locator('.GptVoiceTranscriptItemAi')
  await expect(userTranscript).toHaveText(fixture.expect.userText)
  for (const label of expectedToolCallLabels) {
    await expect(voice).toContainText(label)
  }
  await expect(assistantTranscript).toHaveText(fixture.expect.assistantText)
${assertions}}
`
}
