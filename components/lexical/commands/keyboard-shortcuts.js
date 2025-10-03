import { TOGGLE_MODE_COMMAND } from '../plugins/mode/switch'

const TOGGLE_MODE_SHORTCUT = {
  combo: 'mod+shift+m',
  handler: ({ editor }) => {
    editor.dispatchCommand(TOGGLE_MODE_COMMAND)
  }
}

export const SHORTCUTS = [
  TOGGLE_MODE_SHORTCUT
]
