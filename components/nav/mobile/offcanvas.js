import { useMemo, useState } from 'react'
import Drawer from '@/components/ui/drawer'
import Menu, { itemClasses } from '@/components/ui/menu'
import { MEDIA_URL } from '@/lib/constants'
import { cn } from '@/lib/cn'
import Link from 'next/link'
import { Indicator, LoginButtons, LogoutDropdownItem, NavWalletSummary } from '../common'
import AnonIcon from '@/svgs/spy-fill.svg'
import styles from './footer.module.css'
import classNames from 'classnames'
import { useWalletIndicator } from '@/wallets/client/hooks'

// the drawer keeps its roomier 8px tap targets while the menu recipe
// tightened to py-1.5; the call-site py-2 out-merges the recipe's value
const drawerItemClasses = (opts = {}) =>
  itemClasses({ ...opts, className: cn('px-0 py-2', opts.className) })

function MeImage ({ me, onClick }) {
  const src = useMemo(() => me?.photoId ? `${MEDIA_URL}/${me.photoId}` : '/dorian400.jpg', [me?.photoId])
  if (!me) {
    return <span className='text-muted pointer'><AnonIcon onClick={onClick} width='22' height='22' /></span>
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
        <Drawer.Header>
          <Drawer.Title><NavWalletSummary /></Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className='pb-0'>
          {/* the six nav rows are drawerItemClasses() on plain Links,
              paint-identical to the plain-mode Menu.Items they replace;
              LoginButtons and LogoutDropdownItem stay Menu.Item dual-mode,
              shared with the corner menus. Close-on-nav needs no code, since
              navigation remounts BottomBar and show resets. handleClose still
              threads to the modal-triggering rows, modals must close the
              drawer first */}
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
                  <Menu.Separator />
                  <Link href='/invites' className={drawerItemClasses()}>invites</Link>
                  <Menu.Separator />
                  <div className='flex items-center'>
                    <Link href='/settings' className={drawerItemClasses()}>settings</Link>
                  </div>
                  <Menu.Separator />
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
        </Drawer.Body>
      </Drawer>
    </>
  )
}
