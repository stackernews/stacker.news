import { getActionsByToolbarSection } from '@/components/lexical/universal/constants/actions'
import { getIcon } from '@/components/lexical/universal/constants/icons'

const toolbarSectionOptions = (section) =>
  getActionsByToolbarSection(section).map(action => ({
    id: action.id,
    name: action.name,
    category: action.category,
    lookup: action.lookup,
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

export const BLOCK_OPTIONS = toolbarSectionOptions('block-dropdown')
export const ALIGN_OPTIONS = toolbarSectionOptions('align-dropdown')
export const MAIN_TOOLBAR_OPTIONS = toolbarSectionOptions('main')
export const ADDITIONAL_FORMAT_OPTIONS = toolbarSectionOptions('additional')
export const INSERT_OPTIONS = toolbarSectionOptions('insert-dropdown')
