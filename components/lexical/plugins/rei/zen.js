import carouselStyles from '@/components/carousel.module.css'
import { useShowModal } from '@/components/modal'
import { useCallback, useState } from 'react'
import styles from '@/components/lexical/styles/theme.module.css'

export default function ZenPlugin () {
  const showModal = useShowModal()

  const enterZen = useCallback(() => {
    showModal((close, setOptions) => {
      return <ZenModal close={close} setOptions={setOptions} />
    }, {
      fullScreen: true
    })
  }, [showModal])

  return (
    <div className={styles.zen} onClick={enterZen}>
      Zen
    </div>
  )
}

function ZenModal ({ close, setOptions }) {
  const [previewHtml, setPreviewHtml] = useState('')

  return (
    <div className={carouselStyles.fullScreenContainer}>
      {/* some zen content */}
      <div className='d-flex mx-auto align-items-center justify-content-center gap-4 w-50'>
        <div style={{ width: '930px' }}>
          {/* <LexicalEditor noForm setPreviewHtml={setPreviewHtml} /> */}
        </div>
        <div style={{ marginBottom: '80px' }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </div>
    </div>
  )
}
