import { useRef, useState } from 'react'
import AvatarEditor from 'react-avatar-editor'
import { Button, Modal, Form as BootstrapForm } from 'react-bootstrap'
import Upload from './upload'
import EditImage from '../svgs/image-edit-fill.svg'
import Moon from '../svgs/moon-fill.svg'

export default function Avatar ({ onSuccess }) {
  const [uploading, setUploading] = useState()
  const [editProps, setEditProps] = useState()
  const ref = useRef()
  const [scale, setScale] = useState(1)

  return (
    <>
      <Modal
        show={!!editProps}
        onHide={() => setEditProps(null)}
      >
        <div className='modal-close' onClick={() => setEditProps(null)}>X</div>
        <Modal.Body className='text-right mt-1 p-4'>
          <AvatarEditor
            ref={ref} width={200} height={200}
            image={editProps?.file}
            scale={scale}
            style={{
              width: '100%',
              height: 'auto'
            }}
          />
          <BootstrapForm.Group controlId='formBasicRange'>
            <BootstrapForm.Control
              type='range' onChange={e => setScale(parseFloat(e.target.value))}
              min={1} max={2} step='0.05'
              defaultValue={scale} custom
            />
          </BootstrapForm.Group>
          <Button onClick={() => {
            ref.current.getImageScaledToCanvas().toBlob(blob => {
              if (blob) {
                editProps.upload(blob)
                setEditProps(null)
              }
            }, 'image/jpeg')
          }}
          >save
          </Button>
        </Modal.Body>
      </Modal>
      <Upload
        as={({ onClick }) =>
          <div className='position-absolute p-1 bg-dark pointer' onClick={onClick} style={{ bottom: '0', right: '0' }}>
            {uploading
              ? <Moon className='fill-white spin' />
              : <EditImage className='fill-white' />}
          </div>}
        onError={e => {
          console.log(e)
          setUploading(false)
        }}
        onSelect={(file, upload) => {
          setEditProps({ file, upload })
        }}
        onSuccess={async key => {
          onSuccess && onSuccess(key)
          setUploading(false)
        }}
        onStarted={() => {
          setUploading(true)
        }}
      />
    </>
  )
}
