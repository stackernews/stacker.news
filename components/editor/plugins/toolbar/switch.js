import { useCallback, useEffect } from 'react'
import styles from '@/lib/lexical/theme/editor.module.css'
import Nav from 'react-bootstrap/Nav'
import { useToolbarState, INITIAL_FORMAT_STATE } from '@/components/editor/contexts/toolbar'
import { useEditorMode, MARKDOWN_MODE, RICH_MODE } from '@/components/editor/contexts/mode'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { createCommand, COMMAND_PRIORITY_CRITICAL } from 'lexical'

/** command to toggle between markdown and rich mode
 * @param {string} [newMode] - the new mode to switch to, if not provided, the current mode will be toggled
 * @example
 * editor.dispatchCommand(TOGGLE_MODE_COMMAND, 'markdown')
 * editor.dispatchCommand(TOGGLE_MODE_COMMAND)
 */
export const TOGGLE_MODE_COMMAND = createCommand('TOGGLE_MODE_COMMAND')

/** displays and toggles between markdown and rich mode */
export default function ModeSwitchPlugin () {
  const [editor] = useLexicalComposerContext()
  const { batchUpdateToolbarState } = useToolbarState()
  const { changeMode, toggleMode, isMarkdown } = useEditorMode()

  useEffect(() => {
    return editor.registerCommand(
      TOGGLE_MODE_COMMAND,
      (newMode) => {
        if (newMode) {
          changeMode(newMode)
        } else {
          toggleMode()
        }
        // reset rich-format state when switching mode
        batchUpdateToolbarState(INITIAL_FORMAT_STATE)
        return true
      },
      COMMAND_PRIORITY_CRITICAL
    )
  }, [editor, batchUpdateToolbarState, changeMode, toggleMode])

  const handleTabSelect = useCallback((eventKey) => {
    editor.dispatchCommand(TOGGLE_MODE_COMMAND, eventKey)
  }, [editor])

  return (
    <Nav variant='tabs' activeKey={isMarkdown ? MARKDOWN_MODE : RICH_MODE} onSelect={handleTabSelect}>
      <Nav.Item>
        <Nav.Link className={styles.modeTab} eventKey={MARKDOWN_MODE} title='markdown'>
          md
        </Nav.Link>
      </Nav.Item>
      <Nav.Item>
        <Nav.Link
          className={styles.modeTab}
          eventKey={RICH_MODE}
          title='rich text'
        >
          rich
        </Nav.Link>
      </Nav.Item>
    </Nav>
  )
}
