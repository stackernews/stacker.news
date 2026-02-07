import React, { useRef, useEffect } from 'react'
import { CopyButton } from '@/components/form'
import styles from '@/styles/wallet.module.css'

export function Passphrase ({ passphrase, username }) {
  const words = passphrase.trim().split(/\s+/)
  const formRef = useRef(null)

  // submit the hidden form after render to trigger password manager save prompt
  useEffect(() => {
    if (formRef.current) {
      // requestAnimationFrame ensures the DOM is painted before we submit
      window.requestAnimationFrame(() => {
        formRef.current?.requestSubmit()
      })
    }
  }, [])

  return (
    <>
      {/* hidden form to trigger password manager save prompt */}
      <form
        ref={formRef}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
        onSubmit={(e) => e.preventDefault()}
      >
        <input type='text' name='username' autoComplete='username' defaultValue={username || ''} readOnly tabIndex={-1} />
        <input type='password' name='password' autoComplete='new-password' defaultValue={passphrase} readOnly tabIndex={-1} />
      </form>
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
