import styles from './text.module.css'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { extractUrls } from '../lib/md'
import { IMGPROXY_URL_REGEXP, IMG_URL_REGEXP } from '../lib/url'
import FileMissing from '../svgs/file-warning-line.svg'
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

export const IMG_CACHE_STATES = {
  LOADING: 'IS_LOADING',
  LOADED: 'IS_LOADED',
  ERROR: 'IS_ERROR'
}

// this is the image at public/placeholder_click_to_load.png as a data URI so we don't have to rely on network to render it
const IMAGE_CLICK_TO_LOAD_DATA_URI = 'data:image/png;base64,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'

const IMAGE_PROCESSING_DATA_URI = 'data:image/png;base64,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'

export function useImgUrlCache (text, imgproxyUrls) {
  const ref = useRef({})
  const [imgUrlCache, setImgUrlCache] = useState({})
  const me = useMe()

  const updateCache = (url, state) => setImgUrlCache((prev) => ({ ...prev, [url]: state }))

  useEffect(() => {
    const urls = extractUrls(text)

    urls.forEach((url) => {
      if (IMG_URL_REGEXP.test(url) || !!imgproxyUrls?.[url]) {
        // it's probably an image if the regexp matches or if we processed the URL as an image in the worker
        updateCache(url, IMG_CACHE_STATES.LOADED)
      } else {
        // don't use image detection by trying to load as an image if user opted-out of loading external images automatically
        if (me?.clickToLoadImg) return
        // make sure it's not a false negative by trying to load URL as <img>
        const img = new window.Image()
        ref.current[url] = img

        updateCache(url, IMG_CACHE_STATES.LOADING)

        const callback = (state) => {
          updateCache(url, state)
          delete ref.current[url]
        }
        img.onload = () => callback(IMG_CACHE_STATES.LOADED)
        img.onerror = () => callback(IMG_CACHE_STATES.ERROR)
        img.src = url
      }
    })

    return () => {
      Object.values(ref.current).forEach((img) => {
        img.onload = null
        img.onerror = null
        img.src = ''
      })
    }
  }, [text])

  return imgUrlCache
}

export function ZoomableImage ({ src, topLevel, srcSet: srcSetObj, ...props }) {
  const me = useMe()
  const showModal = useShowModal()
  const [originalUrlConsent, setOriginalUrlConsent] = useState(!me ? true : !me.clickToLoadImg)
  // if there is no srcset obj, image is still processing (srcSetObj === undefined) or it wasn't detected as an image by the worker (srcSetObj === null).
  // we handle both cases the same as imgproxy errors.
  const [imgproxyErr, setImgproxyErr] = useState(!srcSetObj)
  const [originalErr, setOriginalErr] = useState()

  // backwards compatibility:
  // src may already be imgproxy url since we used to replace image urls with imgproxy urls
  const originalUrl = IMGPROXY_URL_REGEXP.test(src) ? decodeOriginalUrl(src) : src

  // we will fallback to the original error if there was an error with our image proxy
  const loadOriginalUrl = !!imgproxyErr

  const srcSet = useMemo(() => {
    if (!srcSetObj) return undefined
    // srcSetObj shape: { [widthDescriptor]: <imgproxyUrl>, ... }
    return Object.entries(srcSetObj).reduce((acc, [wDescriptor, url], i, arr) => {
      return acc + `${url} ${wDescriptor}` + (i < arr.length - 1 ? ', ' : '')
    }, '')
  }, [srcSetObj])
  const sizes = `${(topLevel ? 100 : 66)}vw`

  // get source url in best resolution
  const bestResSrc = useMemo(() => {
    if (!srcSetObj) return undefined
    return Object.entries(srcSetObj).reduce((acc, [wDescriptor, url]) => {
      const w = Number(wDescriptor.replace(/w$/, ''))
      return w > acc.w ? { w, url } : acc
    }, { w: 0, url: undefined }).url
  }, [srcSetObj])

  const onError = useCallback((err) => {
    if (!imgproxyErr) {
      // first error is imgproxy error since that was loaded
      console.error('imgproxy image error:', err)
      setImgproxyErr(true)
    } else {
      // second error is error from original url
      console.error('original image error:', err)
      setOriginalErr(true)
    }
  }, [setImgproxyErr, setOriginalErr, imgproxyErr, originalUrl])

  const handleClick = useCallback(() => showModal(close => (
    <div
      className='d-grid w-100 h-100' style={{ placeContent: 'center' }} onClick={close}
    >
      <img
        style={{ cursor: 'zoom-out', maxWidth: '100%', maxHeight: '100%', minHeight: 0, minWidth: 0 }}
      // also load original url in fullscreen if the original url was loaded
        src={loadOriginalUrl ? originalUrl : bestResSrc}
        onError={onError}
        {...props}
      />
    </div>
  ), {
    fullScreen: true,
    overflow: (
      <Dropdown.Item
        href={originalUrl} target='_blank' rel='noreferrer'
      >
        {loadOriginalUrl ? 'open in new tab' : 'open original'}
      </Dropdown.Item>)
  }), [showModal, loadOriginalUrl, originalUrl, bestResSrc, onError, props])

  if (!src) return null

  if ((srcSetObj === undefined) && originalUrlConsent && !originalErr) {
    // image is still processing and user is okay with loading original url automatically
    return (
      <img
        className={topLevel ? styles.topLevel : undefined}
        style={{ cursor: 'zoom-in', maxHeight: topLevel ? '35vh' : '25vh' }}
        src={originalUrl}
        onClick={handleClick}
        onError={() => setOriginalErr(true)}
        {...props}
      />
    )
  }

  if ((srcSetObj === undefined) && !originalUrlConsent && !originalErr) {
    // image is still processing and user is not okay with loading original url automatically
    const { host } = new URL(originalUrl)
    return (
      <div style={{ width: '256px' }}>
        <img
          className={topLevel ? styles.topLevel : undefined}
          src={IMAGE_PROCESSING_DATA_URI} width='256px' height='256px'
          style={{ cursor: 'pointer' }} onClick={() => setOriginalUrlConsent(true)}
        />
        <div className='text-muted fst-italic text-center'>click to load original from</div>
        <div className='text-muted fst-italic text-center'>{host}</div>
      </div>
    )
  }

  if (originalErr) {
    // we already tried original URL: degrade <img> to <a> tag
    return (
      <>
        <span className='d-flex align-items-baseline text-warning-emphasis fw-bold pb-1'>
          <FileMissing width={18} height={18} className='fill-warning me-1 align-self-center' />
          failed to load image
        </span>
        <a target='_blank' href={originalUrl} rel='noreferrer'>{originalUrl}</a>
      </>
    )
  }

  if (imgproxyErr && !originalUrlConsent) {
    // respect privacy setting that external images should not be loaded automatically
    const { host } = new URL(originalUrl)
    return (
      <div style={{ width: '256px' }}>
        <div className='d-flex align-items-baseline text-warning-emphasis fw-bold pb-1 justify-content-center'>
          <FileMissing width={18} height={18} className='fill-warning me-1 align-self-center' />
          image proxy error
        </div>
        <img
          className={topLevel ? styles.topLevel : undefined}
          src={IMAGE_CLICK_TO_LOAD_DATA_URI} width='256px' height='256px'
          style={{ cursor: 'pointer' }} onClick={() => setOriginalUrlConsent(true)}
        />
        <div className='text-muted fst-italic text-center'>from {host}</div>
      </div>
    )
  }

  return (
    <img
      className={topLevel ? styles.topLevel : undefined}
      style={{ cursor: 'zoom-in', maxHeight: topLevel ? '35vh' : '25vh' }}
      // browsers that don't support srcSet and sizes will use src. use best resolution possible in that case
      src={loadOriginalUrl ? originalUrl : bestResSrc}
      // we need to disable srcset and sizes to force browsers to use src
      srcSet={loadOriginalUrl ? undefined : srcSet}
      sizes={loadOriginalUrl ? undefined : sizes}
      onClick={handleClick}
      onError={onError}
      {...props}
    />
  )
}
