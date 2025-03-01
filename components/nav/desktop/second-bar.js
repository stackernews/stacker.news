import { Nav, Navbar } from 'react-bootstrap'
import { NavSelect, PostItem, Sorts, hasNavSelect, MultiNavSelect } from '../common'
import styles from '../../header.module.css'
import { useState, useEffect } from 'react'
import AddIcon from '@/svgs/add-fill.svg'

export default function SecondBar (props) {
  const { prefix, topNavKey, sub } = props
  const [showMultiSelect, setShowMultiSelect] = useState(false)

  useEffect(() => {
    if (!sub) {
      setShowMultiSelect(false)
    }
  }, [sub])

  if (!hasNavSelect(props)) return null
  return (
    <Navbar className='pt-0 pb-2 d-flex flex-column align-items-start'>
      <Nav
        className={styles.navbarNav}
        activeKey={topNavKey}
      >
        <NavSelect sub={sub} size='medium' className='me-1' />
        {sub && <span className='ms-1 pointer' onClick={() => setShowMultiSelect(!showMultiSelect)}><AddIcon /></span>}
        <div className='ms-2 d-flex'><Sorts {...props} className='ms-1' /></div>
        <PostItem className='ms-auto me-0 d-none d-md-flex' prefix={prefix} />
      </Nav>
      {showMultiSelect && <MultiNavSelect subs={sub} size='large' className='me-1 w-100' />}
    </Navbar>
  )
}
