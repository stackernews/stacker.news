import React, { useCallback } from 'react'
import Button from 'react-bootstrap/Button'
import { CopyButton } from '@/components/form'
import styles from '@/styles/wallet.module.css'

export function Passphrase ({ passphrase }) {
  const words = passphrase.trim().split(/\s+/)
  return (
    <>
      <p className='fw-bold line-height-md'>
        Make sure to save your passphrase now.
      </p>
      <p className='fw-bold line-height-md'>
        This is the only time we will show it to you.
      </p>
      <div
        className={styles.passphrase}
      >
        {words.map((word, index) => (
          <div className='d-flex' key={index}>
            <span className='text-muted me-2'>{index + 1}.</span>
            <wbr />
            <span className='font-monospace text-break'>{word}</span>
          </div>
        ))}
      </div>
      <div className='d-flex justify-content-center mt-3 gap-2 align-items-center'>
        <CopyButton className='rounded' value={passphrase} variant='primary' />
        <span className='text-muted'>or</span>
        <DownloadButton passphrase={passphrase} />
      </div>
    </>
  )
}

export default function DownloadButton ({ passphrase }) {
  const onClick = useCallback(() => {
    const filename = 'stacker-news-passphrase.txt'
    const value = `STACKER NEWS PASSPHRASE
-----------------------

Your passphrase to unlock your wallets on any device is:

${passphrase}

Please keep this passphrase safe and do not share it with anyone.
`
    download(filename, value)
  }, [passphrase])

  return (
    <Button
      className='rounded'
      variant='primary'
      onClick={onClick}
    >
      download
    </Button>
  )
}

function download (filename, value) {
  const blob = new Blob([value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
