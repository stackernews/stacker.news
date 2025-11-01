import styles from './text.module.css'
import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react'
import { decodeProxyUrl, IMGPROXY_URL_REGEXP, MEDIA_DOMAIN_REGEXP } from '@/lib/url'
import { useMe } from './me'
import { UNKNOWN_LINK_REL, PUBLIC_MEDIA_CHECK_URL } from '@/lib/constants'
import classNames from 'classnames'
import { useCarousel } from './carousel'
import preserveScroll from './preserve-scroll'

export function LinkRaw ({ href, children, src, rel }) {
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

const Media = memo(function Media ({
  src, bestResSrc, srcSet, sizes, width,
  height, onClick, onError, style, className, video, imageRef
}) {
  const [loaded, setLoaded] = useState(!video)
  const ref = imageRef || useRef(null)

  const handleLoadedMedia = () => {
    setLoaded(true)
  }

  // events are not fired on elements during hydration
  // https://github.com/facebook/react/issues/15446
  useEffect(() => {
    if (ref.current && ref.current !== imageRef) {
      ref.current.src = src
    }
  }, [ref.current, src, imageRef])

  return (
    <div
      // will set min-content ONLY after the media is loaded
      // due to safari video bug
      className={classNames(className, imageRef ? '' : styles.mediaContainer, { [styles.loaded]: loaded })}
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

export function MediaOrLinkExperimental ({ editable = false, linkFallback = true, onError, className, imageRef, ...props }) {
  const media = useMediaHelper({ ...props })
  const [error, setError] = useState(false)
  const { showCarousel, addMedia, confirmMedia, removeMedia } = editable ? {} : (useCarousel() || {})

  // register placeholder immediately on mount if we have a src
  useEffect(() => {
    if (!addMedia) return
    if (!media.bestResSrc) return
    addMedia({ src: media.bestResSrc, originalSrc: media.originalSrc, rel: props.rel })
  }, [addMedia, media.bestResSrc, media.originalSrc, props.rel])

  // confirm media for carousel based on image detection
  useEffect(() => {
    if (!confirmMedia) return
    if (!media.image) return
    confirmMedia(media.bestResSrc)
  }, [confirmMedia, media.image, media.bestResSrc])

  const handleClick = useCallback(() => {
    if (!showCarousel) return
    showCarousel({ src: media.bestResSrc })
  }, [showCarousel, media.bestResSrc])

  const handleError = useCallback((err) => {
    removeMedia && removeMedia(media.bestResSrc)
    console.error('Error loading media', err)
    onError?.()
    setError(true)
  }, [setError, removeMedia, media.bestResSrc, onError])

  if (!media.src) return null

  if (!error) {
    if (media.image || media.video) {
      return preserveScroll(() => {
        return (
          <Media
            {...media} onClick={handleClick} onError={handleError} className={className} imageRef={imageRef}
          />
        )
      })
    }
  }

  if (linkFallback) {
    return <LinkRaw {...props} />
  }

  return null
}

export default function MediaOrLink ({ linkFallback = true, ...props }) {
  const media = useMediaHelper(props)
  const [error, setError] = useState(false)
  const { showCarousel, addMedia, confirmMedia, removeMedia } = useCarousel() || {}

  // register placeholder immediately on mount if we have a src
  useEffect(() => {
    if (!addMedia) return
    if (!media.bestResSrc) return
    addMedia({ src: media.bestResSrc, originalSrc: media.originalSrc, rel: props.rel })
  }, [addMedia, media.bestResSrc, media.originalSrc, props.rel])

  // confirm media for carousel based on image detection
  useEffect(() => {
    if (!confirmMedia) return
    if (!media.image) return
    confirmMedia(media.bestResSrc)
  }, [confirmMedia, media.image, media.bestResSrc])

  const handleClick = useCallback(() => {
    if (!showCarousel) return
    showCarousel({ src: media.bestResSrc })
  }, [showCarousel, media.bestResSrc])

  const handleError = useCallback((err) => {
    if (!removeMedia) return
    console.error('Error loading media', err)
    removeMedia(media.bestResSrc)
    setError(true)
  }, [setError, removeMedia, media.bestResSrc])

  if (!media.src) return null

  if (!error) {
    if (media.image || media.video) {
      return preserveScroll(() => {
        return (
          <Media
            {...media} onClick={handleClick} onError={handleError}
          />
        )
      })
    }
  }

  if (linkFallback) {
    return <LinkRaw {...props} />
  }

  return null
}

// determines how the media should be displayed given the params, me settings, and editor tab
export const useMediaHelper = ({ src, srcSet: srcSetIntital, topLevel, tab, preTailor, kind }) => {
  const { me } = useMe()
  const trusted = useMemo(() => !!srcSetIntital || IMGPROXY_URL_REGEXP.test(src) || MEDIA_DOMAIN_REGEXP.test(src), [!!srcSetIntital, src])
  const { dimensions, video, format, ...srcSetObj } = srcSetIntital || {}
  // we might already know the media type from the kind prop
  const [isImage, setIsImage] = useState(kind === 'image' || (video === false && trusted))
  const [isVideo, setIsVideo] = useState(kind === 'video' || video)
  const showMedia = useMemo(() => tab === 'preview' || me?.privates?.showImagesAndVideos !== false, [tab, me?.privates?.showImagesAndVideos])

  useEffect(() => {
    // don't load the video at all if user doesn't want these
    if (!showMedia || isVideo || isImage) return

    const controller = new AbortController()

    const checkMedia = async () => {
      try {
        const res = await fetch(`${PUBLIC_MEDIA_CHECK_URL}/${encodeURIComponent(src)}`, { signal: controller.signal })
        if (!res.ok) return

        const data = await res.json()

        if (data.isVideo) {
          setIsVideo(true)
          setIsImage(false)
        } else if (data.isImage) {
          setIsImage(true)
        }
      } catch (error) {
        if (error.name === 'AbortError') return
        console.error('cannot check media type', error)
      }
    }
    checkMedia()

    return () => {
      // abort the fetch
      try { controller.abort() } catch {}
    }
  }, [src, setIsImage, setIsVideo, showMedia])

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
    const source = preTailor || dimensions
    if (!source) return []

    const { width, height, maxWidth } = source
    const style = {
      '--height': height === 'inherit' ? height : `${height}px`,
      '--width': width === 'inherit' ? width : `${width}px`,
      '--aspect-ratio': `${width} / ${height}`,
      ...(maxWidth && { '--max-width': `${maxWidth}px` })
    }
    return [style, width, height]
  }, [dimensions?.width, dimensions?.height, preTailor])

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
