import type { NormalizedRecording } from './NormalizeTrace.ts'

const workspaceFixtureContent = 'Voice fixture workspace file'

interface CapabilityTestSource {
  readonly apiNames: readonly string[]
  readonly assertions: readonly string[]
  readonly setup: readonly string[]
}

const createSettingsSearchAssertions = (
  fixture: NormalizedRecording,
  opensSettings: boolean,
): readonly string[] => {
  const toolCall = fixture.expect.toolCalls.find(
    (item) => item.name === 'set_settings_search_value',
  )
  const argumentsValue = toolCall?.arguments
  if (
    !argumentsValue ||
    typeof argumentsValue !== 'object' ||
    !('value' in argumentsValue) ||
    typeof argumentsValue.value !== 'string'
  ) {
    return []
  }
  const declarations = opensSettings
    ? []
    : [
        `const settingsSearchInput = Locator('.SettingsSearchInput')`,
        'await expect(settingsSearchInput).toBeVisible()',
      ]
  return [
    ...declarations,
    `await expect(settingsSearchInput).toHaveValue(${JSON.stringify(argumentsValue.value)})`,
  ]
}

const createTerminalCapabilityTestSource = (
  fixture: NormalizedRecording,
): CapabilityTestSource => {
  const runInTerminalToolCall = fixture.expect.toolCalls.find(
    (toolCall) => toolCall.name === 'run_in_terminal',
  )
  const opensTerminal =
    Boolean(runInTerminalToolCall) ||
    fixture.expect.toolCalls.some(
      (toolCall) =>
        toolCall.name === 'set_panel' &&
        toolCall.arguments &&
        typeof toolCall.arguments === 'object' &&
        'action' in toolCall.arguments &&
        toolCall.arguments.action === 'open' &&
        'view' in toolCall.arguments &&
        toolCall.arguments.view === 'terminal',
    )
  if (!opensTerminal) {
    return { apiNames: [], assertions: [], setup: [] }
  }
  const settings = runInTerminalToolCall
    ? "{ 'gptvoice.tools.terminal.enabled': true, 'terminal.backend': 'mock' }"
    : "{ 'terminal.backend': 'mock' }"
  const assertions = [
    `const terminalTab = Locator('.PanelTab[name="Terminals"]')`,
    `const terminal = Locator('.XtermTerminal')`,
    'await expect(terminalTab).toBeVisible()',
    'await expect(terminal).toBeVisible()',
  ]
  const argumentsValue = runInTerminalToolCall?.arguments
  if (
    argumentsValue &&
    typeof argumentsValue === 'object' &&
    'command' in argumentsValue &&
    typeof argumentsValue.command === 'string'
  ) {
    assertions.push(
      `await expect(terminal).toContainText(${JSON.stringify(argumentsValue.command)})`,
    )
  }
  return {
    apiNames: ['Settings'],
    assertions,
    setup: [`await Settings.update(${settings})`],
  }
}

const explorerToolNames = new Set([
  'collapse_explorer_folder',
  'expand_explorer_folder',
  'open_explorer_context_menu',
  'start_explorer_rename',
])

const createExplorerCapabilityTestSource = (
  fixture: NormalizedRecording,
): CapabilityTestSource => {
  const toolCall = fixture.expect.toolCalls.find((item) =>
    explorerToolNames.has(item.name),
  )
  if (!toolCall) {
    return { apiNames: [], assertions: [], setup: [] }
  }
  const argumentsValue = toolCall.arguments
  const relativePath =
    argumentsValue &&
    typeof argumentsValue === 'object' &&
    'path' in argumentsValue &&
    typeof argumentsValue.path === 'string'
      ? argumentsValue.path
      : 'voice-explorer-folder'
  const pathSegments = relativePath.split('/').filter(Boolean)
  const itemName = pathSegments.at(-1) || relativePath
  const directoryPaths = pathSegments.map((_, index) =>
    pathSegments.slice(0, index + 1).join('/'),
  )
  const setup = [
    'const explorerWorkspaceUri = await FileSystem.getTmpDir()',
    ...directoryPaths.map(
      (directoryPath) =>
        `await FileSystem.mkdir(explorerWorkspaceUri + ${JSON.stringify('/' + directoryPath)})`,
    ),
    `await FileSystem.writeFile(explorerWorkspaceUri + ${JSON.stringify('/' + relativePath + '/voice-child.txt')}, 'Explorer voice fixture')`,
    'await Workspace.setPath(explorerWorkspaceUri)',
    `await SideBar.open('Explorer')`,
  ]
  const itemLocator = `Locator('.Explorer .TreeItem[aria-label=${JSON.stringify(itemName)}]')`
  const assertions: string[] = []
  const apiNames = ['FileSystem', 'Workspace']

  switch (toolCall.name) {
    case 'collapse_explorer_folder':
      apiNames.push('Explorer')
      setup.push('await Explorer.handleClick(0)')
      assertions.push(
        `const explorerItem = ${itemLocator}`,
        `const explorerChild = Locator('.Explorer .TreeItem[aria-label="voice-child.txt"]')`,
        `await expect(explorerItem).toHaveAttribute('aria-expanded', 'false')`,
        `await expect(explorerChild).toHaveCount(0)`,
      )
      break
    case 'expand_explorer_folder':
      assertions.push(
        `const explorerItem = ${itemLocator}`,
        `const explorerChild = Locator('.Explorer .TreeItem[aria-label="voice-child.txt"]')`,
        `await expect(explorerItem).toHaveAttribute('aria-expanded', 'true')`,
        `await expect(explorerChild).toBeVisible()`,
      )
      break
    case 'open_explorer_context_menu':
      assertions.push(
        `const explorerContextMenu = Locator('.Menu')`,
        `await expect(explorerContextMenu).toBeVisible()`,
      )
      break
    case 'start_explorer_rename':
      assertions.push(
        `const explorerInput = Locator('.ExplorerInputBox')`,
        'await expect(explorerInput).toBeVisible()',
        'await expect(explorerInput).toBeFocused()',
        `await expect(explorerInput).toHaveValue(${JSON.stringify(itemName)})`,
      )
      break
  }

  return { apiNames, assertions, setup }
}

const createCapabilityTestSource = (
  fixture: NormalizedRecording,
): CapabilityTestSource => {
  const terminalCapability = createTerminalCapabilityTestSource(fixture)
  const explorerCapability = createExplorerCapabilityTestSource(fixture)
  const apiNames = new Set<string>([
    ...terminalCapability.apiNames,
    ...explorerCapability.apiNames,
  ])
  const assertions: string[] = [
    ...terminalCapability.assertions,
    ...explorerCapability.assertions,
  ]
  const setup: string[] = [
    ...terminalCapability.setup,
    ...explorerCapability.setup,
  ]

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

  assertions.push(...createSettingsSearchAssertions(fixture, opensSettings))

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
