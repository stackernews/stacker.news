import { memo, useEffect, useRef, useState, useCallback } from 'react'
import classNames from 'classnames'
import useDarkMode from './dark-mode'
import styles from './text.module.css'
import { Button } from 'react-bootstrap'
import { TwitterTweetEmbed } from 'react-twitter-embed'
import YouTube from 'react-youtube'
import { useIsClient } from './use-client'
import LoadErrorIcon from '@/svgs/file-warning-line.svg'
import Moon from '@/svgs/moon-fill.svg'
import Link from 'next/link'

const Loading = ({ provider, src, className, error }) => {
  let host = provider
  try {
    host = new URL(src).hostname
  } catch (e) {
    console.error(e)
  }
  return (
    <div className={classNames(styles.embedLoading, className)}>
      <div className={styles.embedLoadingMessage}>
        {error ? <LoadErrorIcon className='fill-grey' /> : <Moon className='spin fill-grey' />}
        <div>{error ? `${provider} embed is not available at the moment.` : `loading ${provider}...`}</div>
        <Link href={src} target='_blank' rel='noopener nofollow noreferrer'>
          view on {host}
        </Link>
      </div>
    </div>
  )
}

const LoaderWrapper = ({ loading, provider, src, children }) => {
  console.log('loading', loading)
  return (
    <>
      {loading && <Loading provider={provider} src={src} />}
      <div style={{ display: loading ? 'none' : 'block' }}>
        {children}
      </div>
    </>
  )
}

const TweetSkeleton = ({ className }) => {
  return (
    <div className={classNames(styles.tweetsSkeleton, className)}>
      <div className={styles.tweetSkeleton}>
        <div className={`${styles.img} clouds`} />
        <div className={styles.content1}>
          <div className={`${styles.line} clouds`} />
          <div className={`${styles.line} clouds`} />
          <div className={`${styles.line} clouds`} />
        </div>
      </div>
    </div>
  )
}

const TwitterEmbed = ({ id, className, topLevel, ...props }) => {
  const [darkMode] = useDarkMode()
  const [overflowing, setOverflowing] = useState(true)
  const [show, setShow] = useState(false)

  return (
    <div className={classNames(styles.twitterContainer, !show && styles.twitterContained, className)}>
      <TwitterTweetEmbed
        tweetId={id}
        options={{ theme: darkMode ? 'dark' : 'light', width: topLevel ? '550px' : '350px' }}
        key={darkMode ? '1' : '2'}
        placeholder={<TweetSkeleton className={className} />}
        onLoad={() => { props.onLoad(); setOverflowing(true) }}
        onError={props.onError}
      />
      {overflowing && !show &&
        <Button size='lg' variant='info' className={styles.twitterShowFull} onClick={() => setShow(true)}>
          show full tweet
        </Button>}
    </div>
  )
}

const YouTubeEmbed = ({ id, className, start, ...props }) => {
  return (
    <div className={classNames(styles.videoWrapper, className)}>
      <YouTube
        videoId={id}
        className={styles.videoContainer}
        opts={{
          playerVars: {
            start: start || 0
          }
        }}
        onReady={props.onLoad}
        onError={props.onError}
      />
    </div>
  )
}

const NostrEmbed = ({ className, topLevel, id, ...props }) => {
  const iframeRef = useRef(null)
  const [darkMode] = useDarkMode()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!iframeRef.current) return

    const setHeightFromIframe = (e) => {
      if (e.origin !== 'https://njump.me' || !e?.data?.height || e.source !== iframeRef.current.contentWindow) return
      iframeRef.current.height = `${e.data.height}px`
    }

    window?.addEventListener('message', setHeightFromIframe)

    const handleIframeLoad = () => {
      iframeRef.current.contentWindow.postMessage({ setDarkMode: darkMode }, '*')
    }

    if (iframeRef.current.complete) {
      handleIframeLoad()
    } else {
      iframeRef.current.addEventListener('load', handleIframeLoad)
    }

    // https://github.com/vercel/next.js/issues/39451
    iframeRef.current.src = `https://njump.me/${id}?embed=yes`

    return () => {
      window?.removeEventListener('message', setHeightFromIframe)
      iframeRef.current?.removeEventListener('load', handleIframeLoad)
    }
  }, [id, darkMode])

  return (
    <div className={classNames(styles.nostrContainer, !show && styles.twitterContained, className)}>
      <iframe
        ref={iframeRef}
        width={topLevel ? '550px' : '350px'}
        style={{ maxWidth: '100%' }}
        height={iframeRef.current?.height || (topLevel ? '200px' : '150px')}
        frameBorder='0'
        sandbox='allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'
        allow=''
        {...props}
      />
      {!show &&
        <Button size='md' variant='info' className={styles.twitterShowFull} onClick={() => setShow(true)}>
          <div>show full note</div>
          <small className='fw-normal fst-italic'>or other stuff</small>
        </Button>}
    </div>
  )
}

const SpotifyEmbed = function SpotifyEmbed ({ src, className, ...props }) {
  const iframeRef = useRef(null)
  // https://open.spotify.com/track/1KFxcj3MZrpBGiGA8ZWriv?si=f024c3aa52294aa1
  // Remove any additional path segments
  const url = new URL(src)
  url.pathname = url.pathname.replace(/\/intl-\w+\//, '/')

  useEffect(() => {
    if (!iframeRef.current) return
    console.log('useEffect', iframeRef.current)
    console.log('useEffect', url.pathname)

    const id = url.pathname.split('/').pop()

    // https://developer.spotify.com/documentation/embeds/tutorials/using-the-iframe-api
    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      const options = {
        uri: `spotify:episode:${id}`
      }
      const callback = (EmbedController) => {}
      IFrameAPI.createController(iframeRef.current, options, callback)
    }

    return () => { window.onSpotifyIframeApiReady = null }
  }, [iframeRef.current, url.pathname])

  return (
    <div className={classNames(styles.spotifyWrapper, className)}>
      <iframe
        ref={iframeRef}
        title='Spotify Web Player'
        src={`https://open.spotify.com/embed${url.pathname}`}
        width='100%'
        height='152'
        allowFullScreen
        frameBorder='0'
        allow='encrypted-media; clipboard-write;'
        style={{ borderRadius: '12px' }}
        sandbox='allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-presentation'
        {...props}
      />
    </div>
  )
}

const WavlakeEmbed = ({ id, className, ...props }) => {
  return (
    <div className={classNames(styles.wavlakeWrapper, className)}>
      <iframe
        src={`https://embed.wavlake.com/track/${id}`} width='100%' height='380' frameBorder='0'
        allow='encrypted-media'
        sandbox='allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-same-origin'
        {...props}
      />
    </div>
  )
}

const PeerTubeEmbed = ({ className, href, ...props }) => {
  return (
    <div className={classNames(styles.videoWrapper, className)}>
      <div className={styles.videoContainer}>
        <iframe
          title='PeerTube Video'
          allowFullScreen
          src={href}
          sandbox='allow-scripts'
          {...props}
        />
      </div>
    </div>
  )
}

const RumbleEmbed = ({ className, href, ...props }) => {
  return (
    <div className={classNames(styles.videoWrapper, className)}>
      <div className={styles.videoContainer}>
        <iframe
          title='Rumble Video'
          allowFullScreen
          src={href}
          sandbox='allow-scripts'
          {...props}
        />
      </div>
    </div>
  )
}

export default memo(function Embed ({ src, provider, id, meta, className, topLevel }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const onLoad = useCallback(() => setTimeout(() => setLoading(false), 1000), [setLoading])
  const onError = useCallback(() => setError(true), [])
  const props = { onLoad, onError }
  const isClient = useIsClient()

  // after 15 seconds of loading, bail out
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        setError(true)
      }, 15000)

      return () => clearTimeout(timeout)
    }
  }, [loading])

  if (!isClient || error) {
    return <Loading provider={provider} src={src} className={className} error={error} />
  }

  return (
    <LoaderWrapper loading={loading} provider={provider} src={src}>
      {(() => {
        switch (provider) {
          case 'twitter':
            return <TwitterEmbed id={id} className={className} topLevel={topLevel} {...props} />
          case 'youtube':
            return <YouTubeEmbed id={id} className={className} start={meta?.start} {...props} />
          case 'nostr':
            return <NostrEmbed className={className} topLevel={topLevel} id={id} {...props} />
          case 'spotify':
            return <SpotifyEmbed src={src} className={className} {...props} />
          case 'wavlake':
            return <WavlakeEmbed id={id} className={className} {...props} />
          case 'peertube':
            return <PeerTubeEmbed className={className} href={meta?.href} {...props} />
          case 'rumble':
            return <RumbleEmbed className={className} href={meta?.href} {...props} />
          default:
            return null
        }
      })()}
    </LoaderWrapper>
  )
})
