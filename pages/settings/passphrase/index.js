import { getGetServerSideProps } from '@/api/ssrApollo'
import Layout from '@/components/layout'
import { SettingsHeader } from '../index'
import { useVaultConfigurator } from '@/components/vault/use-vault-configurator'
import { useMe } from '@/components/me'
import { Button, InputGroup } from 'react-bootstrap'
import bip39Words from '@/lib/bip39-words'
import { Form, PasswordInput, SubmitButton } from '@/components/form'
import { deviceSyncSchema } from '@/lib/validate'
import RefreshIcon from '@/svgs/refresh-line.svg'
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/toast'
import { useWalletVault } from '@/wallets/client/hooks'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function DeviceSync ({ ssrData }) {
  const { me } = useMe()
  const { onVaultKeySet, beforeDisconnectVault } = useWalletVault()
  const { key, setVaultKey, clearVault, disconnectVault } =
    useVaultConfigurator({ onVaultKeySet, beforeDisconnectVault })
  const [passphrase, setPassphrase] = useState()

  const setSeedPassphrase = useCallback(async (passphrase) => {
    await setVaultKey(passphrase)
    setPassphrase(passphrase)
  }, [setVaultKey])

  const enabled = !!me?.privates?.vaultKeyHash
  const connected = !!key

  return (
    <Layout>
      <div className='pb-3 w-100 mt-2'>
        <SettingsHeader />
        <small className='line-height-md d-block mt-3' style={{ maxWidth: '600px' }}>
          <p>
            Device sync uses end-to-end encryption to securely synchronize your data across devices.

            Your sensitive data remains private and inaccessible to our servers while being synced across all your connected devices using only a passphrase.
          </p>
        </small>
        <div className='mt-4' style={{ maxWidth: '600px' }}>
          {
            (connected && passphrase && <Connect passphrase={passphrase} />) ||
            (connected && <Connected disconnectVault={disconnectVault} />) ||
            (enabled && <Enabled setVaultKey={setVaultKey} clearVault={clearVault} />) ||
              <Setup setSeedPassphrase={setSeedPassphrase} />
          }
        </div>
      </div>
    </Layout>
  )
}

function Connect ({ passphrase }) {
  return (
    <div>
      <h2>Connect other devices</h2>
      <p className='line-height-md'>
        On your other devices, navigate to device sync settings and enter this exact passphrase.
      </p>
      <p className='line-height-md'>
        <strong>Once you leave this page, this passphrase cannot be shown again.</strong> Connect all the devices you plan to use or write this passphrase down somewhere safe.
      </p>
      <PasswordInput
        label='passphrase'
        name='passphrase'
        placeholder=''
        required
        autoFocus
        as='textarea'
        value={passphrase}
        noForm
        rows={3}
        readOnly
        copy
        qr
      />
    </div>
  )
}

function Connected ({ disconnectVault }) {
  return (
    <div>
      <h2>Device sync is enabled!</h2>
      <p>
        Sensitive data on this device is now securely synced between all connected devices.
      </p>
      <p className='text-muted text-sm'>
        Disconnect to prevent this device from syncing data or to reset your passphrase.
      </p>
      <div className='d-flex justify-content-between'>
        <div className='d-flex align-items-center ms-auto gap-2'>
          <Button
            variant='primary'
            onClick={disconnectVault}
          >disconnect
          </Button>
        </div>
      </div>
    </div>
  )
}

function Enabled ({ setVaultKey, clearVault }) {
  const toaster = useToast()
  return (
    <div>
      <h2>Device sync is enabled</h2>
      <p className='line-height-md'>
        This device is not connected. Enter or scan your passphrase to connect. If you've lost your passphrase you may reset it.
      </p>
      <Form
        schema={deviceSyncSchema}
        initial={{ passphrase: '' }}
        enableReinitialize
        onSubmit={async ({ passphrase }) => {
          try {
            await setVaultKey(passphrase)
          } catch (e) {
            console.error(e)
            toaster.danger('error setting vault key')
          }
        }}
      >
        <PasswordInput
          label='passphrase'
          name='passphrase'
          placeholder=''
          required
          autoFocus
          qr
        />
        <div className='mt-3'>
          <div className='d-flex justify-content-between align-items-center'>
            <Button variant='danger' onClick={clearVault}>reset</Button>
            <SubmitButton variant='primary'>enable</SubmitButton>
          </div>
        </div>
      </Form>
    </div>
  )
}

const generatePassphrase = (n = 12) => {
  const rand = new Uint32Array(n)
  window.crypto.getRandomValues(rand)
  return Array.from(rand).map(i => bip39Words[i % bip39Words.length]).join(' ')
}

function Setup ({ setSeedPassphrase }) {
  const [passphrase, setPassphrase] = useState()
  const toaster = useToast()
  const newPassphrase = useCallback(() => {
    setPassphrase(() => generatePassphrase(12))
  }, [])

  useEffect(() => {
    setPassphrase(() => generatePassphrase(12))
  }, [])

  return (
    <div>
      <h2>Enable device sync</h2>
      <p>
        Enable secure sync of sensitive data (like wallet credentials) between your devices.
      </p>
      <p className='text-muted text-sm line-height-md'>
        After enabled, your passphrase can be used to connect other devices.
      </p>
      <Form
        schema={deviceSyncSchema}
        initial={{ passphrase }}
        enableReinitialize
        onSubmit={async ({ passphrase }) => {
          try {
            await setSeedPassphrase(passphrase)
          } catch (e) {
            console.error(e)
            toaster.danger('error setting passphrase')
          }
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
          readOnly
          append={
            <InputGroup.Text style={{ cursor: 'pointer', userSelect: 'none' }} onClick={newPassphrase}>
              <RefreshIcon width={16} height={16} />
            </InputGroup.Text>
          }
        />
        <div className='mt-3'>
          <div className='d-flex justify-content-between'>
            <div className='d-flex align-items-center ms-auto gap-2'>
              <SubmitButton variant='primary'>enable</SubmitButton>
            </div>
          </div>
        </div>
      </Form>
    </div>
  )
}
