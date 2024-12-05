import { useCallback } from 'react'
import { useShowModal } from '@/components/modal'
import { validateTotp } from '@/lib/auth2fa'
import { qrImageSettings } from '@/components/qr'
import { QRCodeSVG } from 'qrcode.react'
import BootstrapForm from 'react-bootstrap/Form'
import { totpSchema, totpTokenSchema } from '@/lib/validate'
import { Form, SubmitButton, PasswordInput } from '@/components/form'
import { useToast } from '@/components/toast'
import CancelButton from './cancel-button'
import { SSR } from '@/lib/constants'
import { useMe } from '@/components/me'

export const useTOTPEnableDialog = () => {
  const showModal = useShowModal()
  const toaster = useToast()
  const showTOTPDialog = useCallback(({ secret, otpUri }, onToken) => {
    showModal((close) => {
      return (
        <Form
          initial={{
            secret: secret.base32,
            token: ''
          }}
          schema={totpSchema}
          onSubmit={async ({ token }) => {
            try {
              const verified = validateTotp({ secret: secret.base32, token })
              if (!verified) {
                toaster.danger('invalid code')
                return
              }
              await onToken(token)
              close()
            } catch (err) {
              console.error(err)
              toaster.danger('failed to enable ' + err.message)
            }
          }}
        >
          <div className='mb-4 text-center'>
            <BootstrapForm.Label>use a two-factor authenticator (TOTP) app to scan this qr code</BootstrapForm.Label>
            <div className='d-block p-3 mb-2 mx-auto' style={{ background: 'white', maxWidth: '300px' }}>
              <QRCodeSVG
                className='h-auto mw-100' value={otpUri} size={300} imageSettings={qrImageSettings}
              />
            </div>
            <PasswordInput name='secret' label='or use this setup key' as='textarea' readOnly copy />
          </div>
          <PasswordInput name='token' required label='input the one-time authentication code to confirm' />
          <div className='d-flex'>
            <CancelButton onClick={close} />
            <SubmitButton variant='primary' className='ms-auto mt-1 px-4'>enable</SubmitButton>
          </div>
        </Form>
      )
    })
  }, [])
  return showTOTPDialog
}

export const TOTPInputForm = ({ onSubmit, onCancel }) => {
  const toaster = useToast()
  return (
    <Form
      initial={{
        token: ''
      }}
      schema={totpTokenSchema}
      onSubmit={async ({ token }) => {
        try {
          await onSubmit(token)
        } catch (err) {
          console.error(err)
          toaster.danger(err.message)
        }
      }}
    >
      <h3>Two-factor Authentication</h3>
      <PasswordInput name='token' required label='input the one-time authentication code to continue' />
      <small className='text-muted'>
        open your two-factor authenticator (TOTP) app or browser extension to view your authentication code
      </small>
      <div className='d-flex mt-4'>
        <CancelButton onClick={onCancel} />
        <SubmitButton variant='primary' className='ms-auto mt-1 px-4'>submit</SubmitButton>
      </div>
    </Form>
  )
}

export const useTOTPDialog = () => {
  const showModal = useShowModal()
  const showTOTPDialog = useCallback((onToken, onClose) => {
    showModal((close) => {
      return (
        <TOTPInputForm
          onSubmit={
            (token) => {
              onToken(token)
              close()
            }
          }
          onCancel={close}
        />
      )
    }, { onClose })
  }, [])
  return showTOTPDialog
}

export const TOTPDialogProvider = ({ children }) => {
  const { me } = useMe()
  const totpDialog = useTOTPDialog()
  const hasTotp = me?.privates?.isTotpEnabled
  const showTOTPPrompt = useCallback(() => {
    if (!hasTotp) return Promise.resolve(null)
    return new Promise((resolve, reject) => {
      totpDialog((token) => {
        resolve({ method: 'totp', token })
      }, () => {
        reject(new Error('2fa required'))
      })
    })
  }, [me])
  if (!SSR) {
    if (!window.prompts2fa) window.prompts2fa = {}
    window.prompts2fa.totp = showTOTPPrompt
  }
  return children
}
