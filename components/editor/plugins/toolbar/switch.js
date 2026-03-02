import { useCallback, useEffect } from 'react'
import styles from '@/lib/lexical/theme/editor.module.css'
import Nav from 'react-bootstrap/Nav'
import { useEditorMode, MARKDOWN_MODE, RICH_MODE } from '@/components/editor/contexts/mode'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { createCommand, COMMAND_PRIORITY_HIGH } from 'lexical'
import { useField } from 'formik'
import { isMarkdownMode } from '@/lib/lexical/commands/utils'
import { $lexicalToMarkdown } from '@/lib/lexical/utils/mdast'

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
  const [,, textHelpers] = useField({ name })
  const { changeMode, toggleMode, isMarkdown, isRich } = useEditorMode()

  useEffect(() => {
    return editor.registerCommand(
      TOGGLE_MODE_COMMAND,
      (newMode) => {
        if (!isMarkdownMode(editor)) {
          editor.getEditorState().read(() => {
            const markdown = $lexicalToMarkdown()
            textHelpers.setValue(markdown)
          })
        }
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
  }, [editor, changeMode, toggleMode, textHelpers])

  const handleTabSelect = useCallback((eventKey) => {
    editor.dispatchCommand(TOGGLE_MODE_COMMAND, eventKey)
  }, [editor])

  return (
    <Nav variant='tabs' activeKey={isMarkdown ? MARKDOWN_MODE : RICH_MODE} onSelect={handleTabSelect} onMouseDown={(e) => e.preventDefault()}>
      <Nav.Item>
        <Nav.Link className={styles.modeTab} eventKey={MARKDOWN_MODE} title='markdown'>
          {isMarkdown ? 'markdown' : 'md'}
        </Nav.Link>
      </Nav.Item>
      <Nav.Item>
        <Nav.Link
          className={styles.modeTab}
          eventKey={RICH_MODE}
          title='rich text'
        >
          {isRich ? 'rich text' : 'rich'}
        </Nav.Link>
      </Nav.Item>
    </Nav>
  )
}
