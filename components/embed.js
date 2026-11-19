import { memo, useEffect, useRef } from 'react'
import classNames from 'classnames'
import LiteYouTubeEmbed from 'react-lite-youtube-embed'
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css'
import EmbedCard from './embed-card'

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

const Embed = memo(function Embed ({ src, provider, id, meta, data, full, className }) {
  const embedClass = className || `sn-embed--${provider}`

  if (provider === 'twitter' || provider === 'nostr') {
    return <EmbedCard src={src} provider={provider} data={data} full={full} className={embedClass} />
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
