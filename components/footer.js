import { useQuery } from '@apollo/client'
import gql from 'graphql-tag'
import { Container, OverlayTrigger, Popover } from 'react-bootstrap'
import { CopyInput } from './form'
import styles from './footer.module.css'
import Texas from '../svgs/texas.svg'
import Github from '../svgs/github-fill.svg'
import Twitter from '../svgs/twitter-fill.svg'
import Link from 'next/link'
import useDarkMode from 'use-dark-mode'
import Sun from '../svgs/sun-fill.svg'
import Moon from '../svgs/moon-fill.svg'
import No from '../svgs/no.svg'
import Bolt from '../svgs/bolt.svg'
import { useEffect, useState } from 'react'

// XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
// if you update this you need to update /public/darkmode
// XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
const COLORS = {
  light: {
    body: '#f5f5f5',
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

const ChatPopover = (
  <Popover>
    <Popover.Content style={{ fontWeight: 500, fontSize: '.9rem' }}>
      <a
        href='https://tribes.sphinx.chat/t/stackerzchat' className='text-dark d-inline-flex'
        target='_blank' rel='noreferrer'
      >
        sphinx
      </a>
      <span className='mx-2 text-dark'> \ </span>
      <a
        href='https://t.me/stackernews' className='text-dark d-inline-flex'
        target='_blank' rel='noreferrer'
      >
        telegram
      </a>
    </Popover.Content>
  </Popover>
)

const AnalyticsPopover = (
  <Popover>
    <Popover.Content style={{ fontWeight: 500, fontSize: '.9rem' }}>
      <a
        href='https://plausible.io/stacker.news' className='text-dark d-inline-flex'
        target='_blank' rel='noreferrer'
      >
        visitors
      </a>
      <span className='mx-2 text-dark'> \ </span>
      <Link href='/users/day' passHref>
        <a className='text-dark d-inline-flex'>
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

  return (
    <footer>
      <Container className='mb-3 mt-4'>
        {!noLinks &&
          <>
            {mounted &&
              <div className='mb-2'>
                <DarkModeIcon onClick={() => darkMode.toggle()} className='fill-grey theme' />
                <LnIcon onClick={toggleLightning} width={24} height={24} className='ml-2 fill-grey theme' />
              </div>}
            <div className='mb-0' style={{ fontWeight: 500 }}>
              <Link href='/rewards' passHref>
                <a className='nav-link p-0 d-inline-flex'>
                  rewards
                </a>
              </Link>
            </div>
            <div className='mb-0' style={{ fontWeight: 500 }}>
              <OverlayTrigger trigger='click' placement='top' overlay={AnalyticsPopover} rootClose>
                <div className='nav-link p-0 d-inline-flex' style={{ cursor: 'pointer' }}>
                  analytics
                </div>
              </OverlayTrigger>
              <span className='mx-2 text-muted'> \ </span>
              <OverlayTrigger trigger='click' placement='top' overlay={ChatPopover} rootClose>
                <div className='nav-link p-0 d-inline-flex' style={{ cursor: 'pointer' }}>
                  chat
                </div>
              </OverlayTrigger>
              <span className='mx-2 text-muted'> \ </span>
              <a href='/rss' className='nav-link p-0 d-inline-flex' target='_blank'>
                rss
              </a>
            </div>
            <div className='mb-2' style={{ fontWeight: 500 }}>
              <Link href='/faq' passHref>
                <a className='nav-link p-0 d-inline-flex'>
                  faq
                </a>
              </Link>
              <span className='mx-2 text-muted'> \ </span>
              <Link href='/guide' passHref>
                <a className='nav-link p-0 d-inline-flex'>
                  guide
                </a>
              </Link>
              <span className='mx-2 text-muted'> \ </span>
              <Link href='/story' passHref>
                <a className='nav-link p-0 d-inline-flex'>
                  story
                </a>
              </Link>
              <span className='mx-2 text-muted'> \ </span>
              <Link href='/changes' passHref>
                <a className='nav-link p-0 d-inline-flex'>
                  changes
                </a>
              </Link>
              <span className='mx-2 text-muted'> \ </span>
              <Link href='/privacy' passHref>
                <a className='nav-link p-0 d-inline-flex'>
                  privacy
                </a>
              </Link>
            </div>
          </>}
        {data &&
          <div
            className={`text-small mx-auto mb-1 ${styles.connect}`}
          >
            <span className='nav-item text-muted mr-2'>connect:</span>
            <CopyInput
              size='sm'
              groupClassName='mb-0 w-100'
              readOnly
              noForm
              placeholder={data.connectAddress}
            />
          </div>}
        <small>
          <a className={`d-inline-block ${styles.contrastLink}`} href='https://github.com/stackernews/stacker.news' target='_blank' rel='noreferrer'>
            This is free open source software<Github width={20} height={20} className='mx-1' />
          </a>
          <span className='d-inline-block text-muted'>
            made with sound love in Austin<Texas className='mx-1' width={20} height={20} />
            by<a href='https://twitter.com/k00bideh' target='_blank' rel='noreferrer' className='text-twitter d-inline-block'><Twitter width={20} height={20} className='ml-1' />@k00bideh</a>
          </span>
        </small>
      </Container>
    </footer>
  )
}
