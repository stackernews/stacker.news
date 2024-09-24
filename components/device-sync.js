import { useCallback, useEffect, useState } from 'react'
import { useMe } from './me'
import { useShowModal } from './modal'
import useVault, { useVaultConfigurator, useVaultMigration } from './use-vault'
import { Button } from 'react-bootstrap'
import { Form, Input, PasswordInput, SubmitButton } from './form'
import { useFormikContext } from 'formik'
import bip39Words from '@/lib/bip39-words'
import Info from './info'
import CancelButton from './cancel-button'
import * as yup from 'yup'

export default function DeviceSync () {
  const { me } = useMe()
  const [value, setVaultKey, clearVault, disconnectVault] = useVaultConfigurator()
  const showModal = useShowModal()

  const enabled = !!me?.privates?.vaultKeyHash
  const connected = !!value?.key

  const migrate = useVaultMigration()

  // TODO: remove
  const [conf, setConf, clearConf] = useVault('test-debug')

  const manage = useCallback(async () => {
    if (enabled && connected) {
      showModal((onClose) => (
        <div>
          <h2>Device sync is enabled!</h2>
          <p>
            Sensitive data (like wallet credentials) is now securely synced between all connected devices.
            Use this passphrase on other devices to connect them.
          </p>
          <p className='text-muted text-sm'>
            The passphrase is stored on your device and is never sent to our server.
          </p>
          <Form
            initial={{ passphrase: value?.passphrase || '' }}
          >
            <PasswordInput
              label='Keep this passphrase safe'
              type='password'
              name='passphrase'
              readOnly
              qr
            />
          </Form>
          <div className='d-flex justify-content-between'>
            <div className='d-flex align-items-center ms-auto gap-2'>
              <Button className='me-2 text-muted nav-link fw-bold' variant='link' onClick={onClose}>close</Button>
              <Button
                variant='danger'
                onClick={reset}
              >reset
              </Button>
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
        <ConnectForm onClose={onClose} onReset={reset} onConnect={onConnect} enabled={enabled} />
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
          This will delete all encrypted data on the server and disconnect all devices by deleting the passphrase on each.
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
            Device Sync uses end-to-end encryption to securely synchronize your data across devices.
          </p>
          <p className='text-muted text-sm'>
            Your sensitive settings remain private and inaccessible to our servers while being synced across all your connected devices using only a passphrase.
          </p>
        </Info>
      </div>
      <div className='mt-4'>
        <h4>Debug Buttons (TODO: remove from final release)</h4>
        <Button onClick={() => {
          const input = window.prompt('value')
          setConf(input)
        }}
        >set
        </Button>
        <Button onClick={() => clearConf()}>unset</Button>
        <Button onClick={() => window.alert(conf)}>show</Button>
      </div>
    </>
  )
}

function PassphraseGeneratorButton () {
  const formik = useFormikContext()
  const generatePassphrase = (n = 12) => {
    const rand = new Uint32Array(n)
    window.crypto.getRandomValues(rand)
    return Array.from(rand).map(i => bip39Words[i % bip39Words.length]).join(' ')
  }
  return (
    <>
      <Button
        variant='info'
        onClick={() => {
          const pass = generatePassphrase()
          formik.setFieldValue('passphrase', pass)
        }}
      >
        generate random passphrase
      </Button>
    </>
  )
}

function ConnectForm ({ onClose, onConnect, onReset, enabled }) {
  const [passphrase, setPassphrase] = useState('')

  useEffect(() => {
    const scannedPassphrase = window.localStorage.getItem('qr:passphrase')
    if (scannedPassphrase) {
      setPassphrase(scannedPassphrase)
      window.localStorage.removeItem('qr:passphrase')
    }
  })

  return (
    <div>
      <h2>{!enabled ? 'Create a' : 'Input your'} Passphrase</h2>
      <p>
        {!enabled
          ? 'Enter a passphrase to securely sync sensitive data (like wallet credentials) between your devices. You’ll need to enter this passphrase on each device you want to connect.'
          : 'Enter the passphrase you used during setup to access your encrypted sensitive data (like wallet credentials) on the server.'}
      </p>
      <Form
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
          label='Passphrase'
          name='passphrase'
          placeholder=''
          required
          autoFocus
          qr={enabled}
        />
        {!enabled && (
          <div className='d-flex justify-content-between mb-3'>
            <div className='d-flex align-items-center ms-auto'>
              <PassphraseGeneratorButton />
            </div>
          </div>
        )}
        <p className='text-muted text-sm'>
          {
            !enabled
              ? 'This passphrase is stored only on your device.'
              : 'If you have forgotten your passphrase, you can reset and start over.'
          }
        </p>
        <div className='mt-3'>
          <div className='d-flex justify-content-between'>
            <div className='d-flex align-items-center ms-auto gap-2'>
              <CancelButton onClick={onClose} />
              {enabled && (
                <Button variant='danger' onClick={onReset}>reset</Button>
              )}
              <SubmitButton variant='primary'>connect</SubmitButton>
            </div>
          </div>
        </div>
      </Form>
    </div>
  )
}
