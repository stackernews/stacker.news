import { useCallback, useEffect } from 'react'
import styles from '@/lib/lexical/theme/editor.module.css'
import Nav from 'react-bootstrap/Nav'
import { useToolbarState } from '@/components/editor/contexts/toolbar'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { createCommand, COMMAND_PRIORITY_CRITICAL } from 'lexical'

export const TOGGLE_MODE_COMMAND = createCommand('TOGGLE_MODE_COMMAND')

/** displays and toggles between markdown and rich mode */
export default function ModeSwitchPlugin () {
  const [editor] = useLexicalComposerContext()
  const { toolbarState, updateToolbarState } = useToolbarState()

  useEffect(() => {
    return editor.registerCommand(
      TOGGLE_MODE_COMMAND,
      (markdownMode) => {
        updateToolbarState('markdownMode', markdownMode ?? !toolbarState.markdownMode)
        return true
      },
      COMMAND_PRIORITY_CRITICAL
    )
  }, [editor, updateToolbarState, toolbarState.markdownMode])

  const handleTabSelect = useCallback((eventKey) => {
    editor.dispatchCommand(TOGGLE_MODE_COMMAND, eventKey === 'markdown')
  }, [editor])

  return (
    <Nav variant='tabs' activeKey={toolbarState.markdownMode ? 'markdown' : 'rich'} onSelect={handleTabSelect}>
      <Nav.Item>
        <Nav.Link className={styles.modeTab} eventKey='markdown' title='markdown'>
          md
        </Nav.Link>
      </Nav.Item>
      <Nav.Item>
        <Nav.Link
          className={styles.modeTab}
          eventKey='rich'
          title='rich text'
        >
          rich
        </Nav.Link>
      </Nav.Item>
    </Nav>
  )
}
