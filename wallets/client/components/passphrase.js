import React from 'react'
import { CopyButton } from '@/components/form'
import styles from '@/styles/wallet.module.css'

export function Passphrase ({ passphrase }) {
  const words = passphrase.trim().split(/\s+/)
  return (
    <>
      <p className='fw-bold line-height-md'>
        Make sure to copy your passphrase now.
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
      <div className='d-flex justify-content-end mt-3'>
        <CopyButton className='rounded' value={passphrase} variant='primary' />
      </div>
    </>
  )
}
