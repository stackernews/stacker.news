import styles from './text.module.css'
import { Fragment, useState, useEffect, useMemo, useCallback, forwardRef, useRef, memo } from 'react'
import { IMGPROXY_URL_REGEXP, MEDIA_DOMAIN_REGEXP } from '@/lib/url'
import { useShowModal } from './modal'
import { useMe } from './me'
import { Dropdown } from 'react-bootstrap'
import { UNKNOWN_LINK_REL, UPLOAD_TYPES_ALLOW, MEDIA_URL } from '@/lib/constants'
import { useToast } from './toast'
import gql from 'graphql-tag'
import { useMutation } from '@apollo/client'
import piexif from 'piexifjs'

export function decodeOriginalUrl (imgproxyUrl) {
  const parts = imgproxyUrl.split('/')
  // base64url is not a known encoding in browsers
  // so we need to replace the invalid chars
  const b64Url = parts[parts.length - 1].replace(/-/g, '+').replace(/_/, '/')
  const originalUrl = Buffer.from(b64Url, 'base64').toString('utf-8')
  return originalUrl
}

function ImageOriginal ({ src, topLevel, rel, tab, children, onClick, ...props }) {
  const me = useMe()
  const [showImage, setShowImage] = useState(false)

  useEffect(() => {
    if (me?.privates?.imgproxyOnly && tab !== 'preview') return
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
      // eslint-disable-next-line
      <a
        target='_blank'
        rel={rel ?? UNKNOWN_LINK_REL}
        href={src}
      >{isRawURL || !children ? src : children}
      </a>
    )
  }
}

function TrustedImage ({ src, srcSet: { dimensions, ...srcSetObj } = {}, onClick, topLevel, onError, ...props }) {
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

  const handleError = useCallback(onError, [onError])
  const handleClick = useCallback(() => onClick(bestResSrc), [onClick, bestResSrc])

  return (
    <Image
      className={topLevel ? styles.topLevel : undefined}
      // browsers that don't support srcSet and sizes will use src. use best resolution possible in that case
      src={bestResSrc}
      srcSet={srcSet}
      sizes={sizes}
      width={dimensions?.width}
      height={dimensions?.height}
      onClick={handleClick}
      onError={handleError}
    />
  )
}

const Image = memo(({ className, src, srcSet, sizes, width, height, onClick, onError }) => {
  const style = width && height
    ? { '--height': `${height}px`, '--width': `${width}px`, '--aspect-ratio': `${width} / ${height}` }
    : undefined

  return (
    <img
      className={className}
      // browsers that don't support srcSet and sizes will use src. use best resolution possible in that case
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      width={width}
      height={height}
      onClick={onClick}
      onError={onError}
      style={style}
    />
  )
})

export default function ZoomableImage ({ src, srcSet, ...props }) {
  const showModal = useShowModal()

  // if `srcSet` is falsy, it means the image was not processed by worker yet
  const [trustedDomain, setTrustedDomain] = useState(!!srcSet || IMGPROXY_URL_REGEXP.test(src) || MEDIA_DOMAIN_REGEXP.test(src))

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
        href={originalUrl} target='_blank'
        rel={props.rel ?? UNKNOWN_LINK_REL}
      >
        open original
      </Dropdown.Item>)
  }), [showModal, originalUrl, styles])

  const handleError = useCallback(() => setTrustedDomain(false), [setTrustedDomain])

  if (!src) return null

  if (trustedDomain) {
    return (
      <TrustedImage
        src={src} srcSet={srcSet}
        onClick={handleClick} onError={handleError} {...props}
      />
    )
  }

  return <ImageOriginal src={originalUrl} onClick={handleClick} {...props} />
}

export const ImageUpload = forwardRef(({ children, className, onSelect, onUpload, onSuccess, onError, multiple, avatar }, ref) => {
  const toaster = useToast()
  ref ??= useRef(null)

  const [getSignedPOST] = useMutation(
    gql`
      mutation getSignedPOST($type: String!, $size: Int!, $width: Int!, $height: Int!, $avatar: Boolean) {
        getSignedPOST(type: $type, size: $size, width: $width, height: $height, avatar: $avatar) {
          url
          fields
        }
      }`)

  const s3Upload = useCallback(async file => {
    const img = new window.Image()
    file = await removeExifData(file)
    return new Promise((resolve, reject) => {
      img.onload = async () => {
        onUpload?.(file)
        let data
        const variables = {
          avatar,
          type: file.type,
          size: file.size,
          width: img.width,
          height: img.height
        }
        try {
          ({ data } = await getSignedPOST({ variables }))
        } catch (e) {
          toaster.danger('error initiating upload: ' + e.message || e.toString?.())
          onError?.({ ...variables, name: file.name, file })
          reject(e)
          return
        }

        const form = new FormData()
        Object.keys(data.getSignedPOST.fields).forEach(key => form.append(key, data.getSignedPOST.fields[key]))
        form.append('Content-Type', file.type)
        form.append('Cache-Control', 'max-age=31536000')
        form.append('acl', 'public-read')
        form.append('file', file)

        const res = await fetch(data.getSignedPOST.url, {
          method: 'POST',
          body: form
        })

        if (!res.ok) {
          // TODO make sure this is actually a helpful error message and does not expose anything to the user we don't want
          const err = res.statusText
          toaster.danger('error uploading: ' + err)
          onError?.({ ...variables, name: file.name, file })
          reject(err)
          return
        }

        const url = `${MEDIA_URL}/${data.getSignedPOST.fields.key}`
        // key is upload id in database
        const id = data.getSignedPOST.fields.key
        onSuccess?.({ ...variables, id, name: file.name, url, file })
        resolve(id)
      }
      img.onerror = reject
      img.src = window.URL.createObjectURL(file)
    })
  }, [toaster, getSignedPOST])

  return (
    <>
      <input
        ref={ref}
        type='file'
        multiple={multiple}
        className='d-none'
        accept={UPLOAD_TYPES_ALLOW.join(', ')}
        onChange={async (e) => {
          const fileList = e.target.files
          for (const file of Array.from(fileList)) {
            if (UPLOAD_TYPES_ALLOW.indexOf(file.type) === -1) {
              toaster.danger(`image must be ${UPLOAD_TYPES_ALLOW.map(t => t.replace('image/', '')).join(', ')}`)
              continue
            }
            if (onSelect) await onSelect?.(file, s3Upload)
            else await s3Upload(file)
            // reset file input
            // see https://bobbyhadz.com/blog/react-reset-file-input#reset-a-file-input-in-react
            e.target.value = null
          }
        }}
      />
      <div
        className={className} onClick={() => ref.current?.click()} style={{ cursor: 'pointer' }} tabIndex={0} onKeyDown={(e) => {
          if (e.key === 'Enter') { ref.current?.click() }
        }}
      >
        {children}
      </div>
    </>
  )
})

// from https://stackoverflow.com/a/77472484
const removeExifData = async (file) => {
  if (!file || !file.type.startsWith('image/')) return file
  const cleanBuffer = (arrayBuffer) => {
    let dataView = new DataView(arrayBuffer)
    const exifMarker = 0xffe1
    let offset = 2 // Skip the first two bytes (0xFFD8)
    while (offset < dataView.byteLength) {
      if (dataView.getUint16(offset) === exifMarker) {
        // Found an EXIF marker
        const segmentLength = dataView.getUint16(offset + 2, false) + 2
        arrayBuffer = removeSegment(arrayBuffer, offset, segmentLength)
        dataView = new DataView(arrayBuffer)
      } else {
        // Move to the next marker
        offset += 2 + dataView.getUint16(offset + 2, false)
      }
    }
    return arrayBuffer
  }
  const removeSegment = (buffer, offset, length) => {
    // Create a new buffer without the specified segment
    const modifiedBuffer = new Uint8Array(buffer.byteLength - length)
    modifiedBuffer.set(new Uint8Array(buffer.slice(0, offset)), 0)
    modifiedBuffer.set(new Uint8Array(buffer.slice(offset + length)), offset)
    return modifiedBuffer.buffer
  }
  function getOrientation (file) {
    const fr = new window.FileReader()
    return new Promise((resolve, reject) => {
      fr.onload = function () {
        const view = new DataView(this.result)
        if (view.getUint16(0, false) !== 0xFFD8) {
          // not JPEG
          return resolve(-2)
        }
        const length = view.byteLength; let offset = 2
        while (offset < length) {
          if (view.getUint16(offset + 2, false) <= 8) return resolve(-1) // no orientation available
          const marker = view.getUint16(offset, false)
          offset += 2
          if (marker === 0xFFE1) {
            if (view.getUint32(offset += 2, false) !== 0x45786966) {
              // no orientation available
              return resolve(-1)
            }
            const little = view.getUint16(offset += 6, false) === 0x4949
            offset += view.getUint32(offset + 4, little)
            const tags = view.getUint16(offset, little)
            offset += 2
            for (let i = 0; i < tags; i++) {
              if (view.getUint16(offset + (i * 12), little) === 0x0112) {
                // orientation available
                return resolve(view.getUint16(offset + (i * 12) + 8, little))
              }
            }
          } else if ((marker & 0xFF00) !== 0xFF00) {
            break
          } else {
            offset += view.getUint16(offset, false)
          }
        }
        // no orientation available
        return resolve(-1)
      }
      fr.onerror = reject
      fr.readAsArrayBuffer(file)
    })
  }
  const orientation = await getOrientation(file)
  const cleanFile = await new Promise((resolve, reject) => {
    const fr = new window.FileReader()
    fr.onload = function () {
      const cleanedBuffer = cleanBuffer(this.result)
      const blob = new Blob([cleanedBuffer], { type: file.type })
      const newFile = new File([blob], file.name, { type: file.type })
      resolve(newFile)
    }
    fr.onerror = reject
    fr.readAsArrayBuffer(file)
  })
  if (orientation <= 0) {
    // not orientation available (-1) or not JPEG (-2)
    return cleanFile
  }
  // put orientation value back in
  return new Promise((resolve, reject) => {
    const fr = new window.FileReader()
    fr.onload = function () {
      const zeroth = {}
      // Orientation is of type SHORT so single int is ok, see https://piexifjs.readthedocs.io/en/latest/appendices.html
      zeroth[piexif.ImageIFD.Orientation] = orientation
      const exifObj = { '0th': zeroth }
      const exifStr = piexif.dump(exifObj)
      const inserted = piexif.insert(exifStr, this.result)
      const dataUriToBuffer = (dataUri) => {
        // data-uri scheme regexp from https://github.com/ragingwind/data-uri-regex/blob/a9d7474c833e8fbf5b1821fe65d8cccd6aea4536/index.js
        // data:[<media type>][;charset=<character set>][;base64],<data>
        const regexp = /^(data:)([\w/+-]*)(;charset=[\w-]+|;base64){0,1},(.*)/gi
        const b64 = regexp.exec(dataUri)[4]
        const buf = Buffer.from(b64, 'base64')
        return buf
      }
      const buf = dataUriToBuffer(inserted)
      const blob = new Blob([buf], { type: file.type })
      const newFile = new File([blob], file.name, { type: file.type })
      resolve(newFile)
    }
    fr.onerror = reject
    // piexifjs library needs data URI as input
    fr.readAsDataURL(cleanFile)
  })
}
