import { expect, test } from '@jest/globals'
import { createE2eTestSource } from '../src/CreateE2eTest.ts'

test('createE2eTestSource - creates a self-contained replay test', () => {
  const source = createE2eTestSource({
    expect: {
      assistantText: 'It is sunny.',
      toolCalls: [
        {
          arguments: { location: 'Paris' },
          name: 'getweather',
          output: { temperature: 20 },
        },
      ],
      userText: 'Weather?',
    },
    name: 'weather-paris',
    schemaVersion: 1,
    source: { text: 'Weather?' },
    trace: [],
  })

  expect(source).toContain(
    "export const name = 'gpt-voice.fixture-weather-paris'",
  )
  expect(source).toContain('const fixture = {')
  expect(source).toContain('"Ran getweather"')
  expect(source).not.toContain("from '../fixtures")
})

test('createE2eTestSource - verifies an opened terminal', () => {
  const source = createE2eTestSource({
    expect: {
      assistantText: 'The terminal is open.',
      toolCalls: [
        {
          arguments: { action: 'open', view: 'terminal' },
          name: 'set_panel',
          output: { action: 'open', success: true, view: 'terminal' },
        },
      ],
      userText: 'Open the terminal.',
    },
    name: 'open-terminal',
    schemaVersion: 1,
    source: { text: 'Open the terminal.' },
    trace: [],
  })

  expect(source).toContain("Settings.update({ 'terminal.backend': 'mock' })")
  expect(source).toContain("const terminal = Locator('.XtermTerminal')")
})

test('createE2eTestSource - creates and verifies an opened workspace file', () => {
  const source = createE2eTestSource({
    expect: {
      assistantText: 'The file is open.',
      toolCalls: [
        {
          arguments: { path: 'voice-fixture.txt' },
          name: 'open_workspace_file',
          output: { opened: true, path: 'voice-fixture.txt' },
        },
      ],
      userText: 'Open voice-fixture.txt.',
    },
    name: 'open-workspace-file',
    schemaVersion: 1,
    source: { text: 'Open voice-fixture.txt.' },
    trace: [],
  })

  expect(source).toContain('await FileSystem.getTmpDir()')
  expect(source).toContain(
    "const editorTabTitle = Locator('.MainTab .TabTitle')",
  )
  expect(source).toContain(
    'Editor.shouldHaveText("Voice fixture workspace file")',
  )
})

test('createE2eTestSource - creates parent folders for a nested workspace file', () => {
  const source = createE2eTestSource({
    expect: {
      assistantText: 'The file is open.',
      toolCalls: [
        {
          arguments: { path: 'devcontainer.json' },
          name: 'open_workspace_file',
          output: { error: 'File not found' },
        },
        {
          arguments: { query: 'devcontainer.json' },
          name: 'search_workspace_files',
          output: { matches: ['.devcontainer/devcontainer.json'] },
        },
        {
          arguments: { path: '.devcontainer/devcontainer.json' },
          name: 'open_workspace_file',
          output: {
            opened: true,
            path: '.devcontainer/devcontainer.json',
          },
        },
      ],
      userText: 'Open devcontainer.json.',
    },
    name: 'open-nested-workspace-file',
    schemaVersion: 1,
    source: { text: 'Open devcontainer.json.' },
    trace: [],
  })

  expect(source).toContain(
    'await FileSystem.mkdir(workspaceUri + "/.devcontainer")',
  )
  expect(source).toContain(
    'await FileSystem.writeFile(workspaceUri + "/.devcontainer/devcontainer.json"',
  )
  expect(source).toContain('toHaveText("devcontainer.json")')
  expect(source).toContain('"Failed open_workspace_file"')
  expect(source).toContain('"Ran search_workspace_files"')
})

test('createE2eTestSource - creates a workspace file that is read', () => {
  const source = createE2eTestSource({
    expect: {
      assistantText: 'The project uses Node.js version 24.19.0.',
      toolCalls: [
        {
          arguments: { path: '.nvmrc' },
          name: 'read_workspace_file',
          output: { content: '24.19.0\n', path: '.nvmrc' },
        },
      ],
      userText: 'What Node version is this project on?',
    },
    name: 'node-version',
    schemaVersion: 1,
    source: { text: 'What Node version is this project on?' },
    trace: [],
  })

  expect(source).toContain('await FileSystem.getTmpDir()')
  expect(source).toContain(
    'await FileSystem.writeFile(workspaceUri + "/.nvmrc", "24.19.0\\n")',
  )
  expect(source).toContain('await Workspace.setPath(workspaceUri)')
})

test('createE2eTestSource - verifies a quick pick input value', () => {
  const source = createE2eTestSource({
    expect: {
      assistantText: 'The file picker is filtered.',
      toolCalls: [
        {
          arguments: { value: 'ci.yaml' },
          name: 'set_quick_pick_value',
          output: { updated: true, value: 'ci.yaml' },
        },
      ],
      userText: 'Type ci.yaml in the file picker.',
    },
    name: 'quick-pick-input',
    schemaVersion: 1,
    source: { text: 'Type ci.yaml in the file picker.' },
    trace: [],
  })

  expect(source).toContain(
    "const quickPickInput = Locator('#QuickPick .InputBox')",
  )
  expect(source).toContain(
    'await expect(quickPickInput).toHaveValue("ci.yaml")',
  )
})
