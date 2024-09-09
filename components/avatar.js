import { useRef, useState } from 'react'
import AvatarEditor from 'react-avatar-editor'
import Button from 'react-bootstrap/Button'
import BootstrapForm from 'react-bootstrap/Form'
import EditImage from '@/svgs/image-edit-fill.svg'
import Moon from '@/svgs/moon-fill.svg'
import { useShowModal } from './modal'
import { ImageUpload } from './image-upload'

export default function Avatar ({ onSuccess }) {
  const [uploading, setUploading] = useState()
  const showModal = useShowModal()

  const Body = ({ onClose, file, upload }) => {
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
          onClick={() => {
            ref.current.getImageScaledToCanvas().toBlob(blob => {
              if (blob) {
                upload(blob)
                onClose()
              }
            }, 'image/jpeg')
          }}
        >save
        </Button>
      </div>
    )
  }

  return (
    <ImageUpload
      avatar
      onError={e => {
        console.log(e)
        setUploading(false)
      }}
      onSelect={(file, upload) => {
        return new Promise((resolve, reject) =>
          showModal(onClose => (
            <Body
              onClose={() => {
                onClose()
                resolve()
              }}
              file={file}
              upload={async (blob) => {
                await upload(blob)
                resolve(blob)
              }}
            />
          )))
      }}
      onSuccess={({ id }) => {
        onSuccess?.(id)
        setUploading(false)
      }}
      onUpload={() => {
        setUploading(true)
      }}
    >
      <div className='position-absolute p-1 bg-dark pointer' style={{ bottom: '0', right: '0' }}>
        {uploading
          ? <Moon className='fill-white spin' />
          : <EditImage className='fill-white' />}
      </div>
    </ImageUpload>
  )
}
