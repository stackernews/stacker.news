import { useCallback, useEffect } from 'react'
import styles from '@/lib/lexical/theme/editor.module.css'
import Nav from 'react-bootstrap/Nav'
import { useEditorMode, MARKDOWN_MODE, RICH_MODE } from '@/components/editor/contexts/mode'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { createCommand, COMMAND_PRIORITY_HIGH } from 'lexical'
import { isMarkdownMode } from '@/lib/lexical/commands/utils'
import { SYNC_FORMIK_COMMAND } from '@/components/editor/plugins/core/formik'
import { useFeeButton } from '@/components/fee-button'
import { UPLOAD_SUBMIT_DISABLED_REASON } from '@/components/editor/plugins/upload'
import { useToast } from '@/components/toast'

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

        editor.dispatchCommand(SYNC_FORMIK_COMMAND)

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

  const handleTabSelect = useCallback((eventKey) => {
    editor.dispatchCommand(TOGGLE_MODE_COMMAND, eventKey)
  }, [editor])

  return (
    <Nav variant='tabs' activeKey={isMarkdown ? MARKDOWN_MODE : RICH_MODE} onSelect={handleTabSelect} onMouseDown={(e) => e.preventDefault()}>
      <Nav.Item>
        <Nav.Link
          className={styles.modeTab}
          eventKey={MARKDOWN_MODE}
          title='markdown'
          disabled={isMarkdown}
        >
          write
        </Nav.Link>
      </Nav.Item>
      <Nav.Item>
        <Nav.Link
          className={styles.modeTab}
          eventKey={RICH_MODE}
          title='rich text'
          disabled={!isMarkdown}
        >
          compose
        </Nav.Link>
      </Nav.Item>
    </Nav>
  )
}
