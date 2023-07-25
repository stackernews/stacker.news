import { useRef } from 'react'
import { gql, useMutation } from '@apollo/client'
import { UPLOAD_TYPES_ALLOW } from '../lib/constants'

export default function Upload ({ as: Component, onSelect, onStarted, onError, onSuccess }) {
  const [getSignedPOST] = useMutation(
    gql`
      mutation getSignedPOST($type: String!, $size: Int!, $width: Int!, $height: Int!) {
        getSignedPOST(type: $type, size: $size, width: $width, height: $height) {
          url
          fields
        }
      }`)
  const ref = useRef()

  const upload = file => {
    onStarted && onStarted()

    const img = new window.Image()
    img.src = window.URL.createObjectURL(file)
    img.onload = async () => {
      let data
      try {
        ({ data } = await getSignedPOST({
          variables: {
            type: file.type,
            size: file.size,
            width: img.width,
            height: img.height
          }
        }))
      } catch (e) {
        onError && onError(e.toString())
        return
      }

      const form = new FormData()
      Object.keys(data.getSignedPOST.fields).forEach(key =>
        form.append(key, data.getSignedPOST.fields[key]))
      form.append('Content-Type', file.type)
      form.append('Cache-Control', 'max-age=31536000')
      form.append('acl', 'public-read')
      form.append('file', file)

      const res = await fetch(data.getSignedPOST.url, {
        method: 'POST',
        body: form
      })

      if (!res.ok) {
        onError && onError(res.statusText)
        return
      }

      onSuccess && onSuccess(data.getSignedPOST.fields.key)
    }
  }

  return (
    <>
      <input
        ref={ref}
        type='file'
        className='d-none'
        accept={UPLOAD_TYPES_ALLOW.join(', ')}
        onChange={(e) => {
          if (e.target.files.length === 0) {
            return
          }

          const file = e.target.files[0]

          if (UPLOAD_TYPES_ALLOW.indexOf(file.type) === -1) {
            onError && onError(`image must be ${UPLOAD_TYPES_ALLOW.map(t => t.replace('image/', '')).join(', ')}`)
            return
          }

          if (onSelect) {
            onSelect(file, upload)
          } else {
            upload(file)
          }

          e.target.value = null
        }}
      />
      <Component onClick={() => ref.current?.click()} />
    </>
  )
}
