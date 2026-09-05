import type { Test } from '@lvce-editor/test-with-playwright'

export const name = 'gpt-voice-component-state'

interface ComponentInfo {
  readonly editable: boolean
  readonly moduleId: string
  readonly uid: number
}

export const test: Test = async ({ Command, expect, Locator, SideBar }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')
  const button = Locator('.GptVoiceButton')
  await expect(button).toBeVisible()
  const components = (await Command.execute(
    'ComponentState.getComponents',
  )) as readonly ComponentInfo[]
  const component = components.find((item) => item.moduleId === 'ExtensionView')
  if (!component?.editable) {
    throw new Error('Expected editable extension component state')
  }
  const state = await Command.execute('ComponentState.getState', component.uid)
  const { messages } = state
  if (!Array.isArray(messages)) {
    throw new TypeError('Expected live voice session state')
  }
  await Command.execute('ComponentState.setState', component.uid, {
    ...state,
    tokenError: 'Inspector voice error',
  })
  const status = Locator('.GptVoiceStatus')
  await expect(status).toContainText('Inspector voice error')
  await Command.executeExtensionCommand(
    'GptVoice.addTranscript',
    'inspector-message',
    'Hello',
    'ai',
  )
  const updatedState = await Command.execute(
    'ComponentState.getState',
    component.uid,
  )
  if (
    updatedState.tokenError !== 'Inspector voice error' ||
    updatedState.messages.length !== 1
  ) {
    throw new Error('Component edits did not reach the owning voice session')
  }
}
