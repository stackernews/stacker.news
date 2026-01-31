import { useCallback } from 'react'
import styles from '@/lib/lexical/theme/editor.module.css'
import Nav from 'react-bootstrap/Nav'
import { useToolbarState } from '@/components/editor/contexts/toolbar'

/** displays and toggles between write and preview modes */
export default function ModeSwitchPlugin () {
  const { toolbarState, updateToolbarState } = useToolbarState()

  const handleTabSelect = useCallback((eventKey) => {
    updateToolbarState('editorMode', eventKey)
  }, [updateToolbarState])

  return (
    <Nav variant='tabs' activeKey={toolbarState.editorMode} onSelect={handleTabSelect}>
      <Nav.Item>
        <Nav.Link className={styles.modeTab} eventKey='markdown' title='markdown'>
          markdown
        </Nav.Link>
      </Nav.Item>
      <Nav.Item>
        <Nav.Link className={styles.modeTab} eventKey='rich' title='rich'>
          rich
        </Nav.Link>
      </Nav.Item>
    </Nav>
  )
}
