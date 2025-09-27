import { memo, useEffect, useRef, useState } from 'react'
import classNames from 'classnames'
import useDarkMode from './dark-mode'
import styles from './text.module.css'
import { Button } from 'react-bootstrap'
import { TwitterTweetEmbed } from 'react-twitter-embed'
import YouTube from 'react-youtube'
import LoadErrorIcon from '@/svgs/file-warning-line.svg'

const LoadingError = ({ provider, src, className }) => {
  let host = provider
  try {
    host = new URL(src).hostname || provider
  } catch (e) {
    // fallback to provider if URL parsing fails
  }
  return (
    <div className={classNames(styles.embedLoadingError, className)}>
      <div className={classNames(styles.embedLoadingErrorMessage)}>
        <LoadErrorIcon className='fill-grey' />
        <div>{provider} embed is not available at the moment.</div>
        <a href={src} target='_blank' rel='noopener nofollow noreferrer'>
          view on {host}
        </a>
      </div>
    </div>
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

const TwitterEmbed = ({ id, className, topLevel, onError }) => {
  const [darkMode] = useDarkMode()
  const [overflowing, setOverflowing] = useState(true)
  const [show, setShow] = useState(false)
  const clearLoadTimeout = useLoadTimeout({ onError })

  return (
    <div className={classNames(styles.twitterContainer, !show && styles.twitterContained, className)}>
      <TwitterTweetEmbed
        tweetId={id}
        options={{ theme: darkMode ? 'dark' : 'light', width: topLevel ? '550px' : '350px' }}
        key={darkMode ? '1' : '2'}
        placeholder={<TweetSkeleton className={className} />}
        onLoad={() => { setOverflowing(true); clearLoadTimeout() }}
      />
      {overflowing && !show &&
        <Button size='lg' variant='info' className={styles.twitterShowFull} onClick={() => setShow(true)}>
          show full tweet
        </Button>}
    </div>
  )
}

const WavlakeEmbed = ({ id, className, onError }) => {
  const iframeRef = useRef(null)
  useLoadTimeout({ iframeRef, onError })

  return (
    <div className={classNames(styles.wavlakeWrapper, className)}>
      <iframe
        ref={iframeRef}
        src={`https://embed.wavlake.com/track/${id}`} width='100%' height='380' frameBorder='0'
        allow='encrypted-media'
        sandbox='allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-same-origin'
      />
    </div>
  )
}

const YouTubeEmbed = ({ id, className, meta, onError }) => {
  const clearLoadTimeout = useLoadTimeout({ onError })

  return (
    <div className={classNames(styles.videoWrapper, className)}>
      <YouTube
        videoId={id}
        className={styles.videoContainer}
        opts={{
          playerVars: {
            start: meta?.start || 0
          }
        }}
        onReady={() => { clearLoadTimeout() }}
        onError={() => { clearLoadTimeout(); onError?.() }}
      />
    </div>
  )
}

const RumbleEmbed = ({ id, className, meta, onError }) => {
  const iframeRef = useRef(null)
  useLoadTimeout({ iframeRef, onError })

  return (
    <div className={classNames(styles.videoWrapper, className)}>
      <div className={styles.videoContainer}>
        <iframe
          ref={iframeRef}
          title='Rumble Video'
          allowFullScreen
          src={meta?.href}
          sandbox='allow-scripts'
        />
      </div>
    </div>
  )
}

const PeerTubeEmbed = ({ id, className, meta, onError }) => {
  const iframeRef = useRef(null)
  useLoadTimeout({ iframeRef, onError })

  return (
    <div className={classNames(styles.videoWrapper, className)}>
      <div className={styles.videoContainer}>
        <iframe
          ref={iframeRef}
          title='PeerTube Video'
          allowFullScreen
          src={meta?.href}
          sandbox='allow-scripts'
        />
      </div>
    </div>
  )
}

const NostrEmbed = ({ src, className, topLevel, id, onError }) => {
  const [darkMode] = useDarkMode()
  const [show, setShow] = useState(false)
  const iframeRef = useRef(null)

  useLoadTimeout({
    iframeRef,
    onLoad: () => {
      iframeRef.current.contentWindow.postMessage({ setDarkMode: darkMode }, '*')
    },
    onError
  })

  useEffect(() => {
    if (!iframeRef.current) return

    const setHeightFromIframe = (e) => {
      if (e.origin !== 'https://njump.me' || !e?.data?.height || e.source !== iframeRef.current.contentWindow) return
      iframeRef.current.height = `${e.data.height}px`
    }

    window?.addEventListener('message', setHeightFromIframe)

    // https://github.com/vercel/next.js/issues/39451
    iframeRef.current.src = `https://njump.me/${id}?embed=yes`

    return () => window?.removeEventListener('message', setHeightFromIframe)
  }, [iframeRef.current, darkMode, id])

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
      />
      {!show &&
        <Button size='md' variant='info' className={styles.twitterShowFull} onClick={() => setShow(true)}>
          <div>show full note</div>
          <small className='fw-normal fst-italic'>or other stuff</small>
        </Button>}
    </div>
  )
}

const SpotifyEmbed = function SpotifyEmbed ({ src, className, onError }) {
  const iframeRef = useRef(null)

  // https://open.spotify.com/track/1KFxcj3MZrpBGiGA8ZWriv?si=f024c3aa52294aa1
  // Remove any additional path segments
  const url = new URL(src)
  url.pathname = url.pathname.replace(/\/intl-\w+\//, '/')

  useLoadTimeout({ iframeRef, onError })

  useEffect(() => {
    if (!iframeRef.current) return

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
      />
    </div>
  )
}

export default memo(function Embed ({ src, provider, id, meta, className, topLevel, onError }) {
  const [error, setError] = useState(false)
  const onErr = () => onError?.() || setError(true)
  if (error) return <LoadingError provider={provider} src={src} className={className} />
  switch (provider) {
    case 'twitter':
      return <TwitterEmbed id={id} className={className} topLevel={topLevel} onError={onErr} />
    case 'nostr':
      return <NostrEmbed src={src} className={className} topLevel={topLevel} id={id} onError={onErr} />
    case 'wavlake':
      return <WavlakeEmbed id={id} className={className} onError={onErr} />
    case 'spotify':
      return <SpotifyEmbed src={src} className={className} onError={onErr} />
    case 'youtube':
      return <YouTubeEmbed id={id} className={className} meta={meta} onError={onErr} />
    case 'rumble':
      return <RumbleEmbed id={id} className={className} meta={meta} onError={onErr} />
    case 'peertube':
      return <PeerTubeEmbed id={id} className={className} meta={meta} onError={onErr} />
    default:
      return null
  }
})

const useLoadTimeout = ({ iframeRef, timeout = 15000, onLoad, onError }) => {
  const timeoutRef = useRef(null)

  useEffect(() => {
    const handleLoad = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      onLoad?.()
    }

    const handleError = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      onError?.()
    }

    if (iframeRef?.current) {
      iframeRef.current.addEventListener('load', handleLoad)
      iframeRef.current.addEventListener('error', handleError)
    }
    timeoutRef.current = setTimeout(handleError, timeout)

    return () => {
      if (iframeRef?.current) {
        iframeRef.current.removeEventListener('load', handleLoad)
        iframeRef.current.removeEventListener('error', handleError)
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [iframeRef?.current, timeout, onLoad, onError])

  const clear = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }

  return clear
}
