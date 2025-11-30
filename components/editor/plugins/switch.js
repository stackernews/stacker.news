import { useCallback } from 'react'
import { useFormikContext } from 'formik'
import styles from '@/components/editor/theme/editor.module.css'
import Nav from 'react-bootstrap/Nav'
import { useToolbarState } from '../contexts/toolbar'

/** displays and toggles between write and preview modes */
export default function ModeSwitcherPlugin () {
  const { values } = useFormikContext()
  const { toolbarState, updateToolbarState } = useToolbarState()

  const handleTabSelect = useCallback((eventKey) => {
    updateToolbarState('previewMode', (eventKey === 'preview'))
  }, [updateToolbarState])

  return (
    <div className={styles.modeSwitcherContainer}>
      <Nav variant='tabs' activeKey={toolbarState.previewMode ? 'preview' : 'write'} onSelect={handleTabSelect}>
        <Nav.Item>
          <Nav.Link eventKey='write' title='write'>
            write
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link
            className={styles.previewTab}
            eventKey='preview'
            title='preview'
            disabled={!values.text}
          >
            preview
          </Nav.Link>
        </Nav.Item>
      </Nav>
    </div>
  )
}
