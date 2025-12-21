import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { decodeProxyUrl, IMGPROXY_URL_REGEXP, MEDIA_DOMAIN_REGEXP } from '@/lib/url'
import { useMe } from './me'
import { UNKNOWN_LINK_REL, PUBLIC_MEDIA_CHECK_URL } from '@/lib/constants'
import { useCarousel } from './carousel'
import { processSrcSetInitial } from '@/lib/lexical/exts/item-context'

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

const Media = memo(function Media ({
  src, bestResSrc, srcSet, sizes, width, alt, title,
  height, onClick, onError, video, style
}) {
  const content = (
    video
      ? (
        <video
          src={src}
          preload={bestResSrc !== src ? 'metadata' : undefined}
          controls
          poster={bestResSrc !== src ? bestResSrc : undefined}
          width={width}
          height={height}
          onError={onError}
        />
        )
      : (
        <img
          src={src}
          alt={alt}
          title={title}
          srcSet={srcSet}
          sizes={sizes}
          width={width}
          height={height}
          onClick={onClick}
          onError={onError}
        />
        )
  )

  return style ? <div style={style}>{content}</div> : content
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
export const useMediaHelper = ({ src, srcSet, srcSetIntital, bestResSrc, width, height, kind, alt, title, topLevel, setIsLink, tab }) => {
  const { me } = useMe()
  const trusted = useMemo(() => !!(srcSet || srcSetIntital) || IMGPROXY_URL_REGEXP.test(src) || MEDIA_DOMAIN_REGEXP.test(src), [srcSet, srcSetIntital, src])
  // backwards compatibility: legacy srcSet handling
  const legacySrcSet = useMemo(() => processSrcSetInitial(srcSetIntital, src), [srcSetIntital, src])
  const [isImage, setIsImage] = useState((kind === 'image' || legacySrcSet?.video === false) && trusted)
  const [isVideo, setIsVideo] = useState(kind === 'video' || legacySrcSet?.video)
  const showMedia = useMemo(() => tab === 'preview' || me?.privates?.showImagesAndVideos !== false, [me?.privates?.showImagesAndVideos, tab])

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
        } else {
          setIsLink?.(true)
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
  }, [src, setIsImage, setIsVideo, showMedia, setIsLink])

  let style = null
  if (legacySrcSet?.srcSet) {
    srcSet = legacySrcSet?.srcSet
    bestResSrc = legacySrcSet?.bestResSrc
    width = legacySrcSet?.width
    height = legacySrcSet?.height
    if (width && height && width > 0 && height > 0) {
      style = {
        '--height': `${height}px`,
        '--width': `${width}px`
      }
    }
  }

  const sizes = useMemo(() => srcSet ? '66vw' : undefined, [srcSet])

  return {
    src,
    srcSet,
    alt,
    title,
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
