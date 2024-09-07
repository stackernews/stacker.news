import Layout from '@/components/layout'
import { SettingsHeader } from '../index'
import useVaultStorageState, { useVaultConfigState } from '@/components/use-user-vault-state'
import { useMe } from '@/components/me'
import { useShowModal } from '@/components/modal'
import CancelButton from '@/components/cancel-button'
import { Input, Form, SubmitButton, PasswordInput } from '@/components/form'
import Button from 'react-bootstrap/Button'
import { useToast } from '@/components/toast'
import { getGetServerSideProps } from '@/api/ssrApollo'
import DoubleCheck from '@/svgs/check-double-line.svg'
import Check from '@/svgs/check-line.svg'
import * as yup from 'yup'
import bip39Words from '@/lib/bip39-words'
import { useFormikContext } from 'formik'

import { useEffect, useCallback, useState } from 'react'
export const getServerSideProps = getGetServerSideProps({ authRequired: true })

function generatePassphrase (n = 12) {
  const rand = new Uint32Array(n)
  window.crypto.getRandomValues(rand)
  return Array.from(rand).map(i => bip39Words[i % bip39Words.length]).join(' ')
}

function PassphraseGeneratorButton () {
  const formik = useFormikContext()
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

export default function DeviceSync ({ ssrData }) {
  const me = useMe()
  const [value, setVaultKey, clearVault, disconnectVault] = useVaultConfigState()
  const showModal = useShowModal()
  const toaster = useToast()
  const [connected, setConnected] = useState(false)
  const [enabled, setEnabled] = useState(false)

  const [conf, setConf, clearConf] = useVaultStorageState('test-debug')

  useEffect(() => {
    setEnabled(!!me?.privates?.vaultKeyHash)
    setConnected(!!value?.key)
  }, [me?.privates?.vaultKeyHash, value])

  const inputPassphrase = useCallback(async (isNew) => {
    showModal((onClose) => (
      <div>
        <h2>{isNew ? 'Create a' : 'Input your'} Passphrase</h2>
        <p>
          {isNew
            ? 'Enter a passphrase to securely sync your data with other devices, you’ll need to enter this passphrase on each device you want to sync.'
            : 'Enter your passphrase to connect to your device sync.'}
        </p>
        <Form
          initial={{ passphrase: '' }}
          onSubmit={async values => {
            if (values.passphrase) {
              try {
                await setVaultKey(values.passphrase)
              } catch (e) {
                toaster.danger(e.message)
              }
              onClose()
            }
          }}
        >
          <PasswordInput
            label='Passphrase'
            name='passphrase'
            placeholder=''
            required
            autoFocus
          />
          {isNew && (
            <div className='d-flex justify-content-between mb-3'>
              <div className='d-flex align-items-center ms-auto'>
                <PassphraseGeneratorButton />
              </div>
            </div>
          )}

          <p className='text-muted text-sm'>
            {
              isNew
                ? 'We never have access to your passphrase, so make sure to store it safely.'
                : 'If you have forgotten your passphrase, you can reset your device sync and start over.'
            }
          </p>
          <div className='mt-3'>
            <div className='d-flex justify-content-between'>
              <div className='d-flex align-items-center ms-auto'>
                <CancelButton onClick={onClose} />
                <SubmitButton variant='primary'>
                  submit
                </SubmitButton>
              </div>
            </div>
          </div>
        </Form>
      </div>
    ))
  }, [])

  const resetPassphrase = useCallback(async () => {
    const schema = yup.object().shape({
      confirm: yup.string().oneOf(['yes'], 'You must confirm by typing "yes"').required('Confirmation is required')
    })
    showModal((onClose) => (
      <div>
        <h2>Reset device sync</h2>
        <p>
          Resetting your device sync will clear all your synced data and require you to set up a new passphrase.
          This action cannot be undone.
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
            label='Input `yes` if you want to reset your device sync'
            name='confirm'
            placeholder=''
            required
            autoFocus
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

  const showPassphrase = useCallback(async () => {
    showModal((onClose) => (
      <div>
        <h2>Your current passphrase</h2>
        <p>
          This is the passphrase configured in this device. You can copy it to your other devices to connect them to your device sync.
        </p>
        <p className='text-muted text-sm'>
          This passphrase is stored securely in your device and is never sent to our servers.
        </p>
        <Form
          initial={{ passphrase: value?.passphrase }}
        >
          <PasswordInput
            label='Keep this passphrase safe'
            type='password'
            name='passphrase'
          />
        </Form>
        <div className='d-flex justify-content-between'>
          <div className='d-flex align-items-center ms-auto'>
            <Button className='me-4 text-muted nav-link fw-bold' variant='link' onClick={onClose}>close</Button>
          </div>
        </div>
      </div>
    ))
  }, [value])

  return (
    <Layout>
      <div className='pb-3 w-100 mt-2'>
        <SettingsHeader />
        <div className='mb-4 text-muted'>
          <p>
            Device Sync uses end-to-end encryption to securely synchronize your data across devices.
          </p>
          <p className='text-muted text-sm'>
            Your sensitive settings remain private and inaccessible to our servers while being synced across all your connected devices using only a passphrase.
          </p>
        </div>
        {enabled
          ? (
              (connected
                ? (
                  <div className='d-flex flex-column gap-2'>
                    <p className='text-success'>
                      <DoubleCheck width='20' height='20' className='fill-success me-2' />
                      Device sync is enabled!
                    </p>
                    <div className='mt-3'>
                      <div className='d-flex justify-content-between'>
                        <div className='d-flex align-items-center ms-auto gap-2'>
                          <Button variant='danger' onClick={() => resetPassphrase()}>
                            reset
                          </Button>
                          <Button variant='warning' onClick={() => disconnectVault()}>
                            disconnect
                          </Button>
                          <Button variant='info' onClick={() => showPassphrase()}>
                            show passphrase
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  )
                : (
                  <div className='d-flex flex-column gap-2'>
                    <p className='text-warning'>
                      <Check width='20' height='20' className='fill-warning me-2' />
                      Device sync is enabled but your current device is not connected.
                    </p>
                    <div className='mt-3'>
                      <div className='d-flex justify-content-between'>
                        <div className='d-flex align-items-center ms-auto gap-2'>
                          <Button variant='danger' onClick={() => resetPassphrase()}>
                            reset
                          </Button>
                          <Button variant='warning' onClick={() => inputPassphrase()}>
                            connect
                          </Button>
                        </div>
                      </div>
                    </div>

                  </div>
                  )
              )
            )
          : (
            <div>
              <div className='mt-3'>
                <div className='d-flex justify-content-between'>
                  <div className='d-flex align-items-center ms-auto gap-2'>
                    <Button
                      onClick={() => inputPassphrase(true)}
                    >configure device sync
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            )}
      </div>
      <div>
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
    </Layout>
  )
}
