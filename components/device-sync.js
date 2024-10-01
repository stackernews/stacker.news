import { useCallback, useEffect, useState } from 'react'
import { useMe } from './me'
import { useShowModal } from './modal'
import { useVaultConfigurator, useVaultMigration } from './use-vault'
import { Button, InputGroup } from 'react-bootstrap'
import { Form, Input, PasswordInput, SubmitButton } from './form'
import bip39Words from '@/lib/bip39-words'
import Info from './info'
import CancelButton from './cancel-button'
import * as yup from 'yup'
import { deviceSyncSchema } from '@/lib/validate'
import RefreshIcon from '@/svgs/refresh-line.svg'

export default function DeviceSync () {
  const { me } = useMe()
  const [value, setVaultKey, clearVault, disconnectVault] = useVaultConfigurator()
  const showModal = useShowModal()

  const enabled = !!me?.privates?.vaultKeyHash
  const connected = !!value?.key

  const migrate = useVaultMigration()

  const manage = useCallback(async () => {
    if (enabled && connected) {
      showModal((onClose) => (
        <div>
          <h2>Device sync is enabled!</h2>
          <p>
            Sensitive data (like wallet credentials) is now securely synced between all connected devices.
          </p>
          <p className='text-muted text-sm'>
            Disconnect to prevent this device from syncing data or to reset your passphrase.
          </p>
          <div className='d-flex justify-content-between'>
            <div className='d-flex align-items-center ms-auto gap-2'>
              <Button className='me-2 text-muted nav-link fw-bold' variant='link' onClick={onClose}>close</Button>
              <Button
                variant='primary'
                onClick={() => {
                  disconnectVault()
                  onClose()
                }}
              >disconnect
              </Button>
            </div>
          </div>
        </div>
      ))
    } else {
      showModal((onClose) => (
        <ConnectForm onClose={onClose} onConnect={onConnect} enabled={enabled} />
      ))
    }
  }, [migrate, enabled, connected, value])

  const reset = useCallback(async () => {
    const schema = yup.object().shape({
      confirm: yup.string()
        .oneOf(['yes'], 'you must confirm by typing "yes"')
        .required('required')
    })
    showModal((onClose) => (
      <div>
        <h2>Reset device sync</h2>
        <p>
          This will delete all encrypted data on the server and disconnect all devices.
        </p>
        <p>
          You will need to enter a new passphrase on this and all other devices to sync data again.
        </p>
        <Form
          className='mt-3'
          initial={{ confirm: '' }}
          schema={schema}
          onSubmit={async values => {
            await clearVault()
            onClose()
          }}
        >
          <Input
            label='This action cannot be undone. Type `yes` to confirm.'
            name='confirm'
            placeholder=''
            required
            autoFocus
            autoComplete='off'
          />
          <div className='d-flex justify-content-between'>
            <div className='d-flex align-items-center ms-auto'>
              <CancelButton onClick={onClose} />
              <SubmitButton variant='danger'>
                continue
              </SubmitButton>
            </div>
          </div>
        </Form>
      </div>
    ))
  }, [])

  const onConnect = useCallback(async (values, formik) => {
    if (values.passphrase) {
      try {
        await setVaultKey(values.passphrase)
        await migrate()
      } catch (e) {
        formik?.setErrors({ passphrase: e.message })
        throw e
      }
    }
  }, [setVaultKey, migrate])

  return (
    <>
      <div className='form-label mt-3'>device sync</div>
      <div className='mt-2 d-flex align-items-center'>
        <div>
          <Button
            variant='secondary'
            onClick={manage}
          >
            {enabled ? (connected ? 'Manage ' : 'Connect to ') : 'Enable '}
            device sync
          </Button>
        </div>
        <Info>
          <p>
            Device sync uses end-to-end encryption to securely synchronize your data across devices.
          </p>
          <p className='text-muted text-sm'>
            Your sensitive data remains private and inaccessible to our servers while being synced across all your connected devices using only a passphrase.
          </p>
        </Info>
      </div>
      {enabled && !connected && (
        <div className='mt-2 d-flex align-items-center'>
          <div>
            <Button
              variant='danger'
              onClick={reset}
            >
              Reset device sync data
            </Button>
          </div>
          <Info>
            <p>
              If you have lost your passphrase or wish to erase all encrypted data from the server, you can reset the device sync data and start over.
            </p>
            <p className='text-muted text-sm'>
              This action cannot be undone.
            </p>
          </Info>
        </div>
      )}
    </>
  )
}

const generatePassphrase = (n = 12) => {
  const rand = new Uint32Array(n)
  window.crypto.getRandomValues(rand)
  return Array.from(rand).map(i => bip39Words[i % bip39Words.length]).join(' ')
}

function ConnectForm ({ onClose, onConnect, enabled }) {
  const [passphrase, setPassphrase] = useState(!enabled ? generatePassphrase : '')

  useEffect(() => {
    const scannedPassphrase = window.localStorage.getItem('qr:passphrase')
    if (scannedPassphrase) {
      setPassphrase(scannedPassphrase)
      window.localStorage.removeItem('qr:passphrase')
    }
  })

  const newPassphrase = useCallback(() => {
    setPassphrase(() => generatePassphrase(12))
  }, [])

  return (
    <div>
      <h2>{!enabled ? 'Enable device sync' : 'Input your passphrase'}</h2>
      <p>
        {!enabled
          ? 'Enable secure sync of sensitive data (like wallet credentials) between your devices. You’ll need to enter this passphrase on each device you want to connect.'
          : 'Enter the passphrase from device sync to access your encrypted sensitive data (like wallet credentials) on the server.'}
      </p>
      <Form
        schema={enabled ? undefined : deviceSyncSchema}
        initial={{ passphrase }}
        enableReinitialize
        onSubmit={async (values, formik) => {
          try {
            await onConnect(values, formik)
            onClose()
          } catch {}
        }}
      >
        <PasswordInput
          label='passphrase'
          name='passphrase'
          placeholder=''
          required
          autoFocus
          as='textarea'
          rows={3}
          readOnly={!enabled}
          copy={!enabled}
          append={
            !enabled && (
              <InputGroup.Text style={{ cursor: 'pointer', userSelect: 'none' }} onClick={newPassphrase}>
                <RefreshIcon width={16} height={16} />
              </InputGroup.Text>
            )
        }
        />
        <p className='text-muted text-sm'>
          {
            !enabled
              ? 'This passphrase is stored only on your device and cannot be shown again.'
              : 'If you have forgotten your passphrase, you can reset and start over.'
          }
        </p>
        <div className='mt-3'>
          <div className='d-flex justify-content-between'>
            <div className='d-flex align-items-center ms-auto gap-2'>
              <CancelButton onClick={onClose} />
              <SubmitButton variant='primary'>{enabled ? 'connect' : 'enable'}</SubmitButton>
            </div>
          </div>
        </div>
      </Form>
    </div>
  )
}
