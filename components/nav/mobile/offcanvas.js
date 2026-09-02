import { useMemo, useState } from 'react'
import { Drawer, DrawerHeader, DrawerTitle, DrawerBody } from '@/components/ui/drawer'
import { MenuSeparator, itemClasses } from '@/components/ui/menu'
import { MEDIA_URL } from '@/lib/constants'
import { cn } from '@/lib/cn'
import Link from 'next/link'
import { Indicator, LoginButtons, LogoutDropdownItem, NavWalletSummary } from '../common'
import AnonIcon from '@/svgs/spy-fill.svg'
import styles from './footer.module.css'
import classNames from 'classnames'
import { useWalletIndicator } from '@/wallets/client/hooks'

// drawer rows keep roomier tap targets than menu items
const drawerItemClasses = (opts = {}) =>
  itemClasses({ ...opts, className: cn('px-0 py-2', opts.className) })

function MeImage ({ me, onClick }) {
  const src = useMemo(() => me?.photoId ? `${MEDIA_URL}/${me.photoId}` : '/dorian400.jpg', [me?.photoId])
  if (!me) {
    return <span className='text-muted pointer'><AnonIcon onClick={onClick} width='22' height='22' className='fill-current' /></span>
  }
  return (
    <img
      src={src} width='28' height='28'
      className={styles.meimg}
      onClick={onClick}
    />
  )
}

export default function OffCanvas ({ me, dropNavKey }) {
  const [show, setShow] = useState(false)

  const handleClose = () => setShow(false)
  const handleShow = () => setShow(true)

  const profileIndicator = me && !me.bioId
  const walletIndicator = useWalletIndicator()
  const indicator = profileIndicator || walletIndicator

  return (
    <>
      <Indicator show={indicator}>
        <button
          type='button'
          className='bg-transparent border-0 p-0 pointer'
          aria-label='open profile menu'
          onClick={handleShow}
        >
          <MeImage me={me} />
        </button>
      </Indicator>
      <Drawer show={show} onHide={handleClose} placement='end'>
        <DrawerHeader>
          <DrawerTitle><NavWalletSummary /></DrawerTitle>
        </DrawerHeader>
        <DrawerBody className='pb-0'>
          {/* navigation remounts BottomBar so the drawer closes on its own, but rows that open a modal must close it first */}
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {me
              ? (
                <>
                  <Link href={'/' + me.name} className={drawerItemClasses({ active: me.name === dropNavKey })}>
                    <Indicator show={profileIndicator} top='2px' right='-10px'>profile</Indicator>
                  </Link>
                  <Link href={'/' + me.name + '/bookmarks'} className={drawerItemClasses({ active: me.name + '/bookmarks' === dropNavKey })}>bookmarks</Link>
                  <Link href='/wallets' className={drawerItemClasses()}>
                    <Indicator show={walletIndicator} top='2px' right='-10px'>wallets</Indicator>
                  </Link>
                  <Link href='/satistics' className={drawerItemClasses()}>satistics</Link>
                  <MenuSeparator />
                  <Link href='/invites' className={drawerItemClasses()}>invites</Link>
                  <MenuSeparator />
                  <div className='flex items-center'>
                    <Link href='/settings' className={drawerItemClasses()}>settings</Link>
                  </div>
                  <MenuSeparator />
                  <LogoutDropdownItem handleClose={handleClose} className='px-0 py-2' />
                </>
                )
              : <LoginButtons handleClose={handleClose} className='px-0 py-2' />}
            <div className={classNames(styles.footerPadding, 'mt-auto')}>
              <div className='w-full flex flex-row items-center py-2 px-0 text-muted'>
                <div>
                  <Link href={`/${me?.name || 'anon'}`} className='flex flex-row p-2 mt-auto text-muted'>
                    <MeImage me={me} />
                    <div className='ms-2'>
                      <Indicator show={indicator} top='2px' right='-5px'>@{me?.name || 'anon'}</Indicator>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </DrawerBody>
      </Drawer>
    </>
  )
}
