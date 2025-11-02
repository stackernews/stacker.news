import { getActions } from '@/components/lexical/universal/constants/actions'
import { getIcon } from '@/components/lexical/universal/constants/icons'

const toolbarOptions = (category) =>
  getActions(category).map(action => ({
    id: action.id,
    name: action.name,
    icon: getIcon(action.id),
    handler: ({ editor }) => {
      const commandValue = action.commandValue ?? action.id
      editor.dispatchCommand(action.command, commandValue)
    }
  }))

export function ToolbarIcon ({ id, state = 'default', ...props }) {
  const IconComponent = getIcon(id, state)
  return IconComponent ? <IconComponent {...props} /> : null
}

export const BLOCK_OPTIONS = toolbarOptions('block')
export const INLINE_OPTIONS = toolbarOptions('inline')
export const ADDITIONAL_FORMAT_OPTIONS = toolbarOptions('additional')
export const ALIGN_OPTIONS = toolbarOptions('align')
export const INDENT_OPTIONS = toolbarOptions('indent')
export const INSERT_OPTIONS = toolbarOptions('insert')
