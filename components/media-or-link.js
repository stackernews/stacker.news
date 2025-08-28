import styles from './text.module.css'
import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react'
import { decodeProxyUrl, IMGPROXY_URL_REGEXP, MEDIA_DOMAIN_REGEXP } from '@/lib/url'
import { useMe } from './me'
import { UNKNOWN_LINK_REL } from '@/lib/constants'
import classNames from 'classnames'
import { useCarousel } from './carousel'

function LinkRaw ({ children, src, rel }) {
  const childText = typeof children === 'string' ? children : undefined
  const isRawURL = childText ? /^https?:\/\//.test(childText) : false
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

const Media = memo(function Media ({
  src, bestResSrc, srcSet, sizes, width,
  height, onClick, onError, style, className, video
}) {
  const [loaded, setLoaded] = useState(!video)
  const ref = useRef(null)

  const handleLoadedMedia = () => {
    setLoaded(true)
  }

  // events are not fired on elements during hydration
  // https://github.com/facebook/react/issues/15446
  useEffect(() => {
    if (ref.current) {
      ref.current.src = src
    }
  }, [src])

  return (
    <div
      // will set min-content ONLY after the media is loaded
      // due to safari video bug
      className={classNames(className, styles.mediaContainer, { [styles.loaded]: loaded })}
      style={style}
    >
      {video
        ? <video
            ref={ref}
            src={src}
            preload={bestResSrc !== src ? 'metadata' : undefined}
            controls
            poster={bestResSrc !== src ? bestResSrc : undefined}
            width={width}
            height={height}
            onError={onError}
            onLoadedMetadata={handleLoadedMedia}
          />
        : <img
            ref={ref}
            src={src}
            srcSet={srcSet}
            sizes={sizes}
            width={width}
            height={height}
            onClick={onClick}
            onError={onError}
            onLoad={handleLoadedMedia}
          />}
    </div>
  )
})

export default function MediaOrLink ({ linkFallback = true, ...props }) {
  const media = useMediaHelper(props)
  const [error, setError] = useState(false)
  const { showCarousel, addMedia, confirmMedia, removeMedia } = useCarousel()

  // register placeholder immediately on mount if we have a src
  useEffect(() => {
    if (!media.bestResSrc) return
    addMedia({ src: media.bestResSrc, originalSrc: media.originalSrc, rel: props.rel })
  }, [addMedia, media.bestResSrc, media.originalSrc, props.rel])

  // confirm media for carousel based on image detection
  useEffect(() => {
    if (!media.image) return
    confirmMedia(media.bestResSrc)
  }, [confirmMedia, media.image, media.bestResSrc])

  const handleClick = useCallback(() => showCarousel({ src: media.bestResSrc }),
    [showCarousel, media.bestResSrc])

  const handleError = useCallback((err) => {
    console.error('Error loading media', err)
    removeMedia(media.bestResSrc)
    setError(true)
  }, [setError, removeMedia, media.bestResSrc])

  if (!media.src) return null

  if (!error) {
    if (media.image || media.video) {
      return (
        <Media
          {...media} onClick={handleClick} onError={handleError}
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
  const { me } = useMe()
  const trusted = useMemo(() => !!srcSetIntital || IMGPROXY_URL_REGEXP.test(src) || MEDIA_DOMAIN_REGEXP.test(src), [!!srcSetIntital, src])
  const { dimensions, video, format, ...srcSetObj } = srcSetIntital || {}
  const [isImage, setIsImage] = useState(video === false && trusted)
  const [isVideo, setIsVideo] = useState(video)
  const showMedia = useMemo(() => tab === 'preview' || me?.privates?.showImagesAndVideos !== false, [tab, me?.privates?.showImagesAndVideos])

  useEffect(() => {
    // don't load the video at all if user doesn't want these
    if (!showMedia || isVideo || isImage) return

    // check if it's a video by trying to load it
    const video = document.createElement('video')
    video.onloadedmetadata = () => {
      setIsVideo(true)
      setIsImage(false)
    }
    video.onerror = () => {
      // hack
      // if it's not a video it will throw an error, so we can assume it's an image
      const img = new window.Image()
      img.src = src
      img.decode().then(() => { // decoding beforehand to prevent wrong image cropping
        setIsImage(true)
      }).catch((e) => {
        console.error('Cannot decode image', e)
      })
    }
    video.src = src

    return () => {
      video.onloadedmetadata = null
      video.onerror = null
      video.src = ''
    }
  }, [src, setIsImage, setIsVideo, showMedia, isImage])

  const srcSet = useMemo(() => {
    if (Object.keys(srcSetObj).length === 0) return undefined
    // srcSetObj shape: { [widthDescriptor]: <imgproxyUrl>, ... }
    const result = Object.entries(srcSetObj).reduce((acc, [wDescriptor, url], i, arr) => {
      // skip invalid entries
      if (!url || typeof url !== 'string') return acc
      // backwards compatibility: we used to replace image urls with imgproxy urls rather just storing paths
      if (!url.startsWith('http')) {
        // only construct absolute URL when base is configured; otherwise keep relative and avoid crashing SSR
        if (process.env.NEXT_PUBLIC_IMGPROXY_URL) {
          try {
            url = new URL(url, process.env.NEXT_PUBLIC_IMGPROXY_URL).toString()
          } catch {
            return acc
          }
        } else {
          // without a base, we can't produce a valid absolute URL for srcset; skip this candidate
          return acc
        }
      }
      return acc + `${url} ${wDescriptor}` + (i < arr.length - 1 ? ', ' : '')
    }, '')
    return result || undefined
  }, [srcSetObj])
  const sizes = useMemo(() => srcSet ? `${(topLevel ? 100 : 66)}vw` : undefined)

  // get source url in best resolution
  const bestResSrc = useMemo(() => {
    if (Object.keys(srcSetObj).length === 0) return src
    return Object.entries(srcSetObj).reduce((acc, [wDescriptor, url]) => {
      if (!url || typeof url !== 'string') return acc
      if (!url.startsWith('http')) {
        if (process.env.NEXT_PUBLIC_IMGPROXY_URL) {
          try {
            url = new URL(url, process.env.NEXT_PUBLIC_IMGPROXY_URL).toString()
          } catch {
            return acc
          }
        } else {
          return acc
        }
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
    image: (!me?.privates?.imgproxyOnly || trusted) && showMedia && isImage && !isVideo,
    video: !me?.privates?.imgproxyOnly && showMedia && isVideo
  }
}
