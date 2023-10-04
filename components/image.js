import styles from './text.module.css'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { IMGPROXY_URL_REGEXP } from '../lib/url'
import { useShowModal } from './modal'
import { useMe } from './me'
import { Dropdown } from 'react-bootstrap'

export function decodeOriginalUrl (imgproxyUrl) {
  const parts = imgproxyUrl.split('/')
  // base64url is not a known encoding in browsers
  // so we need to replace the invalid chars
  const b64Url = parts[parts.length - 1].replace(/-/g, '+').replace(/_/, '/')
  const originalUrl = Buffer.from(b64Url, 'base64').toString('utf-8')
  return originalUrl
}

function ImageOriginal ({ src, topLevel, nofollow, tab, children, onClick, ...props }) {
  const me = useMe()
  const [showImage, setShowImage] = useState(false)

  useEffect(() => {
    if (me?.imgproxyOnly && tab !== 'preview') return
    // make sure it's not a false negative by trying to load URL as <img>
    const img = new window.Image()
    img.onload = () => setShowImage(true)
    img.src = src

    return () => {
      img.onload = null
      img.src = ''
    }
  }, [src, showImage])

  if (showImage) {
    return (
      <img
        className={topLevel ? styles.topLevel : undefined}
        src={src}
        onClick={() => onClick(src)}
        onError={() => setShowImage(false)}
      />
    )
  } else {
    // user is not okay with loading original url automatically or there was an error loading the image

    // If element parsed by markdown is a raw URL, we use src as the text to not mislead users.
    // This will not be the case if [text](url) format is used. Then we will show what was chosen as text.
    const isRawURL = /^https?:\/\//.test(children?.[0])
    return (
      <a
        target='_blank'
        rel={`noreferrer ${nofollow ? 'nofollow' : ''} noopener`}
        href={src}
      >{isRawURL ? src : children}
      </a>
    )
  }
}

function ImageProxy ({ src, srcSet: srcSetObj, onClick, topLevel, onError, ...props }) {
  const srcSet = useMemo(() => {
    if (!srcSetObj) return undefined
    // srcSetObj shape: { [widthDescriptor]: <imgproxyUrl>, ... }
    return Object.entries(srcSetObj).reduce((acc, [wDescriptor, url], i, arr) => {
      return acc + `${url} ${wDescriptor}` + (i < arr.length - 1 ? ', ' : '')
    }, '')
  }, [srcSetObj])
  const sizes = srcSet ? `${(topLevel ? 100 : 66)}vw` : undefined

  // get source url in best resolution
  const bestResSrc = useMemo(() => {
    if (!srcSetObj) return src
    return Object.entries(srcSetObj).reduce((acc, [wDescriptor, url]) => {
      const w = Number(wDescriptor.replace(/w$/, ''))
      return w > acc.w ? { w, url } : acc
    }, { w: 0, url: undefined }).url
  }, [srcSetObj])

  return (
    <img
      className={topLevel ? styles.topLevel : undefined}
      // browsers that don't support srcSet and sizes will use src. use best resolution possible in that case
      src={bestResSrc}
      srcSet={srcSet}
      sizes={sizes}
      onClick={() => onClick(bestResSrc)}
      onError={onError}
    />
  )
}

export default function ZoomableImage ({ src, srcSet, ...props }) {
  const showModal = useShowModal()

  // if `srcSet` is falsy, it means the image was not processed by worker yet
  const [imgproxy, setImgproxy] = useState(!!srcSet || IMGPROXY_URL_REGEXP.test(src))

  // backwards compatibility:
  // src may already be imgproxy url since we used to replace image urls with imgproxy urls
  const originalUrl = IMGPROXY_URL_REGEXP.test(src) ? decodeOriginalUrl(src) : src

  const handleClick = useCallback((src) => showModal(close => {
    return (
      <div
        className={styles.fullScreenContainer}
        onClick={close}
      >
        <img className={styles.fullScreen} src={src} />
      </div>
    )
  }, {
    fullScreen: true,
    overflow: (
      <Dropdown.Item
        href={originalUrl} target='_blank' rel='noreferrer'
      >
        open original
      </Dropdown.Item>)
  }), [showModal, originalUrl, styles])

  if (!src) return null

  if (imgproxy) {
    return (
      <ImageProxy
        src={src} srcSet={srcSet}
        onClick={handleClick} onError={() => setImgproxy(false)} {...props}
      />
    )
  }

  return <ImageOriginal src={originalUrl} onClick={handleClick} {...props} />
}
