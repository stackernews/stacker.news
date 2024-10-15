import { Nav, Navbar } from 'react-bootstrap'
import { Brand, NavNotifications, PostItem, SearchItem } from '../common'
import { useMe } from '../../me'
import styles from './footer.module.css'
import classNames from 'classnames'
import Offcanvas from './offcanvas'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

function useDetectKeyboardOpen (minKeyboardHeight = 300, defaultValue) {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(defaultValue)

  useEffect(() => {
    const listener = () => {
      const newState = window.innerHeight - minKeyboardHeight > window.visualViewport.height
      setIsKeyboardOpen(newState)
    }
    if (typeof visualViewport !== 'undefined') {
      window.visualViewport.addEventListener('resize', listener)
    }
    return () => {
      if (typeof visualViewport !== 'undefined') {
        window.visualViewport.removeEventListener('resize', listener)
      }
    }
  }, [setIsKeyboardOpen, minKeyboardHeight])

  return isKeyboardOpen
}

export default function BottomBar ({ sub }) {
  const router = useRouter()
  const { me } = useMe()
  const isKeyboardOpen = useDetectKeyboardOpen(200, false)

  if (isKeyboardOpen) {
    return null
  }

  const path = router.asPath.split('?')[0]
  const props = {
    prefix: sub ? `/~${sub}` : '',
    path,
    topNavKey: path.split('/')[sub ? 2 : 1] ?? '',
    dropNavKey: path.split('/').slice(sub ? 2 : 1).join('/'),
    sub
  }

  return (
    <nav className='d-block d-md-none'>
      <div style={{ marginBottom: '53px' }} className={styles.footerPadding} />
      <div className={classNames(styles.footer, styles.footerPadding)}>
        <Navbar className='container px-0'>
          <Nav className={styles.footerNav}>
            <Brand />
            <SearchItem {...props} />
            <PostItem {...props} className='btn-sm' />
            <NavNotifications />
            <Offcanvas me={me} {...props} />
          </Nav>
        </Navbar>
      </div>
    </nav>
  )
}
