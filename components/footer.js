import Container from '@/components/ui/container'
import { navLinkClasses } from '@/components/ui/nav'
import { cn } from '@/lib/cn'
import { Popover, PopoverTrigger, PopoverContent, PopoverBody } from '@/components/ui/popover'
import { CopyInput } from './form'
import styles from './footer.module.css'
import Texas from '@/svgs/texas.svg'
import Github from '@/svgs/github-fill.svg'
import Link from 'next/link'
import Sun from '@/svgs/sun-fill.svg'
import Moon from '@/svgs/moon-fill.svg'
import No from '@/svgs/no.svg'
import Bolt from '@/svgs/bolt.svg'
import Amboss from '@/svgs/amboss.svg'
import Mempool from '@/svgs/bimi.svg'
import Live from '@/svgs/chat-unread-fill.svg'
import NoLive from '@/svgs/chat-off-fill.svg'
import Rewards from './footer-rewards'
import useDarkMode from './dark-mode'
import ActionTooltip from './action-tooltip'
import { useAnimationEnabled } from '@/components/animation'
import { useLiveCommentsToggle } from './use-live-comments'

const linkClasses = navLinkClasses({ className: 'p-0 inline-flex' })

function FooterPopover ({ label, children }) {
  return (
    <Popover>
      <PopoverTrigger nativeButton={false} render={<div className={cn(linkClasses, 'cursor-pointer')}>{label}</div>} />
      <PopoverContent side='top' aria-label={label}>
        <PopoverBody className='font-medium'>{children}</PopoverBody>
      </PopoverContent>
    </Popover>
  )
}

function RssPopover () {
  return (
    <FooterPopover label='rss'>
      <div className='flex justify-center'>
        <a href='/rss' className={linkClasses}>
          home
        </a>
        <span className='mx-2 text-muted'> \ </span>
        <a href='/~bitcoin/rss' className={linkClasses}>
          bitcoin
        </a>
        <span className='mx-2 text-muted'> \ </span>
        <a href='/~nostr/rss' className={linkClasses}>
          nostr
        </a>
      </div>
      <div className='flex justify-center'>
        <a href='/~tech/rss' className={linkClasses}>
          tech
        </a>
        <span className='mx-2 text-muted'> \ </span>
        <a href='/~meta/rss' className={linkClasses}>
          meta
        </a>
        <span className='mx-2 text-muted'> \ </span>
        <a href='/~jobs/rss' className={linkClasses}>
          jobs
        </a>
      </div>
    </FooterPopover>
  )
}

function SocialsPopover () {
  return (
    <FooterPopover label='socials'>
      <div className='flex justify-center'>
        <a
          href='https://njump.me/npub1jfujw6llhq7wuvu5detycdsq5v5yqf56sgrdq8wlgrryx2a2p09svwm0gx' className={linkClasses}
          target='_blank' rel='noreferrer'
        >
          nostr
        </a>
        <span className='mx-2 text-muted'> \ </span>
        <a
          href='https://twitter.com/stacker_news' className={linkClasses}
          target='_blank' rel='noreferrer'
        >
          twitter
        </a>
        <span className='mx-2 text-muted'> \ </span>
        <a
          href='https://www.youtube.com/@stackernews' className={linkClasses}
          target='_blank' rel='noreferrer'
        >
          youtube
        </a>
      </div>
      <div className='flex justify-center'>
        <a
          href='https://www.fountain.fm/show/Mg1AWuvkeZSFhsJZ3BW2' className={linkClasses}
          target='_blank' rel='noreferrer'
        >
          pod
        </a>
        <span className='mx-2 text-muted'> \ </span>
        <a
          href='https://www.plebpoet.com/zines.html' className={linkClasses}
          target='_blank' rel='noreferrer'
        >
          zines
        </a>
      </div>
    </FooterPopover>
  )
}

function ChatPopover () {
  return (
    <FooterPopover label='chat'>
      <a
        href='https://t.me/k00bideh' className={linkClasses}
        target='_blank' rel='noreferrer'
      >
        telegram
      </a>
      <span className='mx-2 text-muted'> \ </span>
      <a
        href='https://signal.group/#CjQKIEt57YiluJoTW3lZqaqAq6echCekEYFfg7eIua2X91nLEhA__6ALI9pkaY_McQqX0jm1' className={linkClasses}
        target='_blank' rel='noreferrer'
      >
        signal
      </a>
    </FooterPopover>
  )
}

function LegalPopover () {
  return (
    <FooterPopover label='legal'>
      <div className='flex justify-center'>
        <Link href='/tos' className={linkClasses}>
          terms of service
        </Link>
        <span className='mx-2 text-muted'> \ </span>
        <Link href='/privacy' className={linkClasses}>
          privacy policy
        </Link>
      </div>
      <div className='flex justify-center'>
        <Link href='/copyright' className={linkClasses}>
          copyright policy
        </Link>
      </div>
    </FooterPopover>
  )
}

export default function Footer ({ links = true }) {
  const [darkMode, darkModeToggle] = useDarkMode()

  const [animationEnabled, toggleAnimation] = useAnimationEnabled()

  const [disableLiveComments, toggleLiveComments] = useLiveCommentsToggle()

  const DarkModeIcon = darkMode ? Sun : Moon
  const LnIcon = animationEnabled ? No : Bolt
  const LiveIcon = disableLiveComments ? Live : NoLive

  const version = process.env.NEXT_PUBLIC_COMMIT_HASH

  return (
    <footer>
      <Container className='mb-4'>
        {links &&
          <>
            <div className='mb-1'>
              <ActionTooltip notForm overlayText={`${darkMode ? 'disable' : 'enable'} dark mode`}>
                <DarkModeIcon onClick={darkModeToggle} width={20} height={20} className='theme' suppressHydrationWarning />
              </ActionTooltip>
              <ActionTooltip notForm overlayText={`${animationEnabled ? 'disable' : 'enable'} lightning animations`}>
                <LnIcon onClick={toggleAnimation} width={20} height={20} className='ms-2 theme' suppressHydrationWarning />
              </ActionTooltip>
              <ActionTooltip notForm overlayText={`${disableLiveComments ? 'enable' : 'disable'} live comments`}>
                <LiveIcon onClick={toggleLiveComments} width={20} height={20} className='ms-2 theme' suppressHydrationWarning />
              </ActionTooltip>
            </div>
            <div className='mb-0' style={{ fontWeight: 500 }}>
              <Rewards className={linkClasses} />
            </div>
            <div className='mb-0' style={{ fontWeight: 500 }}>
              <Link href='/stackers/all/day' className={linkClasses}>
                analytics
              </Link>
              <span className='mx-2 text-muted'> \ </span>
              <ChatPopover />
              <span className='mx-2 text-muted'> \ </span>
              <SocialsPopover />
              <span className='mx-2 text-muted'> \ </span>
              <RssPopover />
            </div>
            <div className='mb-2' style={{ fontWeight: 500 }}>
              <Link href='/faq' className={linkClasses}>
                faq
              </Link>
              <span className='mx-2 text-muted'> \ </span>
              <Link href='/guide' className={linkClasses}>
                guide
              </Link>
              <span className='mx-2 text-muted'> \ </span>
              <Link href='/story' className={linkClasses}>
                story
              </Link>
              <span className='mx-2 text-muted'> \ </span>
              <LegalPopover />
            </div>
          </>}
        {process.env.NEXT_PUBLIC_LND_CONNECT_ADDRESS &&
          <div
            className={`mx-auto mb-2 ${styles.connect}`}
          >
            <small className='font-medium text-muted me-2'>connect:</small>
            {/* min-w-0 so the input's intrinsic width can't push the node links past the viewport */}
            <CopyInput
              size='sm'
              groupClassName='mb-0 w-full min-w-0'
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
        <small className='flex justify-center items-center text-muted flex-wrap'>
          <a className={`${styles.contrastLink} flex items-center`} href='https://github.com/stackernews/stacker.news' target='_blank' rel='noreferrer'>
            FOSS <Github width={20} height={20} className='mx-1 fill-current' />
          </a>
          made in Austin<Texas className='ms-1 fill-current' width={20} height={20} />
          <span className='ms-1'>by</span>
          <span>
            <Link href='/k00b' className='ms-1'>
              @k00b
            </Link>
            <Link href='/sox' className='ms-1'>
              @sox
            </Link>
            <Link href='/Scoresby' className='ms-1'>
              @Scoresby
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
