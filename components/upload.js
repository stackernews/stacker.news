import { useRef, useState } from 'react'
import { gql, useMutation } from '@apollo/client'
import { UPLOAD_TYPES_ALLOW } from '../lib/constants'
import AddImage from '../svgs/image-add-fill.svg'
import Moon from '../svgs/moon-fill.svg'
import { Image as BImage } from 'react-bootstrap'

// what we want is that they supply a component that we turn into an upload button
// we need to return an error if the upload fails
// we need to report that the upload started
// we return the image id on success

export default function Upload ({ as: Component, onStarted, onError, onSuccess }) {
  const [getSignedPOST] = useMutation(
    gql`
      mutation getSignedPOST($type: String!, $size: Int!, $width: Int!, $height: Int!) {
        getSignedPOST(type: $type, size: $size, width: $width, height: $height) {
          url
          fields
        }
      }`)
  const ref = useRef()

  return (
    <>
      <input
        ref={ref}
        type='file'
        className='d-none'
        onChange={(e) => {
          if (e.target.files.length === 0) {
            return
          }

          onStarted && onStarted()

          const file = e.target.files[0]
          if (UPLOAD_TYPES_ALLOW.indexOf(file.type) === -1) {
            onError && onError(`image must be ${UPLOAD_TYPES_ALLOW.map(t => t.replace('image/', '')).join(', ')}`)
            return
          }
          const img = new Image()
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
        }}
      />
      <Component onClick={() => ref.current?.click()} />
    </>
  )
}

export function UploadExample () {
  const [error, setError] = useState()
  const [key, setKey] = useState()
  const [uploading, setUploading] = useState()

  const Component = uploading
    ? ({ onClick }) => <Moon className='fill-grey spin' onClick={onClick} />
    : ({ onClick }) => <AddImage className='fill-grey' onClick={onClick} />

  return (
    <>
      <Upload
        onError={e => {
          setUploading(false)
          setError(e)
        }}
        onSuccess={key => {
          setUploading(false)
          setKey(key)
        }}
        onStarted={() => {
          setError(false)
          setUploading(true)
        }}
        as={Component}
      />
      <div>
        {key && <BImage src={`https://sn-mtest.s3.amazonaws.com/${key}`} width='100%' />}
        {error && <div>{error}</div>}
      </div>
    </>
  )
}
