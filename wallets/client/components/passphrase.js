import React, { useEffect, useState } from 'react'
import { CopyButton } from '@/components/form'
import { QRCodeSVG } from 'qrcode.react'
import styles from '@/styles/wallet.module.css'

export function Passphrase () {
  // TODO(wallet-v2): encrypt wallets with new key and show passphrase of new key
  const [passphrase] = useState(
    'media fit youth secret combine live cupboard response enable loyal kitchen angle'
  )

  useEffect(() => {
    // TODO(wallet-v2): encrypt wallets with new key
  }, [])

  if (!passphrase) {
    // TODO(wallet-v2): return skeleton
    return null
  }

  const words = passphrase.trim().split(/\s+/)

  return (
    <>
      <p className='fw-bold line-height-md'>
        Make sure to copy your passphrase now.
      </p>
      <p className='fw-bold line-height-md'>
        This is the only time we will show it to you.
      </p>
      <div className='d-flex justify-content-center'>
        <QRCodeSVG
          className='h-auto mx-auto mw-100 my-3' size={256} value={passphrase}
        />
      </div>
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
      <div className='d-flex justify-content-end mt-3'>
        <CopyButton className='rounded' value={passphrase} variant='primary' />
      </div>
    </>
  )
}
