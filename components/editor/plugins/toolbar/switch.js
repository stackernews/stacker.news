import { useCallback, useEffect } from 'react'
import styles from '@/lib/lexical/theme/editor.module.css'
import { Tabs } from '@base-ui/react/tabs'
import { useEditorMode, MARKDOWN_MODE, RICH_MODE } from '@/components/editor/contexts/mode'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { createCommand, COMMAND_PRIORITY_HIGH } from 'lexical'
import { isMarkdownMode } from '@/lib/lexical/commands/utils'
import { SYNC_FORMIK_COMMAND } from '@/components/editor/plugins/core/formik'
import { useFeeButton } from '@/components/fee-button'
import { UPLOAD_SUBMIT_DISABLED_REASON } from '@/components/editor/plugins/upload'
import { useToast } from '@/components/ui/toast'

/** command to toggle between markdown and rich mode
 * @param {string} [newMode] - the new mode to switch to, if not provided, the current mode will be toggled
 * @example
 * editor.dispatchCommand(TOGGLE_MODE_COMMAND, 'markdown')
 * editor.dispatchCommand(TOGGLE_MODE_COMMAND)
 */
export const TOGGLE_MODE_COMMAND = createCommand('TOGGLE_MODE_COMMAND')

/** displays and toggles between markdown and rich mode */
export default function ModeSwitchPlugin ({ name }) {
  const [editor] = useLexicalComposerContext()
  const toaster = useToast()
  const { disabledReasons } = useFeeButton() ?? {}
  const { changeMode, toggleMode, isMarkdown } = useEditorMode()

  useEffect(() => {
    return editor.registerCommand(
      TOGGLE_MODE_COMMAND,
      (newMode) => {
        const isDisabledByUpload = disabledReasons?.has(UPLOAD_SUBMIT_DISABLED_REASON)
        if (isDisabledByUpload) {
          toaster?.warning('upload in progress, please wait')
          return false
        }

        if (newMode === (isMarkdownMode(editor) ? MARKDOWN_MODE : RICH_MODE)) return false

        editor.dispatchCommand(SYNC_FORMIK_COMMAND, { switchMode: true })

        // toggle mode
        if (newMode) {
          changeMode(newMode)
        } else {
          toggleMode()
        }
        return true
      },
      COMMAND_PRIORITY_HIGH
    )
  }, [editor, changeMode, toggleMode, disabledReasons, toaster])

  const handleTabSelect = useCallback((value) => {
    editor.dispatchCommand(TOGGLE_MODE_COMMAND, value)
  }, [editor])

  // panel-less Tabs: value is controlled by useEditorMode and only moves when the
  // TOGGLE_MODE_COMMAND handler above accepts the switch (upload guard, same-mode
  // no-op), so a refused command leaves the tabs where they are. Clicking the
  // active tab fires nothing in Tabs source, so no disabled={active} hack is needed.
  // mousedown preventDefault keeps the Lexical selection on tab click
  return (
    <Tabs.Root value={isMarkdown ? MARKDOWN_MODE : RICH_MODE} onValueChange={handleTabSelect}>
      <Tabs.List className='flex flex-nowrap' onMouseDown={(e) => e.preventDefault()}>
        <Tabs.Tab value={MARKDOWN_MODE} title='markdown' className={styles.modeTab}>write</Tabs.Tab>
        <Tabs.Tab value={RICH_MODE} title='rich text' className={styles.modeTab}>compose</Tabs.Tab>
      </Tabs.List>
    </Tabs.Root>
  )
}
