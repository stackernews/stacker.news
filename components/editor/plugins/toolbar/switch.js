import { useCallback, useEffect } from 'react'
import styles from '@/lib/lexical/theme/editor.module.css'
import Nav from 'react-bootstrap/Nav'
import { useToolbarState, INITIAL_FORMAT_STATE } from '@/components/editor/contexts/toolbar'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { createCommand, COMMAND_PRIORITY_CRITICAL } from 'lexical'

export const TOGGLE_MODE_COMMAND = createCommand('TOGGLE_MODE_COMMAND')

/** displays and toggles between markdown and rich mode */
export default function ModeSwitchPlugin () {
  const [editor] = useLexicalComposerContext()
  const { toolbarState, batchUpdateToolbarState } = useToolbarState()

  useEffect(() => {
    return editor.registerCommand(
      TOGGLE_MODE_COMMAND,
      (markdownMode) => {
        const switchedMode = markdownMode ?? !toolbarState.markdownMode
        batchUpdateToolbarState({
          markdownMode: switchedMode,
          ...(switchedMode ? INITIAL_FORMAT_STATE : {})
        })
        return true
      },
      COMMAND_PRIORITY_CRITICAL
    )
  }, [editor, batchUpdateToolbarState, toolbarState.markdownMode])

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
