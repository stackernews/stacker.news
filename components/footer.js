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
import styled from 'styled-components'
import Sun from '../svgs/sun-fill.svg'
import Moon from '../svgs/moon-fill.svg'

const ChatPopover = (
  <Popover>
    <Popover.Content style={{ fontWeight: 500, opacity: 0.5, fontSize: '.9rem' }}>
      <a
        href='https://tribes.sphinx.chat/t/stackerzchat' className='text-reset d-inline-flex'
        target='_blank' rel='noreferrer'
      >
        sphinx
      </a>
      <span className='mx-2'> \ </span>
      <a
        href='https://t.me/stackernews' className='text-reset d-inline-flex'
        target='_blank' rel='noreferrer'
      >
        telegram
      </a>
    </Popover.Content>
  </Popover>
)

const ContrastLink = styled.a`
  color: ${({ theme }) => theme.color};
  &:hover {
    color: ${({ theme }) => theme.color};
  }
  & svg {
    fill: ${({ theme }) => theme.color};
  }
`

export default function Footer ({ noLinks }) {
  const query = gql`
    {
      connectAddress
    }
  `

  const { data } = useQuery(query, { fetchPolicy: 'cache-first' })

  const darkMode = useDarkMode(false, {
    // set this so it doesn't try to use classes
    onChange: () => { }
  })

  return (
    <footer>
      <Container className='mb-3 mt-4'>
        {!noLinks &&
          <div className='mb-2' style={{ fontWeight: 500, opacity: 0.5 }}>
            <div className='mb-2'>
              {darkMode.value
                ? <Sun onClick={() => darkMode.toggle()} className='theme' />
                : <Moon onClick={() => darkMode.toggle()} className='theme' />}
            </div>
            <Link href='/faq' passHref>
              <a className='text-reset d-inline-flex'>
                faq
              </a>
            </Link>
            <span className='mx-2'> \ </span>
            <Link href='/story' passHref>
              <a className='text-reset d-inline-flex'>
                story
              </a>
            </Link>
            <span className='mx-2'> \ </span>
            <a
              href='https://plausible.io/stacker.news' className='text-reset d-inline-flex'
              target='_blank' rel='noreferrer'
            >
              analytics
            </a>
            <span className='mx-2'> \ </span>
            <OverlayTrigger trigger='click' placement='top' overlay={ChatPopover} rootClose>
              <div className='text-reset d-inline-flex' style={{ cursor: 'pointer' }}>
                chat
              </div>
            </OverlayTrigger>
            <span className='mx-2'> \ </span>
            <a href='/rss' className='text-reset d-inline-flex' target='_blank'>
              rss
            </a>
          </div>}
        {data &&
          <div
            className={`text-small mx-auto mb-2 ${styles.connect}`}
          >
            <span className='nav-item text-muted mr-2'>connect:</span>
            <CopyInput
              size='sm'
              groupClassName='mb-0 w-100'
              readOnly
              placeholder={data.connectAddress}
            />
          </div>}
        <small>
          <ContrastLink className='d-inline-block' href='https://github.com/stackernews/stacker.news'>
            This is free open source software<Github width={20} height={20} className='mx-1' />
          </ContrastLink>
          <span className='d-inline-block text-muted'>
            made with sound love in Austin<Texas className='mx-1' width={20} height={20} />
            by<a href='https://twitter.com/k00bideh' className='text-twitter d-inline-block'><Twitter width={20} height={20} className='ml-1' />@k00bideh</a>
          </span>
        </small>
      </Container>
    </footer>
  )
}
