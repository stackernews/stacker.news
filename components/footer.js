import { useQuery } from '@apollo/client'
import gql from 'graphql-tag'
import { Container, OverlayTrigger, Popover } from 'react-bootstrap'
import { CopyInput } from './form'
import styles from './footer.module.css'
import Texas from '../svgs/texas.svg'
import Github from '../svgs/github-fill.svg'
import Link from 'next/link'
import useDarkMode from 'use-dark-mode'
import Sun from '../svgs/sun-fill.svg'
import Moon from '../svgs/moon-fill.svg'
import No from '../svgs/no.svg'
import Bolt from '../svgs/bolt.svg'
import Amboss from '../svgs/amboss.svg'
import { useEffect, useState } from 'react'

// XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
// if you update this you need to update /public/darkmode
// XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
const COLORS = {
  light: {
    body: '#f5f5f7',
    color: '#212529',
    navbarVariant: 'light',
    navLink: 'rgba(0, 0, 0, 0.55)',
    navLinkFocus: 'rgba(0, 0, 0, 0.7)',
    navLinkActive: 'rgba(0, 0, 0, 0.9)',
    borderColor: '#ced4da',
    inputBg: '#ffffff',
    inputDisabledBg: '#e9ecef',
    dropdownItemColor: 'rgba(0, 0, 0, 0.7)',
    dropdownItemColorHover: 'rgba(0, 0, 0, 0.9)',
    commentBg: 'rgba(0, 0, 0, 0.03)',
    clickToContextColor: 'rgba(0, 0, 0, 0.07)',
    brandColor: 'rgba(0, 0, 0, 0.9)',
    grey: '#707070',
    link: '#007cbe',
    toolbarActive: 'rgba(0, 0, 0, 0.10)',
    toolbarHover: 'rgba(0, 0, 0, 0.20)',
    toolbar: '#ffffff',
    quoteBar: 'rgb(206, 208, 212)',
    quoteColor: 'rgb(101, 103, 107)',
    linkHover: '#004a72',
    linkVisited: '#537587'
  },
  dark: {
    body: '#000000',
    inputBg: '#000000',
    inputDisabledBg: '#000000',
    navLink: 'rgba(255, 255, 255, 0.55)',
    navLinkFocus: 'rgba(255, 255, 255, 0.75)',
    navLinkActive: 'rgba(255, 255, 255, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.5)',
    dropdownItemColor: 'rgba(255, 255, 255, 0.7)',
    dropdownItemColorHover: 'rgba(255, 255, 255, 0.9)',
    commentBg: 'rgba(255, 255, 255, 0.04)',
    clickToContextColor: 'rgba(255, 255, 255, 0.2)',
    color: '#f8f9fa',
    brandColor: 'var(--primary)',
    grey: '#969696',
    link: '#2e99d1',
    toolbarActive: 'rgba(255, 255, 255, 0.10)',
    toolbarHover: 'rgba(255, 255, 255, 0.20)',
    toolbar: '#3e3f3f',
    quoteBar: 'rgb(158, 159, 163)',
    quoteColor: 'rgb(141, 144, 150)',
    linkHover: '#007cbe',
    linkVisited: '#56798E'
  }
}

const handleThemeChange = (dark) => {
  const root = window.document.documentElement
  const colors = COLORS[dark ? 'dark' : 'light']
  Object.entries(colors).forEach(([varName, value]) => {
    const cssVarName = `--theme-${varName}`
    root.style.setProperty(cssVarName, value)
  })
}

const RssPopover = (
  <Popover>
    <Popover.Content style={{ fontWeight: 500, fontSize: '.9rem' }}>
      <div className='d-flex justify-content-center'>
        <a href='/rss' className='nav-link p-0 d-inline-flex'>
          home
        </a>
        <span className='mx-2 text-muted'> \ </span>
        <a href='/~bitcoin/rss' className='nav-link p-0 d-inline-flex'>
          bitcoin
        </a>
      </div>
      <div className='d-flex justify-content-center'>
        <a href='/~nostr/rss' className='nav-link p-0 d-inline-flex'>
          nostr
        </a>
        <span className='mx-2 text-muted'> \ </span>
        <a href='/~tech/rss' className='nav-link p-0 d-inline-flex'>
          tech
        </a>
        <span className='mx-2 text-muted'> \ </span>
        <a href='/~jobs/rss' className='nav-link p-0 d-inline-flex'>
          jobs
        </a>
      </div>
    </Popover.Content>
  </Popover>
)

const SocialsPopover = (
  <Popover>
    <Popover.Content style={{ fontWeight: 500, fontSize: '.9rem' }}>
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
    </Popover.Content>
  </Popover>
)

const ChatPopover = (
  <Popover>
    <Popover.Content style={{ fontWeight: 500, fontSize: '.9rem' }}>
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
    </Popover.Content>
  </Popover>
)

const AnalyticsPopover = (
  <Popover>
    <Popover.Content style={{ fontWeight: 500, fontSize: '.9rem' }}>
      <a
        href='https://plausible.io/stacker.news' className='nav-link p-0 d-inline-flex'
        target='_blank' rel='noreferrer'
      >
        visitors
      </a>
      <span className='mx-2 text-muted'> \ </span>
      <Link href='/users/day' passHref>
        <a className='nav-link p-0 d-inline-flex'>
          users
        </a>
      </Link>
    </Popover.Content>
  </Popover>
)

export default function Footer ({ noLinks }) {
  const query = gql`
    {
      connectAddress
    }
  `
  const { data } = useQuery(query, { fetchPolicy: 'cache-first' })

  const darkMode = useDarkMode(false, {
    // set this so it doesn't try to use classes
    onChange: handleThemeChange
  })

  const [mounted, setMounted] = useState()
  const [lightning, setLightning] = useState(undefined)

  useEffect(() => {
    setMounted(true)
    setLightning(localStorage.getItem('lnAnimate') || 'yes')
  }, [])

  const toggleLightning = () => {
    if (lightning === 'yes') {
      localStorage.setItem('lnAnimate', 'no')
      setLightning('no')
    } else {
      localStorage.setItem('lnAnimate', 'yes')
      setLightning('yes')
    }
  }

  const DarkModeIcon = darkMode.value ? Sun : Moon
  const LnIcon = lightning === 'yes' ? No : Bolt

  const version = process.env.NEXT_PUBLIC_COMMIT_HASH

  return (
    <footer>
      <Container className='mb-3 mt-4'>
        {!noLinks &&
          <>
            {mounted &&
              <div className='mb-1'>
                <DarkModeIcon onClick={() => darkMode.toggle()} width={20} height={20} className='fill-grey theme' />
                <LnIcon onClick={toggleLightning} width={20} height={20} className='ml-2 fill-grey theme' />
              </div>}
            <div className='mb-0' style={{ fontWeight: 500 }}>
              <Link href='/rewards' passHref>
                <a className='nav-link p-0 p-0 d-inline-flex'>
                  rewards
                </a>
              </Link>
            </div>
            <div className='mb-0' style={{ fontWeight: 500 }}>
              <OverlayTrigger trigger='click' placement='top' overlay={AnalyticsPopover} rootClose>
                <div className='nav-link p-0 p-0 d-inline-flex' style={{ cursor: 'pointer' }}>
                  analytics
                </div>
              </OverlayTrigger>
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
              <Link href='/faq' passHref>
                <a className='nav-link p-0 p-0 d-inline-flex'>
                  faq
                </a>
              </Link>
              <span className='mx-2 text-muted'> \ </span>
              <Link href='/guide' passHref>
                <a className='nav-link p-0 p-0 d-inline-flex'>
                  guide
                </a>
              </Link>
              <span className='mx-2 text-muted'> \ </span>
              <Link href='/story' passHref>
                <a className='nav-link p-0 p-0 d-inline-flex'>
                  story
                </a>
              </Link>
              <span className='mx-2 text-muted'> \ </span>
              <Link href='/changes' passHref>
                <a className='nav-link p-0 p-0 d-inline-flex'>
                  changes
                </a>
              </Link>
              <span className='mx-2 text-muted'> \ </span>
              <Link href='/privacy' passHref>
                <a className='nav-link p-0 p-0 d-inline-flex'>
                  privacy
                </a>
              </Link>
            </div>
          </>}
        {data &&
          <div
            className={`text-small mx-auto mb-2 ${styles.connect}`}
          >
            <span className='nav-item text-muted mr-2'>connect:</span>
            <CopyInput
              size='sm'
              groupClassName='mb-0 w-100'
              readOnly
              noForm
              placeholder={data.connectAddress}
            />
            <a
              href='https://amboss.space/node/03cc1d0932bb99b0697f5b5e5961b83ab7fd66f1efc4c9f5c7bad66c1bcbe78f02'
              target='_blank' rel='noreferrer'
            >
              <Amboss className='ml-2 theme' width={20} height={20} />
            </a>
          </div>}
        <small className='d-flex justify-content-center align-items-center text-muted flex-wrap'>
          <a className={`${styles.contrastLink} d-flex align-items-center`} href='https://github.com/stackernews/stacker.news' target='_blank' rel='noreferrer'>
            FOSS <Github width={20} height={20} className='mx-1' />
          </a>
          made in Austin<Texas className='ml-1' width={20} height={20} />
          <span className='ml-1'>by</span>
          <span>
            <Link href='/k00b' passHref>
              <a className='ml-1'>@k00b</a>
            </Link>
            <Link href='/kr' passHref>
              <a className='ml-1'>@kr</a>
            </Link>
            <Link href='/ekzyis' passHref>
              <a className='ml-1'>@ekzyis</a>
            </Link>
          </span>
        </small>
        {version &&
          <div className={styles.version}>
            running <a className='text-reset' href={`https://github.com/stackernews/stacker.news/commit/${version}`}>{version}</a>
          </div>}
      </Container>
    </footer>
  )
}
