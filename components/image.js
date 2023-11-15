import styles from './text.module.css'
import { Fragment, useState, useEffect, useMemo, useCallback, forwardRef, useRef } from 'react'
import { IMGPROXY_URL_REGEXP } from '../lib/url'
import { useShowModal } from './modal'
import { useMe } from './me'
import { Dropdown } from 'react-bootstrap'
import { UPLOAD_TYPES_ALLOW } from '../lib/constants'
import { useToast } from './toast'
import gql from 'graphql-tag'
import { useMutation } from '@apollo/client'

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
        href={originalUrl} target='_blank'
        rel={`noreferrer ${props.nofollow ? 'nofollow' : ''} noopener`}
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
    img.src = window.URL.createObjectURL(file)
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
          toaster.danger(e.message || e.toString?.())
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
          toaster.danger(err)
          onError?.({ ...variables, name: file.name, file })
          reject(err)
          return
        }

        const url = `https://${process.env.NEXT_PUBLIC_MEDIA_DOMAIN}/${data.getSignedPOST.fields.key}`
        // key is upload id in database
        const id = data.getSignedPOST.fields.key
        onSuccess?.({ ...variables, id, name: file.name, url, file })
        resolve(id)
      }
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
      <div className={className} onClick={() => ref.current?.click()} style={{ cursor: 'pointer' }}>
        {children}
      </div>
    </>
  )
})

// from https://stackoverflow.com/a/77472484
const removeExifData = (file) => {
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
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) return resolve(file)
    const fr = new window.FileReader()
    fr.onload = function () {
      const cleanedBuffer = cleanBuffer(this.result)
      const blob = new Blob([cleanedBuffer], { type: file.type })
      const newFile = new File([blob], file.name, { type: file.type })
      resolve(newFile)
    }
    fr.readAsArrayBuffer(file)
  })
}
