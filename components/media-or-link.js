import styles from './text.module.css'
import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { decodeProxyUrl, IMGPROXY_URL_REGEXP, MEDIA_DOMAIN_REGEXP } from '@/lib/url'
import { useShowModal } from './modal'
import { useMe } from './me'
import { Dropdown } from 'react-bootstrap'
import { UNKNOWN_LINK_REL } from '@/lib/constants'
import classNames from 'classnames'

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

export default function MediaOrLink (props) {
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

  if (!media.src) return null

  if (!error && (media.image || media.video)) {
    return (
      <Media
        {...media} onClick={handleClick} onError={(err) => {
          console.error('Error loading media', err)
          setError(true)
        }}
      />
    )
  }

  return <LinkRaw {...props} />
}

// determines how the media should be displayed given the params, me settings, and editor tab
const useMediaHelper = ({ src, srcSet: { dimensions, video, ...srcSetObj } = {}, topLevel, tab }) => {
  const me = useMe()
  const trusted = useMemo(() => !!srcSetObj || IMGPROXY_URL_REGEXP.test(src) || MEDIA_DOMAIN_REGEXP.test(src), [srcSetObj, src])
  const [isImage, setIsImage] = useState(!video && trusted)
  const [isVideo, setIsVideo] = useState(video)
  const showMedia = useMemo(() => tab === 'preview' || me?.privates?.showImagesAndVideos !== false, [tab, me?.privates?.showImagesAndVideos])

  useEffect(() => {
    // don't load the video at all if use doesn't want these
    if (!showMedia || isVideo) return
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
  }, [src, setIsImage, setIsVideo, showMedia, isVideo])

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
  const sizes = srcSet ? `${(topLevel ? 100 : 66)}vw` : undefined

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
  }, [dimensions])

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
    image: (!me?.privates?.imgproxyOnly || trusted) && showMedia && isImage && !isVideo,
    video: !me?.privates?.imgproxyOnly && showMedia && isVideo
  }
}
