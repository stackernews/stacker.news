import React from 'react'
import { CopyButton } from '@/components/form'
import styles from '@/styles/wallet.module.css'

export function Passphrase ({
  passphrase,
  title = 'Readable backup',
  hint = 'Use this word list to quickly verify or write down the phrase.',
  showCopyButton = true
}) {
  const words = passphrase.trim().split(/\s+/)
  return (
    <div className={styles.passphraseSection}>
      <div className='d-flex justify-content-between align-items-start gap-3'>
        <div>
          <div className={styles.passphraseSectionTitle}>{title}</div>
          {hint && (
            <p className='text-muted mb-0 line-height-md'>
              {hint}
            </p>
          )}
        </div>
        {showCopyButton && (
          <CopyButton className='rounded flex-shrink-0' value={passphrase} variant='grey-medium' />
        )}
      </div>
      <div className={styles.passphrase}>
        {words.map((word, index) => (
          <div className='d-flex' key={index}>
            <span className='text-muted me-2'>{index + 1}.</span>
            <wbr />
            <span className='font-monospace text-break'>{word}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
