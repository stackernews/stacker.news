import { useRef, useState } from 'react'
import AvatarEditor from 'react-avatar-editor'
import Button from 'react-bootstrap/Button'
import BootstrapForm from 'react-bootstrap/Form'
import EditImage from '@/svgs/image-edit-fill.svg'
import Moon from '@/svgs/moon-fill.svg'
import { useShowModal } from './modal'
import { FileUpload } from './file-upload'
import { gql, useMutation } from '@apollo/client'

export default function Avatar ({ onSuccess }) {
  const [cropPhoto] = useMutation(gql`
    mutation cropPhoto($photoId: ID!, $cropData: CropData) {
      cropPhoto(photoId: $photoId, cropData: $cropData)
    }
  `)
  const [uploading, setUploading] = useState()
  const showModal = useShowModal()

  const Body = ({ onClose, file, onSave }) => {
    const [scale, setScale] = useState(1)
    const ref = useRef()

    return (
      <div className='text-end mt-1 p-4'>
        <AvatarEditor
          ref={ref} width={200} height={200}
          image={file}
          scale={scale}
          style={{
            width: '100%',
            height: 'auto'
          }}
        />
        <BootstrapForm.Group controlId='formBasicRange'>
          <BootstrapForm.Range
            onChange={e => setScale(parseFloat(e.target.value))}
            min={1} max={2} step='0.05'
            // defaultValue={scale}
          />
        </BootstrapForm.Group>
        <Button
          onClick={async () => {
            const rect = ref.current.getCroppingRect()
            const img = new window.Image()
            img.onload = async () => {
              const cropData = {
                ...rect,
                originalWidth: img.width,
                originalHeight: img.height,
                scale
              }
              // upload original to S3 along with crop data
              await onSave(cropData)
            }
            img.src = URL.createObjectURL(file)
            onClose()
          }}
        >save
        </Button>
      </div>
    )
  }

  const startCrop = async (file, upload) => {
    return new Promise((resolve, reject) =>
      showModal(onClose => (
        <Body
          onClose={() => {
            onClose()
            resolve()
          }}
          file={file}
          onSave={async (cropData) => {
            setUploading(true)
            try {
              // upload original to S3
              const photoId = await upload(file)

              // crop it
              const { data } = await cropPhoto({ variables: { photoId, cropData } })
              const res = await fetch(data.cropPhoto)
              const blob = await res.blob()

              // create a file from the blob
              const croppedImage = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })

              // upload the imgproxy cropped image
              const croppedPhotoId = await upload(croppedImage)

              onSuccess?.(croppedPhotoId)
              setUploading(false)
            } catch (e) {
              console.error(e)
              setUploading(false)
              reject(e)
            }
          }}
        />
      ))
    )
  }

  return (
    <FileUpload
      allow='image/*'
      avatar
      onError={e => {
        console.log(e)
        setUploading(false)
      }}
      onSelect={startCrop}
      onUpload={() => {
        setUploading(true)
      }}
    >
      <div className='position-absolute p-1 bg-dark pointer' style={{ bottom: '0', right: '0' }}>
        {uploading
          ? <Moon className='fill-white spin' />
          : <EditImage className='fill-white' />}
      </div>
    </FileUpload>
  )
}
