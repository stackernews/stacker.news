import Container from 'react-bootstrap/Container'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import Popover from 'react-bootstrap/Popover'
import { CopyInput } from './form'
import styles from './footer.module.css'
import Texas from '../svgs/texas.svg'
import Github from '../svgs/github-fill.svg'
import Link from 'next/link'
import Sun from '../svgs/sun-fill.svg'
import Moon from '../svgs/moon-fill.svg'
import No from '../svgs/no.svg'
import Bolt from '../svgs/bolt.svg'
import Amboss from '../svgs/amboss.svg'
import Mempool from '../svgs/bimi.svg'
import { useEffect, useState } from 'react'
import Rewards from './footer-rewards'
import useDarkMode from './dark-mode'
import ActionTooltip from './action-tooltip'

const RssPopover = (
  <Popover>
    <Popover.Body style={{ fontWeight: 500, fontSize: '.9rem' }}>
      <div className='d-flex justify-content-center'>
        <a href='/rss' className='nav-link p-0 d-inline-flex'>
          home
        </a>
        <span className='mx-2 text-muted'> \ </span>
        <a href='/~bitcoin/rss' className='nav-link p-0 d-inline-flex'>
          bitcoin
        </a>
        <span className='mx-2 text-muted'> \ </span>
        <a href='/~nostr/rss' className='nav-link p-0 d-inline-flex'>
          nostr
        </a>
      </div>
      <div className='d-flex justify-content-center'>
        <a href='/~tech/rss' className='nav-link p-0 d-inline-flex'>
          tech
        </a>
        <span className='mx-2 text-muted'> \ </span>
        <a href='/~meta/rss' className='nav-link p-0 d-inline-flex'>
          meta
        </a>
        <span className='mx-2 text-muted'> \ </span>
        <a href='/~jobs/rss' className='nav-link p-0 d-inline-flex'>
          jobs
        </a>
      </div>
    </Popover.Body>
  </Popover>
)

const SocialsPopover = (
  <Popover>
    <Popover.Body style={{ fontWeight: 500, fontSize: '.9rem' }}>
      <a
        href='https://snort.social/p/npub1jfujw6llhq7wuvu5detycdsq5v5yqf56sgrdq8wlgrryx2a2p09svwm0gx' className='nav-link p-0 d-inline-flex'
        target='_blank' rel='noreferrer'
      >
        nostr
      </a>
      <span className='mx-2 text-muted'> \ </span>
      <a
        href='https://twitter.com/stacker_news' className='nav-link p-0 d-inline-flex'
        target='_blank' rel='noreferrer'
      >
        twitter
      </a>
      <span className='mx-2 text-muted'> \ </span>
      <a
        href='https://www.youtube.com/@stackernews' className='nav-link p-0 d-inline-flex'
        target='_blank' rel='noreferrer'
      >
        youtube
      </a>
      <span className='mx-2 text-muted'> \ </span>
      <a
        href='https://www.fountain.fm/show/Mg1AWuvkeZSFhsJZ3BW2' className='nav-link p-0 d-inline-flex'
        target='_blank' rel='noreferrer'
      >
        pod
      </a>
    </Popover.Body>
  </Popover>
)

const ChatPopover = (
  <Popover>
    <Popover.Body style={{ fontWeight: 500, fontSize: '.9rem' }}>
      <a
        href='https://tribes.sphinx.chat/t/stackerzchat' className='nav-link p-0 d-inline-flex'
        target='_blank' rel='noreferrer'
      >
        sphinx
      </a>
      <span className='mx-2 text-muted'> \ </span>
      <a
        href='https://t.me/stackernews' className='nav-link p-0 d-inline-flex'
        target='_blank' rel='noreferrer'
      >
        telegram
      </a>
      <span className='mx-2 text-muted'> \ </span>
      <a
        href='https://simplex.chat/contact#/?v=1-2&smp=smp%3A%2F%2F6iIcWT_dF2zN_w5xzZEY7HI2Prbh3ldP07YTyDexPjE%3D%40smp10.simplex.im%2FebLYaEFGjsD3uK4fpE326c5QI1RZSxau%23%2F%3Fv%3D1-2%26dh%3DMCowBQYDK2VuAyEAV086Oj5yCsavWzIbRMCVuF6jq793Tt__rWvCec__viI%253D%26srv%3Drb2pbttocvnbrngnwziclp2f4ckjq65kebafws6g4hy22cdaiv5dwjqd.onion&data=%7B%22type%22%3A%22group%22%2C%22groupLinkId%22%3A%22cZwSGoQhyOUulzp7rwCdWQ%3D%3D%22%7D' className='nav-link p-0 d-inline-flex'
        target='_blank' rel='noreferrer'
      >
        simplex
      </a>
    </Popover.Body>
  </Popover>
)

const LegalPopover = (
  <Popover>
    <Popover.Body style={{ fontWeight: 500, fontSize: '.9rem' }}>
      <div className='d-flex justify-content-center'>
        <Link href='/tos' className='nav-link p-0 d-inline-flex'>
          terms of service
        </Link>
        <span className='mx-2 text-muted'> \ </span>
        <Link href='/privacy' className='nav-link p-0 d-inline-flex'>
          privacy policy
        </Link>
      </div>
      <div className='d-flex justify-content-center'>
        <Link href='/copyright' className='nav-link p-0 d-inline-flex'>
          copyright policy
        </Link>
      </div>
    </Popover.Body>
  </Popover>
)

export default function Footer ({ links = true }) {
  const [darkMode, darkModeToggle] = useDarkMode()

  const [lightning, setLightning] = useState(undefined)

  useEffect(() => {
    setLightning(window.localStorage.getItem('lnAnimate') || 'yes')
  }, [])

  const toggleLightning = () => {
    if (lightning === 'yes') {
      window.localStorage.setItem('lnAnimate', 'no')
      setLightning('no')
    } else {
      window.localStorage.setItem('lnAnimate', 'yes')
      setLightning('yes')
    }
  }

  const DarkModeIcon = darkMode ? Sun : Moon
  const LnIcon = lightning === 'yes' ? No : Bolt

  const version = process.env.NEXT_PUBLIC_COMMIT_HASH

  return (
    <footer>
      <Container className='mb-3 mt-4'>
        {links &&
          <>
            <div className='mb-1'>
              <ActionTooltip notForm overlayText={`${darkMode ? 'disable' : 'enable'} dark mode`}>
                <DarkModeIcon onClick={darkModeToggle} width={20} height={20} className='fill-grey theme' suppressHydrationWarning />
              </ActionTooltip>
              <ActionTooltip notForm overlayText={`${lightning === 'yes' ? 'disable' : 'enable'} lightning animations`}>
                <LnIcon onClick={toggleLightning} width={20} height={20} className='ms-2 fill-grey theme' suppressHydrationWarning />
              </ActionTooltip>
            </div>
            <div className='mb-0' style={{ fontWeight: 500 }}>
              <Rewards />
            </div>
            <div className='mb-0' style={{ fontWeight: 500 }}>
              <Link href='/stackers/day' className='nav-link p-0 p-0 d-inline-flex'>
                analytics
              </Link>
              <span className='mx-2 text-muted'> \ </span>
              <OverlayTrigger trigger='click' placement='top' overlay={ChatPopover} rootClose>
                <div className='nav-link p-0 p-0 d-inline-flex' style={{ cursor: 'pointer' }}>
                  chat
                </div>
              </OverlayTrigger>
              <span className='mx-2 text-muted'> \ </span>
              <OverlayTrigger trigger='click' placement='top' overlay={SocialsPopover} rootClose>
                <div className='nav-link p-0 p-0 d-inline-flex' style={{ cursor: 'pointer' }}>
                  socials
                </div>
              </OverlayTrigger>
              <span className='mx-2 text-muted'> \ </span>
              <OverlayTrigger trigger='click' placement='top' overlay={RssPopover} rootClose>
                <div className='nav-link p-0 p-0 d-inline-flex' style={{ cursor: 'pointer' }}>
                  rss
                </div>
              </OverlayTrigger>
            </div>
            <div className='mb-2' style={{ fontWeight: 500 }}>
              <Link href='/faq' className='nav-link p-0 p-0 d-inline-flex'>
                faq
              </Link>
              <span className='mx-2 text-muted'> \ </span>
              <Link href='/guide' className='nav-link p-0 p-0 d-inline-flex'>
                guide
              </Link>
              <span className='mx-2 text-muted'> \ </span>
              <Link href='/story' className='nav-link p-0 p-0 d-inline-flex'>
                story
              </Link>
              <span className='mx-2 text-muted'> \ </span>
              <Link href='/changes' className='nav-link p-0 p-0 d-inline-flex'>
                changes
              </Link>
              <span className='mx-2 text-muted'> \ </span>
              <OverlayTrigger trigger='click' placement='top' overlay={LegalPopover} rootClose>
                <div className='nav-link p-0 p-0 d-inline-flex' style={{ cursor: 'pointer' }}>
                  legal
                </div>
              </OverlayTrigger>
            </div>
          </>}
        {process.env.NEXT_PUBLIC_LND_CONNECT_ADDRESS &&
          <div
            className={`text-small mx-auto mb-2 ${styles.connect}`}
          >
            <small className='nav-item text-muted me-2'>connect:</small>
            <CopyInput
              size='sm'
              groupClassName='mb-0 w-100'
              readOnly
              noForm
              placeholder={process.env.NEXT_PUBLIC_LND_CONNECT_ADDRESS}
            />
            <a
              href='https://amboss.space/node/03cc1d0932bb99b0697f5b5e5961b83ab7fd66f1efc4c9f5c7bad66c1bcbe78f02'
              target='_blank' rel='noreferrer'
            >
              <Amboss className='ms-2 theme' width={20} height={20} />
            </a>
            <a
              href='https://mempool.space/lightning/node/03cc1d0932bb99b0697f5b5e5961b83ab7fd66f1efc4c9f5c7bad66c1bcbe78f02'
              target='_blank' rel='noreferrer'
            >
              <Mempool className='ms-2' width={20} height={20} />
            </a>
          </div>}
        <small className='d-flex justify-content-center align-items-center text-muted flex-wrap'>
          <a className={`${styles.contrastLink} d-flex align-items-center`} href='https://github.com/stackernews/stacker.news' target='_blank' rel='noreferrer'>
            FOSS <Github width={20} height={20} className='mx-1' />
          </a>
          made in Austin<Texas className='ms-1' width={20} height={20} />
          <span className='ms-1'>by</span>
          <span>
            <Link href='/k00b' className='ms-1'>
              @k00b
            </Link>
            <Link href='/kr' className='ms-1'>
              @kr
            </Link>
            <Link href='/ekzyis' className='ms-1'>
              @ekzyis
            </Link>
            <span className='ms-1'>&</span>
            <Link href='https://github.com/stackernews/stacker.news/graphs/contributors' className='ms-1' target='_blank' rel='noreferrer'>
              more
            </Link>
          </span>
        </small>
        {version &&
          <div className={styles.version}>
            running <a className='text-reset' href={`https://github.com/stackernews/stacker.news/commit/${version}`} target='_blank' rel='noreferrer'>{version}</a>
          </div>}
      </Container>
    </footer>
  )
}
