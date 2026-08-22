import { useEffect, useMemo, useState } from 'react'
import { useField } from 'formik'
import Eye from '@/svgs/eye-fill.svg'
import EyeClose from '@/svgs/eye-close-line.svg'
import QrScanIcon from '@/svgs/qr-scan-line.svg'
import { useShowModal } from '@/components/modal'
import { useToast } from '@/components/ui/toast'
import PageLoading from '@/components/page-loading'
import QrScanner from '@/components/qr-scanner'
import { cn } from '@/lib/cn'
import { InputAddon } from './input-addon'
import { ClientInput } from './input'
import { CopyButton } from './copy'
import styles from './field.module.css'

export function PasswordVisibilityIcon ({ visible, ...props }) {
  const Icon = visible ? EyeClose : Eye
  return <Icon {...props} />
}

function PasswordHider ({ onClick, showPass }) {
  return (
    <InputAddon
      style={{ cursor: 'pointer' }}
      onClick={onClick}
    >
      <PasswordVisibilityIcon
        visible={showPass}
        fill='var(--sn-body-color)'
        height={16}
        width={16}
      />
    </InputAddon>
  )
}

function PasswordScanner ({ onScan, text }) {
  const showModal = useShowModal()
  const toaster = useToast()

  return (
    <InputAddon
      style={{ cursor: 'pointer' }}
      onClick={() => {
        showModal(onClose => {
          return (
            <div>
              {text && <h5 className='leading-normal mb-6 text-center'>{text}</h5>}
              <QrScanner
                loading={<PageLoading />}
                onScan={([{ rawValue: result }]) => {
                  if (result) {
                    onScan(result)
                    onClose()
                  }
                }}
                styles={{
                  video: {
                    aspectRatio: '1 / 1'
                  }
                }}
                onError={(error) => {
                  if (error instanceof DOMException) {
                    console.log(error)
                  } else {
                    const message = error?.message || error?.toString?.() || 'unknown error'
                    toaster.danger(`qr scan: ${message}`)
                  }
                  onClose()
                }}
                components={{ audio: false }}
              />
            </div>
          )
        })
      }}
    >
      <QrScanIcon
        height={20} width={20} fill='var(--sn-body-color)'
      />
    </InputAddon>
  )
}

export function PasswordInput (props) {
  if (props.noForm) {
    return <StandalonePasswordInput {...props} />
  }

  return <FormikPasswordInput {...props} />
}

function StandalonePasswordInput ({ value: initialValue, noForm, ...props }) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  return (
    <PasswordInputBase
      {...props}
      noForm
      value={value}
      setValue={setValue}
    />
  )
}

function FormikPasswordInput (props) {
  const [field,, helpers] = useField(props)

  return (
    <PasswordInputBase
      {...props}
      value={field?.value}
      setValue={helpers.setValue}
    />
  )
}

function PasswordInputBase ({ newPass, qr, copy, readOnly, append, under, value, setValue, className, noForm, ...props }) {
  const [showPass, setShowPass] = useState(false)

  const Append = useMemo(() => {
    return (
      <>
        <PasswordHider showPass={showPass} onClick={() => setShowPass(!showPass)} />
        {copy && (
          <CopyButton icon value={value} />
        )}
        {qr && (
          <PasswordScanner
            text="Where'd you learn to square dance?"
            onScan={setValue}
          />
        )}
        {append}
      </>
    )
  }, [showPass, copy, value, setValue, qr, append])

  const style = props.style ? { ...props.style } : {}
  if (props.as === 'textarea') {
    if (!showPass) {
      style.WebkitTextSecurity = 'disc'
    } else {
      if (style.WebkitTextSecurity) delete style.WebkitTextSecurity
    }
  }
  return (
    <ClientInput
      {...props}
      noForm={noForm}
      style={style}
      className={cn(styles.passwordInput, className)}
      type={showPass ? 'text' : 'password'}
      autoComplete={newPass ? 'new-password' : 'current-password'}
      readOnly={readOnly}
      append={props.as === 'textarea' ? undefined : Append}
      value={value}
      under={
        props.as === 'textarea'
          ? (
            <>
              <div className='mt-2 flex justify-end' style={{ gap: '8px' }}>
                {Append}
              </div>
              {under}
            </>
            )
          : under
      }
    />
  )
}
