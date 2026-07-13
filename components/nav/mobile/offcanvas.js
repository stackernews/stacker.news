import { useMemo, useState } from 'react'
import { Nav, Navbar, Offcanvas } from 'react-bootstrap'
import Menu from '@/components/ui/menu'
import { MEDIA_URL } from '@/lib/constants'
import Link from 'next/link'
import { Indicator, LoginButtons, LogoutDropdownItem, NavWalletSummary } from '../common'
import AnonIcon from '@/svgs/spy-fill.svg'
import styles from './footer.module.css'
import canvasStyles from './offcanvas.module.css'
import classNames from 'classnames'
import { useWalletIndicator } from '@/wallets/client/hooks'

function MeImage ({ me, onClick }) {
  const src = useMemo(() => me?.photoId ? `${MEDIA_URL}/${me.photoId}` : '/dorian400.jpg', [me?.photoId])
  if (!me) {
    return <span className='text-muted pointer'><AnonIcon onClick={onClick} width='22' height='22' /></span>
  }
  return (
    <img
      src={src} width='28' height='28'
      className={canvasStyles.meimg}
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
      <Indicator show={indicator}><MeImage me={me} onClick={handleShow} /></Indicator>
      <Offcanvas className={canvasStyles.offcanvas} show={show} onHide={handleClose} placement='end'>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title><NavWalletSummary /></Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className='pb-0'>
          {/* the 4 inline Bootstrap dropdown var writes died with rb: px-0 replicates
              item-padding-x 0, the recipe's py-2/my-2 ≡ the .5rem paddings, and the
              divider-bg was already dead (globals' border-top wins — §14.6 pre-flight 8).
              Items here are plain-mode (no menu — drawer body); the eventKey items were
              never active in the drawer (no Nav context), so those props just die */}
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {me
              ? (
                <>
                  <Menu.Item className='px-0' href={'/' + me.name} active={me.name === dropNavKey}>
                    <Indicator show={profileIndicator} top='2px' right='-10px'>profile</Indicator>
                  </Menu.Item>
                  <Menu.Item className='px-0' href={'/' + me.name + '/bookmarks'} active={me.name + '/bookmarks' === dropNavKey}>bookmarks</Menu.Item>
                  <Menu.Item className='px-0' href='/wallets'>
                    <Indicator show={walletIndicator} top='2px' right='-10px'>wallets</Indicator>
                  </Menu.Item>
                  <Menu.Item className='px-0' href='/satistics'>satistics</Menu.Item>
                  <Menu.Separator />
                  <Menu.Item className='px-0' href='/invites'>invites</Menu.Item>
                  <Menu.Separator />
                  <div className='flex items-center'>
                    <Menu.Item className='px-0' href='/settings'>settings</Menu.Item>
                  </div>
                  <Menu.Separator />
                  <LogoutDropdownItem handleClose={handleClose} className='px-0' />
                </>
                )
              : <LoginButtons handleClose={handleClose} className='px-0' />}
            <div className={classNames(styles.footerPadding, 'mt-auto')}>
              <Navbar className={classNames('container flex flex-row px-0 text-muted')}>
                <Nav>
                  <Link href={`/${me?.name || 'anon'}`} className='flex flex-row p-2 mt-auto text-muted'>
                    <MeImage me={me} />
                    <div className='ms-2'>
                      <Indicator show={indicator} top='2px' right='-5px'>@{me?.name || 'anon'}</Indicator>
                    </div>
                  </Link>
                </Nav>
              </Navbar>
            </div>
          </div>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  )
}
