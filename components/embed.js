import { memo, useEffect, useRef, useState } from 'react'
import classNames from 'classnames'
import useDarkMode from './dark-mode'
import { Button } from 'react-bootstrap'
import { TwitterTweetEmbed } from 'react-twitter-embed'
import LiteYouTubeEmbed from 'react-lite-youtube-embed'
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css'

function TweetSkeleton ({ className }) {
  return (
    <div className={classNames('sn-tweets-skeleton', className)}>
      <div className='sn-tweet-skeleton'>
        <div className='sn-tweet-skeleton__img clouds' />
        <div className='sn-tweet-skeleton__content'>
          <div className='sn-tweet-skeleton__line clouds' />
          <div className='sn-tweet-skeleton__line clouds' />
          <div className='sn-tweet-skeleton__line clouds' />
        </div>
      </div>
    </div>
  )
}

export const NostrEmbed = memo(function NostrEmbed ({ className, darkMode, id }) {
  const [show, setShow] = useState(false)
  const iframeRef = useRef(null)

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
  }, [iframeRef.current, darkMode])

  return (
    <div className={classNames('sn-nostr-container', !show && 'sn-embed-contained', className)}>
      <iframe
        ref={iframeRef}
        width='100%'
        style={{ maxWidth: '100%' }}
        height={iframeRef.current?.height || '100%'}
        frameBorder='0'
        sandbox='allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'
        allow=''
      />
      {!show &&
        <Button size='md' variant='info' className='sn-embed-show-full' onClick={() => setShow(true)}>
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
    <div className={classNames('sn-spotify-wrapper', className)}>
      <iframe
        ref={iframeRef}
        title='Spotify Web Player'
        src={`https://open.spotify.com/embed${url.pathname}`}
        width='100%'
        height='100%'
        allowFullScreen
        frameBorder='0'
        allow='encrypted-media; clipboard-write;'
        style={{ borderRadius: '12px' }}
        sandbox='allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-presentation'
      />
    </div>
  )
}

const Embed = memo(function Embed ({ src, provider, id, meta, className, topLevel }) {
  const [darkMode] = useDarkMode()
  const [overflowing, setOverflowing] = useState(true)
  const [show, setShow] = useState(false)
  const embedClass = className || `sn-embed--${provider}`

  if (provider === 'twitter') {
    return (
      <>
        <div className={classNames('sn-twitter-container', !show && 'sn-embed-contained', embedClass)}>
          <TwitterTweetEmbed
            tweetId={id}
            options={{ theme: darkMode ? 'dark' : 'light', width: topLevel ? 550 : 350 }}
            key={darkMode ? '1' : '2'}
            placeholder={<TweetSkeleton className={embedClass} />}
            onLoad={() => setOverflowing(true)}
          />
          {overflowing && !show &&
            <Button size='lg' variant='info' className='sn-embed-show-full' onClick={() => setShow(true)}>
              show full tweet
            </Button>}
        </div>
      </>
    )
  }

  if (provider === 'nostr') {
    return (
      <NostrEmbed src={src} className={embedClass} id={id} darkMode={darkMode} />
    )
  }

  if (provider === 'wavlake') {
    return (
      <div className={classNames('sn-wavlake-wrapper', embedClass)}>
        <iframe
          src={`https://embed.wavlake.com/track/${id}`}
          width='100%'
          height='100%'
          frameBorder='0'
          allow='encrypted-media'
          sandbox='allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-same-origin'
        />
      </div>
    )
  }

  if (provider === 'spotify') {
    return (
      <SpotifyEmbed src={src} className={embedClass} />
    )
  }

  if (provider === 'youtube') {
    return (
      <div className={classNames('sn-video-wrapper', embedClass)}>
        <LiteYouTubeEmbed
          id={id}
          title='YouTube Video'
          aspectWidth={16}
          aspectHeight={9}
          iframeClass='sn-video-container'
          params={`start=${meta?.start || 0}`}
        />
      </div>
    )
  }

  if (provider === 'rumble') {
    return (
      <div className={classNames('sn-video-wrapper', embedClass)}>
        <div className='sn-video-container'>
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
      <div className={classNames('sn-video-wrapper', embedClass)}>
        <div className='sn-video-container'>
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
