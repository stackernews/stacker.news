import { Navbar, NavLink } from '@/components/ui/nav'
import { Brand, NavNotifications, PostItem } from '../common'
import WalletIcon from '@/svgs/wallet-fill.svg'
import { useMe } from '../../me'
import styles from './footer.module.css'
import classNames from 'classnames'
import Offcanvas from './offcanvas'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { usePrefix, useNavKeys } from '../../territory-domains'

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
  const prefix = usePrefix(sub)
  const { dropNavKey } = useNavKeys(router.asPath)

  if (isKeyboardOpen) {
    return null
  }

  return (
    <nav data-sn-navigation className='block md:hidden'>
      <div style={{ marginBottom: '53px' }} className={styles.footerPadding} />
      <div className={classNames(styles.footer, styles.footerPadding)}>
        <Navbar className='w-full px-safe'>
          <div className={styles.footerNav}>
            <Brand />
            <NavLink href='/wallets' eventKey='wallets' aria-label='wallets'>
              <WalletIcon width={22} height={28} aria-hidden />
            </NavLink>
            <PostItem prefix={prefix} size='sm' />
            <NavNotifications />
            <Offcanvas me={me} dropNavKey={dropNavKey} />
          </div>
        </Navbar>
      </div>
    </nav>
  )
}
