import QrScanner from '@/components/qr-scanner'
import { useToast } from '@/components/toast'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import sendStyles from './send.module.css'
import CameraIcon from '@/svgs/camera-line.svg'
import ClipboardIcon from '@/svgs/clipboard-line.svg'
import { useField } from 'formik'
import { useCallback, useEffect, useState } from 'react'
import classNames from 'classnames'
import { parseDestination } from './destination'
const styles = { ...sharedStyles, ...sendStyles }

export function DestinationActions ({ onValue }) {
  const [,, helpers] = useField('destination')
  const [scanning, setScanning] = useState(false)
  const [scannerError, setScannerError] = useState(null)
  const toaster = useToast()

  const setDestinationValue = useCallback((rawValue, source) => {
    const { value, type } = parseDestination(rawValue)
    if (!type) {
      toaster.danger(`${source}: not a bolt11 invoice or lightning address`)
      return false
    }
    helpers.setValue(value)
    onValue?.(value)
    return true
  }, [helpers, onValue, toaster])

  useEffect(() => {
    if (!scanning) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [scanning])

  const pasteDestination = useCallback(async () => {
    try {
      const value = await navigator.clipboard?.readText()
      if (!value) {
        toaster.danger('paste: clipboard is empty')
        return
      }
      setDestinationValue(value, 'paste')
    } catch (err) {
      console.log(err)
      toaster.danger('paste: clipboard unavailable')
    }
  }, [setDestinationValue, toaster])

  return (
    <>
      <div className={classNames(styles.invoiceActions, 'd-inline-flex align-items-center gap-3 w-fit-content mt-2')}>
        <button
          type='button'
          className={styles.textButton}
          onClick={() => {
            setScannerError(null)
            setScanning(true)
          }}
        >
          <CameraIcon height={18} width={18} />
          scan invoice
        </button>
        <button
          type='button'
          className={styles.textButton}
          onClick={pasteDestination}
        >
          <ClipboardIcon height={18} width={18} />
          paste
        </button>
      </div>
      {scanning && (
        <div className={styles.scannerOverlay}>
          <div className={styles.scannerHeader}>
            <button
              type='button'
              className={`modal-btn modal-close ${styles.scannerClose}`}
              onClick={() => setScanning(false)}
              aria-label='close scanner'
            >
              X
            </button>
          </div>
          <div className={styles.scannerStage}>
            {scannerError
              ? <div className={styles.scannerError}>{scannerError}</div>
              : (
                <>
                  <div className={styles.scannerViewport}>
                    <QrScanner
                      components={{ finder: false }}
                      styles={{
                        container: { width: '100%', height: '100%', aspectRatio: '1 / 1' },
                        video: { width: '100%', height: '100%', objectFit: 'cover' }
                      }}
                      onScan={([{ rawValue }]) => {
                        if (setDestinationValue(rawValue, 'qr scan')) setScanning(false)
                      }}
                      onError={(error) => {
                        if (error instanceof DOMException) {
                          console.log(error)
                          setScannerError('camera unavailable. check browser permissions and try again.')
                        } else {
                          const message = error?.message || error?.toString?.() || 'unknown error'
                          toaster.danger(`qr scan: ${message}`)
                          setScannerError(`qr scan: ${message}`)
                        }
                      }}
                    />
                    <div className={styles.scannerFrame} aria-hidden />
                  </div>
                  <div className={styles.scannerHint}>Got a QR in your sights?</div>
                </>)}
          </div>
        </div>
      )}
    </>
  )
}
