import { memo, useEffect, useRef, useState } from 'react'
import classNames from 'classnames'
import useDarkMode from './dark-mode'
import styles from './text.module.css'
import { Button } from 'react-bootstrap'
import { TwitterTweetEmbed } from 'react-twitter-embed'
import YouTube from 'react-youtube'

function TweetSkeleton ({ className }) {
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

export const NostrEmbed = memo(function NostrEmbed ({ src, className, topLevel, id }) {
  const [show, setShow] = useState(false)
  const iframeRef = useRef(null)

  useEffect(() => {
    if (!iframeRef.current) return

    const setHeightFromIframe = (e) => {
      if (e.origin !== 'https://njump.me' || !e?.data?.height || e.source !== iframeRef.current.contentWindow) return
      iframeRef.current.height = `${e.data.height}px`
    }

    window?.addEventListener('message', setHeightFromIframe)

    // https://github.com/vercel/next.js/issues/39451
    iframeRef.current.src = `https://njump.me/${id}?embed=yes`

    return () => {
      window?.removeEventListener('message', setHeightFromIframe)
    }
  }, [iframeRef.current])

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
})

const SpotifyEmbed = function SpotifyEmbed ({ src, className }) {
  const iframeRef = useRef(null)

  // https://open.spotify.com/track/1KFxcj3MZrpBGiGA8ZWriv?si=f024c3aa52294aa1
  // Remove any additional path segments
  const url = new URL(src)
  url.pathname = url.pathname.replace(/\/intl-\w+\//, '/')

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

const Embed = memo(function Embed ({ src, provider, id, meta, className, topLevel, onError }) {
  const [darkMode] = useDarkMode()
  const [overflowing, setOverflowing] = useState(true)
  const [show, setShow] = useState(false)

  // This Twitter embed could use similar logic to the video embeds below
  if (provider === 'twitter') {
    return (
      <div className={classNames(styles.twitterContainer, !show && styles.twitterContained, className)}>
        <TwitterTweetEmbed
          tweetId={id}
          options={{ theme: darkMode ? 'dark' : 'light', width: topLevel ? '550px' : '350px' }}
          key={darkMode ? '1' : '2'}
          placeholder={<TweetSkeleton className={className} />}
          onLoad={() => setOverflowing(true)}
        />
        {overflowing && !show &&
          <Button size='lg' variant='info' className={styles.twitterShowFull} onClick={() => setShow(true)}>
            show full tweet
          </Button>}
      </div>
    )
  }

  if (provider === 'nostr') {
    return (
      <NostrEmbed src={src} className={className} topLevel={topLevel} id={id} />
    )
  }

  if (provider === 'wavlake') {
    return (
      <div className={classNames(styles.wavlakeWrapper, className)}>
        <iframe
          src={`https://embed.wavlake.com/track/${id}`} width='100%' height='380' frameBorder='0'
          allow='encrypted-media'
          sandbox='allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-same-origin'
        />
      </div>
    )
  }

  if (provider === 'spotify') {
    return (
      <SpotifyEmbed src={src} className={className} />
    )
  }

  if (provider === 'youtube') {
    return (
      <div className={classNames(styles.videoWrapper, className)}>
        <YouTube
          videoId={id} className={styles.videoContainer} opts={{
            playerVars: {
              start: meta?.start || 0
            }
          }}
        />
      </div>
    )
  }

  if (provider === 'rumble') {
    return (
      <div className={classNames(styles.videoWrapper, className)}>
        <div className={styles.videoContainer}>
          <iframe
            title='Rumble Video'
            allowFullScreen
            src={meta?.href}
            sandbox='allow-scripts'
          />
        </div>
      </div>
    )
  }

  if (provider === 'peertube') {
    return (
      <div className={classNames(styles.videoWrapper, className)}>
        <div className={styles.videoContainer}>
          <iframe
            title='PeerTube Video'
            allowFullScreen
            src={meta?.href}
            sandbox='allow-scripts'
          />
        </div>
      </div>
    )
  }

  return null
})

export default Embed
