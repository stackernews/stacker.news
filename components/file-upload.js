import { Fragment, useCallback, forwardRef, useRef } from 'react'
import { UPLOAD_TYPES_ALLOW, MEDIA_URL } from '@/lib/constants'
import { useToast } from './toast'
import gql from 'graphql-tag'
import { useMutation } from '@apollo/client'
import piexif from 'piexifjs'

export const FileUpload = forwardRef(({ children, className, onSelect, onUpload, onSuccess, onError, multiple, avatar, allow }, ref) => {
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
    const element = file.type.startsWith('image/')
      ? new window.Image()
      : document.createElement('video')

    file = await removeExifData(file)

    return new Promise((resolve, reject) => {
      async function onload () {
        onUpload?.(file)
        let data
        const variables = {
          avatar,
          type: file.type,
          size: file.size,
          width: element.width,
          height: element.height
        }
        try {
          ({ data } = await getSignedPOST({ variables }))
        } catch (e) {
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
          onError?.({ ...variables, name: file.name, file })
          reject(new Error(res.statusText))
          return
        }

        const url = `${MEDIA_URL}/${data.getSignedPOST.fields.key}`
        // key is upload id in database
        const id = data.getSignedPOST.fields.key
        onSuccess?.({ ...variables, id, name: file.name, url, file })

        console.log('resolve id', id)
        resolve(id)
      }

      // img fire 'load' event while videos fire 'loadeddata'
      element.onload = onload
      element.onloadeddata = onload

      element.onerror = reject
      element.src = window.URL.createObjectURL(file)
    })
  }, [toaster, getSignedPOST])

  const accept = UPLOAD_TYPES_ALLOW.filter(type => allow ? new RegExp(allow).test(type) : true)

  return (
    <>
      <input
        ref={ref}
        type='file'
        multiple={multiple}
        className='d-none'
        accept={accept.join(', ')}
        onChange={async (e) => {
          const fileList = e.target.files
          for (const file of Array.from(fileList)) {
            try {
              if (accept.indexOf(file.type) === -1) {
                throw new Error(`image must be ${accept.map(t => t.replace('image/', '').replace('video/', '')).join(', ')}`)
              }
              if (onSelect) await onSelect?.(file, s3Upload)
              else await s3Upload(file)
            } catch (e) {
              toaster.danger('upload failed: ' + e.message || e.toString?.())
              continue
            }
          }
          // reset file input
          // see https://bobbyhadz.com/blog/react-reset-file-input#reset-a-file-input-in-react
          e.target.value = null
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
