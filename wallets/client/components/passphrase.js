import { useEffect, useRef, useState } from 'react'
import { Button } from 'react-bootstrap'
import classNames from 'classnames'
import { useMe } from '@/components/me'
import { CopyButton, PasswordVisibilityIcon } from '@/components/form'
import { useShowModal } from '@/components/modal'
import { useToast } from '@/components/toast'
import { useIsClient } from '@/components/use-client'
import { useGenerateRandomKey, useKeySalt, useSetKey } from '@/wallets/client/hooks/crypto'
import { deriveKey, tokenizePassphrase as tokenize, PASSPHRASE_WORD_COUNT as WORD_COUNT } from '@/wallets/lib/crypto'
import { useSingleFlight } from '@/components/use-single-flight'
import { useDisablePassphraseExport, useWalletEncryptionUpdate, useWalletReset } from '@/wallets/client/hooks/query'
import { WalletDeletionConfirmation } from '@/wallets/client/components/form/wallet-delete'
import { WalletBottomBar } from '@/wallets/client/components/bottom-bar'
import bip39Words from '@/lib/bip39-words'
import { shuffleArray } from '@/lib/rand'
import shared from '@/wallets/client/components/wallet.module.css'
import styles from './passphrase.module.css'
import ClipboardIcon from '@/svgs/clipboard-line.svg'
import CheckIcon from '@/svgs/check-line.svg'
import ThumbDownIcon from '@/svgs/thumb-down-fill.svg'
import RefreshIcon from '@/svgs/refresh-line.svg'
import ForwardArrow from '@/svgs/arrow-right-line.svg'

// The challenge only gates UX, so the shared non-cryptographic shuffle is sufficient.
function buildChallenge (words) {
  const indices = shuffleArray(words.map((_, i) => i))

  // prefer positions with pairwise distinct words so every slot has exactly one right chip
  // (the phrase is sampled with replacement, so duplicate words happen)
  const positions = []
  for (const i of indices) {
    if (!positions.some(p => words[p] === words[i])) positions.push(i)
    if (positions.length === 3) break
  }
  positions.sort((a, b) => a - b)

  const decoys = shuffleArray(bip39Words.filter(word => !words.includes(word))).slice(0, 5)

  const bank = shuffleArray([...positions.map(p => words[p]), ...decoys])
  return { positions, bank }
}

function formatPosition (position) {
  return String(position + 1).padStart(2, '0')
}

function HideToggle ({ hidden, onToggle }) {
  return (
    <button type='button' className={shared.textButton} onClick={onToggle}>
      <PasswordVisibilityIcon visible={!hidden} className={styles.actionIcon} width={16} height={16} />
      {hidden ? 'show' : 'hide'}
    </button>
  )
}

function ResetPassphraseDialog ({ onCancel, onConfirm }) {
  return (
    <div className='leading-normal'>
      <h4>Reset wallets</h4>
      <p className='font-bold mt-4'>
        This will delete your sending wallet configurations. Your account, rewards, and CC balance will not be affected otherwise.
      </p>
      <p>
        After the reset, you will be issued a new passphrase.
      </p>
      <p className='text-danger font-bold'>If you have a Spark wallet, resetting without a backup will permanently lose access to its funds.</p>
      <WalletDeletionConfirmation onClose={onCancel} onConfirm={onConfirm} confirmText='reset' />
    </div>
  )
}

function PassphraseConfirmation ({
  words,
  onBack,
  onConfirm,
  saving,
  confirmText = 'Open my wallets'
}) {
  const [challenge] = useState(() => buildChallenge(words))
  const [confirmed, setConfirmed] = useState(0)
  const [confirmErrorCount, setConfirmErrorCount] = useState(0)
  const confirmedWords = challenge.positions.slice(0, confirmed).map(position => words[position])
  const done = confirmed === challenge.positions.length
  const activeSlot = confirmed
  const confirmError = confirmErrorCount > 0

  const onChipClick = (word) => {
    if (done) return
    if (word === words[challenge.positions[activeSlot]]) {
      setConfirmed(count => count + 1)
      setConfirmErrorCount(0)
    } else {
      setConfirmErrorCount(count => count + 1)
    }
  }

  return (
    <div className={classNames('w-full', shared.formStack, styles.passphraseFlow)}>
      <div className='text-center'>
        <h3 className={styles.headline}>Prove you wrote them down</h3>
        <p className={styles.subcopy}>Tap the word that belongs at each position.</p>
      </div>

      <div className={classNames(shared.stackSection, styles.confirmationSlots)}>
        {challenge.positions.map((position, slotIdx) => {
          const word = slotIdx < confirmed ? words[position] : null
          const isActive = !done && slotIdx === activeSlot
          return (
            <div
              key={position}
              className={classNames(
                shared.surfaceRow,
                styles.slotRow,
                isActive && shared.surfaceRowRing,
                isActive && confirmError && styles.slotError
              )}
            >
              <span className={styles.slotLabel}>word #{formatPosition(position)}</span>
              <span className={classNames(styles.slotValue, word === null && styles.slotPlaceholder)}>
                {word ?? (isActive ? 'tap a word below' : '—')}
              </span>
              {word !== null && <CheckIcon className={styles.slotCheck} width={18} height={18} />}
              {word === null && isActive && confirmError && (
                <ThumbDownIcon className={styles.slotErrorIcon} width={18} height={18} />
              )}
            </div>
          )
        })}
      </div>

      <div
        className={classNames(styles.confirmationError, confirmError && styles.confirmationErrorVisible)}
        role='status'
        aria-live='polite'
        aria-atomic='true'
      >
        {confirmError && (
          <span key={confirmErrorCount}>that's not word #{formatPosition(challenge.positions[activeSlot])}</span>
        )}
      </div>

      <div className='flex flex-wrap gap-2'>
        {challenge.bank.map(word => {
          const used = confirmedWords.includes(word)
          const unavailable = used || done
          return (
            <button
              key={word}
              type='button'
              className={classNames(
                shared.chip,
                styles.bankChip,
                used && styles.bankChipUsed,
                unavailable && styles.bankChipDisabled
              )}
              aria-disabled={unavailable}
              tabIndex={unavailable ? -1 : undefined}
              onClick={() => { if (!unavailable) onChipClick(word) }}
            >
              {word}
            </button>
          )
        })}
      </div>

      <WalletBottomBar onBack={onBack} backDisabled={saving} backText='back to passphrase'>
        <Button
          type='button'
          variant='primary'
          className={classNames(saving && 'pulse')}
          disabled={!done || saving}
          onClick={onConfirm}
        >
          {saving
            ? 'opening your wallets...'
            : <>{confirmText} <ForwardArrow className={styles.actionIcon} width={20} height={20} /></>}
        </Button>
      </WalletBottomBar>
    </div>
  )
}

export function WalletPassphrasePrompt ({ onSuccess }) {
  const { me } = useMe()
  const setKey = useSetKey()
  const disablePassphraseExport = useDisablePassphraseExport()
  const generateRandomKey = useGenerateRandomKey()
  const walletReset = useWalletReset()
  const hash = me?.privates?.vaultKeyHash ?? null
  const salt = useKeySalt()
  const showModal = useShowModal()
  const toaster = useToast()

  const [words, setWords] = useState(() => Array(WORD_COUNT).fill(''))
  const [hidden, setHidden] = useState(true)
  const [unlockError, setUnlockError] = useState({ message: '', count: 0 })
  const inputRefs = useRef([])
  const enteredCount = words.filter(Boolean).length
  const complete = enteredCount === WORD_COUNT

  // Use native password masking where the nonstandard CSS mask is unavailable.
  const maskSupported = useIsClient() && (window.CSS?.supports?.('-webkit-text-security', 'disc') ?? false)

  const focusSlot = (idx, caret) => {
    const input = inputRefs.current[idx]
    if (!input) return
    input.focus()
    const pos = caret === 'start' ? 0 : input.value.length
    input.setSelectionRange(pos, pos)
  }

  const clearUnlockError = () => {
    setUnlockError(error => error.message ? { ...error, message: '' } : error)
  }

  const reportUnlockError = (message) => {
    setUnlockError(error => ({ message, count: error.count + 1 }))
  }

  const setSlot = (index, value) => {
    setWords(previous => previous.map((word, i) => i === index ? value : word))
  }

  const fillSlots = (start, inputWords) => {
    if (start + inputWords.length > WORD_COUNT) {
      reportUnlockError('pasted words do not fit in the remaining slots')
      return false
    }

    clearUnlockError()
    setWords(previous => {
      const next = [...previous]
      inputWords.forEach((word, offset) => {
        next[start + offset] = word
      })
      return next
    })
    return true
  }

  const onSlotChange = (i, e) => {
    clearUnlockError()
    const value = e.target.value

    if (e.nativeEvent.isComposing) {
      setSlot(i, value)
      return
    }

    if (!/\s/.test(value)) {
      setSlot(i, value)
      return
    }

    const inputWords = tokenize(value)
    if (inputWords.length === 0) return setSlot(i, '')
    if (fillSlots(i, inputWords)) {
      focusSlot(Math.min(i + inputWords.length, WORD_COUNT - 1), 'start')
    }
  }

  const onSlotPaste = (i, e) => {
    const pastedWords = tokenize(e.clipboardData.getData('text'))
    if (pastedWords.length <= 1) return
    e.preventDefault()
    const start = pastedWords.length === WORD_COUNT ? 0 : i
    if (fillSlots(start, pastedWords)) {
      focusSlot(Math.min(start + pastedWords.length, WORD_COUNT - 1), 'start')
    }
  }

  const onSlotKeyDown = (i, e) => {
    // IMEs deliver real key values during composition (space = conversion key)
    if (e.nativeEvent.isComposing) return
    if (e.key === ' ') {
      e.preventDefault()
      if (words[i] && i < WORD_COUNT - 1) focusSlot(i + 1, 'start')
    } else if (e.key === 'Enter' && !complete) {
      e.preventDefault()
      if (words[i] && i < WORD_COUNT - 1) {
        focusSlot(i + 1, 'start')
      } else if (!complete) {
        focusSlot(words.findIndex(w => !w))
      }
    } else if (e.key === 'Backspace' && !words[i] && i > 0) {
      e.preventDefault()
      focusSlot(i - 1, 'end')
    }
  }

  const [unlock, unlocking] = useSingleFlight(async () => {
    try {
      const derived = await deriveKey(tokenize(words.join(' ')).join(' '), salt)
      if (hash !== derived.hash) {
        reportUnlockError('wrong passphrase')
        return
      }
      await setKey(derived, { updateServer: false })
      await onSuccess?.()
    } catch (err) {
      console.error('failed to unlock:', err)
      reportUnlockError(err.message || 'failed to unlock')
      return
    }
    disablePassphraseExport().catch(err => {
      console.error('failed to disable passphrase export:', err)
      toaster.warning('wallets unlocked, but failed to update passphrase state')
    })
  })

  const onSubmit = (e) => {
    e.preventDefault()
    if (complete) unlock()
  }

  const showResetPassphraseModal = () => {
    showModal(close => (
      <ResetPassphraseDialog
        onCancel={close}
        onConfirm={async () => {
          try {
            const { key, hash } = await generateRandomKey()
            await walletReset({ key, newKeyHash: hash })
            close()
          } catch (err) {
            console.error('failed to reset passphrase:', err)
            toaster.danger(err.message || 'failed to reset passphrase')
          }
        }}
      />
    ))
  }

  return (
    <form className={classNames('w-full', shared.formStack, styles.passphraseFlow)} onSubmit={onSubmit}>
      <div className='text-center'>
        <h3 className={styles.headline}>Enter your passphrase</h3>
        <p className={styles.subcopy}>
          Enter the twelve words you saved when you first set up wallets.
          Type each word in order, or paste the full phrase into any field.
        </p>
      </div>

      <div>
        <div className={styles.card}>
          <div className={styles.wordGrid}>
            {words.map((word, i) => (
              <div key={i} className={styles.wordCell}>
                <span className={styles.wordIndex}>{formatPosition(i)}</span>
                <input
                  ref={el => { inputRefs.current[i] = el }}
                  className={classNames('form-control', styles.slotInput, hidden && styles.slotInputMasked)}
                  type={hidden && !maskSupported ? 'password' : 'text'}
                  autoComplete='off'
                  autoCapitalize='none'
                  autoCorrect='off'
                  spellCheck={false}
                  enterKeyHint={i === WORD_COUNT - 1 ? 'go' : 'next'}
                  aria-label={`word ${i + 1}`}
                  autoFocus={i === 0}
                  value={word}
                  onChange={e => onSlotChange(i, e)}
                  onCompositionEnd={e => onSlotChange(i, e)}
                  onKeyDown={e => onSlotKeyDown(i, e)}
                  onPaste={e => onSlotPaste(i, e)}
                />
              </div>
            ))}
          </div>
        </div>
        <div className='d-flex align-items-center justify-content-between gap-2 flex-wrap mt-2'>
          <span className={styles.counter}>
            {enteredCount} / {WORD_COUNT} entered
          </span>
          <HideToggle hidden={hidden} onToggle={() => setHidden(h => !h)} />
        </div>
      </div>

      <div className='text-danger text-center small' role='status' aria-live='polite' aria-atomic='true'>
        <span key={unlockError.count}>{unlockError.message}</span>
      </div>

      <div className='d-flex justify-content-center'>
        <Button
          type='submit'
          variant='primary'
          className={classNames(unlocking && 'pulse')}
          disabled={!complete || unlocking}
        >
          {unlocking ? 'unlocking...' : 'unlock'}
        </Button>
      </div>

      <div className={styles.resetWallets}>
        <p className={styles.footnote}>
          No passphrase? You'll have to reset wallets and reconnect each one.
          Your stacker.news rewards and CC balance are safe either way.
        </p>
        <button
          type='button'
          className={styles.resetButton}
          onClick={showResetPassphraseModal}
        >
          reset wallets
        </button>
      </div>
    </form>
  )
}

export function WalletPassphraseSetup ({
  onBack,
  confirmText = 'Open my wallets'
} = {}) {
  const generateRandomKey = useGenerateRandomKey()
  const updateWalletEncryption = useWalletEncryptionUpdate()
  const toaster = useToast()

  const [candidate, setCandidate] = useState(null)
  const [generationError, setGenerationError] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (candidate || generationError) return

    let cancelled = false

    generateRandomKey()
      .then(nextCandidate => {
        if (!cancelled) setCandidate(nextCandidate)
      })
      .catch(err => {
        if (cancelled) return
        console.error('failed to generate passphrase:', err)
        setGenerationError(err)
      })

    return () => {
      cancelled = true
    }
  }, [candidate, generationError, generateRandomKey])

  const regenerate = () => {
    setCandidate(null)
    setGenerationError(null)
    setHidden(false)
  }

  const [savePassphrase, savingPassphrase] = useSingleFlight(async () => {
    try {
      await updateWalletEncryption({ key: candidate.key, hash: candidate.hash })
    } catch (err) {
      toaster.danger(err.message ? 'failed to save passphrase: ' + err.message : 'failed to save passphrase')
    }
  })

  if (generationError) {
    return (
      <div className='text-center'>
        <p className='line-height-md text-muted mt-4'>
          We could not generate a passphrase right now.
        </p>
        <div className='d-flex justify-content-center mt-3'>
          <Button variant='secondary' onClick={regenerate}>try again</Button>
        </div>
      </div>
    )
  }

  if (!candidate) {
    return <p className='line-height-md text-muted mt-4 text-center'>generating passphrase...</p>
  }

  const candidateWords = tokenize(candidate.passphrase)

  if (confirming) {
    return (
      <PassphraseConfirmation
        words={candidateWords}
        onBack={() => setConfirming(false)}
        onConfirm={savePassphrase}
        saving={savingPassphrase}
        confirmText={confirmText}
      />
    )
  }

  return (
    <div className={classNames('w-full', shared.formStack, styles.passphraseFlow)}>
      <div className='text-center'>
        <h3 className={styles.headline}>Your passphrase is shown once</h3>
        <p className={styles.subcopy}>
          These twelve words grant access to your wallets on Stacker News.
          We can't show them again or recover them for you.
        </p>
      </div>

      <div>
        <div className={styles.card}>
          <div className={classNames(styles.wordGrid, styles.wordGridFit)}>
            {candidateWords.map((word, i) => (
              <div key={i} className={styles.wordCell}>
                <span className={styles.wordIndex}>{formatPosition(i)}</span>
                <span className={styles.wordText}>{hidden ? '••••••' : word}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.cardActions}>
          <HideToggle hidden={hidden} onToggle={() => setHidden(h => !h)} />
          <button type='button' className={shared.textButton} onClick={regenerate}>
            <RefreshIcon className={styles.actionIcon} width={16} height={16} /> new words
          </button>
          <CopyButton
            value={candidate.passphrase}
            className={shared.textButton}
            append={<><ClipboardIcon className={styles.actionIcon} width={16} height={16} /> copy</>}
          />
        </div>
      </div>

      {onBack
        ? (
          <WalletBottomBar onBack={onBack} backText='back'>
            <Button type='button' variant='primary' onClick={() => setConfirming(true)}>
              I've saved them - continue
            </Button>
          </WalletBottomBar>
          )
        : (
          <div className='flex justify-center'>
            <Button type='button' variant='primary' onClick={() => setConfirming(true)}>
              I've saved them - continue
            </Button>
          </div>
          )}

      <p className={styles.footnote}>You'll confirm 3 of the 12 next.</p>
    </div>
  )
}
