import styles from './text.module.css'
import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { decodeProxyUrl, IMGPROXY_URL_REGEXP, MEDIA_DOMAIN_REGEXP, parseEmbedUrl } from '@/lib/url'
import { useShowModal } from './modal'
import { useMe } from './me'
import { Button, Dropdown } from 'react-bootstrap'
import { UNKNOWN_LINK_REL } from '@/lib/constants'
import classNames from 'classnames'
import { TwitterTweetEmbed } from 'react-twitter-embed'
import YouTube from 'react-youtube'
import useDarkMode from './dark-mode'

function LinkRaw ({ href, children, src, rel }) {
  const isRawURL = /^https?:\/\//.test(children?.[0])
  return (
    // eslint-disable-next-line
    <a
      target='_blank'
      rel={rel ?? UNKNOWN_LINK_REL}
      href={src}
    >{isRawURL || !children ? src : children}
    </a>
  )
}

const Media = memo(function Media ({ src, bestResSrc, srcSet, sizes, width, height, onClick, onError, style, className, video }) {
  return (
    <div className={classNames(className, styles.mediaContainer)} style={style}>
      {video
        ? <video
            src={src}
            preload={bestResSrc !== src ? 'metadata' : undefined}
            controls
            poster={bestResSrc !== src ? bestResSrc : undefined}
            width={width}
            height={height}
            onError={onError}
          />
        : <img
            src={src}
            srcSet={srcSet}
            sizes={sizes}
            width={width}
            height={height}
            onClick={onClick}
            onError={onError}
          />}
    </div>
  )
})

export default function MediaOrLink ({ linkFallback = true, ...props }) {
  const media = useMediaHelper(props)
  const [error, setError] = useState(false)
  const showModal = useShowModal()

  const handleClick = useCallback(() => showModal(close => {
    return (
      <div
        className={styles.fullScreenContainer}
        onClick={close}
      >
        <img className={styles.fullScreen} src={media.bestResSrc} />
      </div>
    )
  }, {
    fullScreen: true,
    overflow: (
      <Dropdown.Item
        href={media.originalSrc} target='_blank'
        rel={props.rel ?? UNKNOWN_LINK_REL}
      >
        open original
      </Dropdown.Item>)
  }), [showModal, media.originalSrc, styles, media.bestResSrc])

  const handleError = useCallback((err) => {
    console.error('Error loading media', err)
    setError(true)
  }, [setError])

  if (!media.src) return null

  if (!error) {
    if (media.image || media.video) {
      return (
        <Media
          {...media} onClick={handleClick} onError={handleError}
        />
      )
    }

    if (media.embed) {
      return (
        <Embed
          {...media.embed} src={media.src}
          className={media.className} onError={handleError} topLevel={props.topLevel}
        />
      )
    }
  }

  if (linkFallback) {
    return <LinkRaw {...props} />
  }

  return null
}

// determines how the media should be displayed given the params, me settings, and editor tab
export const useMediaHelper = ({ src, srcSet: srcSetIntital, topLevel, tab }) => {
  const me = useMe()
  const trusted = useMemo(() => !!srcSetIntital || IMGPROXY_URL_REGEXP.test(src) || MEDIA_DOMAIN_REGEXP.test(src), [!!srcSetIntital, src])
  const { dimensions, video, ...srcSetObj } = srcSetIntital || {}
  const [isImage, setIsImage] = useState(!video && trusted)
  const [isVideo, setIsVideo] = useState(video)
  const showMedia = useMemo(() => tab === 'preview' || me?.privates?.showImagesAndVideos !== false, [tab, me?.privates?.showImagesAndVideos])
  const embed = useMemo(() => parseEmbedUrl(src), [src])

  useEffect(() => {
    // don't load the video at all if use doesn't want these
    if (!showMedia || isVideo || isImage || embed) return
    // make sure it's not a false negative by trying to load URL as <img>
    const img = new window.Image()
    img.onload = () => setIsImage(true)
    img.src = src
    const video = document.createElement('video')
    video.onloadeddata = () => setIsVideo(true)
    video.src = src

    return () => {
      img.onload = null
      img.src = ''
      video.onloadeddata = null
      video.src = ''
    }
  }, [src, setIsImage, setIsVideo, showMedia, isVideo, embed])

  const srcSet = useMemo(() => {
    if (Object.keys(srcSetObj).length === 0) return undefined
    // srcSetObj shape: { [widthDescriptor]: <imgproxyUrl>, ... }
    return Object.entries(srcSetObj).reduce((acc, [wDescriptor, url], i, arr) => {
      // backwards compatibility: we used to replace image urls with imgproxy urls rather just storing paths
      if (!url.startsWith('http')) {
        url = new URL(url, process.env.NEXT_PUBLIC_IMGPROXY_URL).toString()
      }
      return acc + `${url} ${wDescriptor}` + (i < arr.length - 1 ? ', ' : '')
    }, '')
  }, [srcSetObj])
  const sizes = useMemo(() => srcSet ? `${(topLevel ? 100 : 66)}vw` : undefined)

  // get source url in best resolution
  const bestResSrc = useMemo(() => {
    if (Object.keys(srcSetObj).length === 0) return src
    return Object.entries(srcSetObj).reduce((acc, [wDescriptor, url]) => {
      if (!url.startsWith('http')) {
        url = new URL(url, process.env.NEXT_PUBLIC_IMGPROXY_URL).toString()
      }
      const w = Number(wDescriptor.replace(/w$/, ''))
      return w > acc.w ? { w, url } : acc
    }, { w: 0, url: undefined }).url
  }, [srcSetObj])

  const [style, width, height] = useMemo(() => {
    if (dimensions) {
      const { width, height } = dimensions
      const style = {
        '--height': `${height}px`,
        '--width': `${width}px`,
        '--aspect-ratio': `${width} / ${height}`
      }
      return [style, width, height]
    }
    return []
  }, [dimensions?.width, dimensions?.height])

  return {
    src,
    srcSet,
    originalSrc: IMGPROXY_URL_REGEXP.test(src) ? decodeProxyUrl(src) : src,
    sizes,
    bestResSrc,
    style,
    width,
    height,
    className: classNames(topLevel && styles.topLevel),
    image: (!me?.privates?.imgproxyOnly || trusted) && showMedia && isImage && !isVideo && !embed,
    video: !me?.privates?.imgproxyOnly && showMedia && isVideo && !embed,
    embed: !me?.privates?.imgproxyOnly && showMedia && embed
  }
}

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

export const Embed = memo(function Embed ({ src, provider, id, meta, className, topLevel, onError }) {
  const [darkMode] = useDarkMode()
  const [overflowing, setOverflowing] = useState(false)
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

  if (provider === 'wavlake') {
    return (
      <div className={classNames(styles.wavlakeWrapper, className)}>
        <iframe
          src={`https://embed.wavlake.com/track/${id}`} width='100%' height='380' frameBorder='0'
          allow='encrypted-media'
        />
      </div>
    )
  }

  if (provider === 'spotify') {
    // https://open.spotify.com/track/1KFxcj3MZrpBGiGA8ZWriv?si=f024c3aa52294aa1
    // Remove any additional path segments
    const url = new URL(src)
    url.pathname = url.pathname.replace(/\/intl-\w+\//, '/')
    return (
      <div className={classNames(styles.spotifyWrapper, className)}>
        <iframe
          title='Spotify Web Player'
          src={`https://open.spotify.com/embed${url.pathname}`}
          width='100%'
          height='152'
          allowfullscreen=''
          frameBorder='0'
          allow='encrypted-media; clipboard-write;'
          style={{ borderRadius: '12px' }}
        />
      </div>
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
