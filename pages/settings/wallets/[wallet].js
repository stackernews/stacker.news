import { getGetServerSideProps } from '@/api/ssrApollo'
import { Form, ClientInput, PasswordInput, CheckboxGroup, Checkbox } from '@/components/form'
import { CenterLayout } from '@/components/layout'
import { WalletSecurityBanner } from '@/components/banners'
import { WalletLogs } from '@/components/wallet-logger'
import { useToast } from '@/components/toast'
import { useRouter } from 'next/router'
import { useWallet } from '@/wallets/index'
import Info from '@/components/info'
import Text from '@/components/text'
import { autowithdrawInitial, AutowithdrawSettings } from '@/components/autowithdraw-shared'
import { canReceive, canSend, isConfigured } from '@/wallets/common'
import { SSR } from '@/lib/constants'
import WalletButtonBar from '@/components/wallet-buttonbar'
import { useWalletConfigurator } from '@/wallets/config'
import { useCallback, useMemo } from 'react'
import { useMe } from '@/components/me'
import validateWallet from '@/wallets/validate'
import { ValidationError } from 'yup'
import { useFormikContext } from 'formik'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletSettings () {
  const toaster = useToast()
  const router = useRouter()
  const { wallet: name } = router.query
  const wallet = useWallet(name)
  const { me } = useMe()
  const { save, detach } = useWalletConfigurator(wallet)

  const initial = useMemo(() => {
    const initial = wallet?.def.fields.reduce((acc, field) => {
      // We still need to run over all wallet fields via reduce
      // even though we use wallet.config as the initial value
      // since wallet.config is empty when wallet is not configured.
      // Also, wallet.config includes general fields like
      // 'enabled' and 'priority' which are not defined in wallet.fields.
      return {
        ...acc,
        [field.name]: wallet?.config?.[field.name] || field.defaultValue || ''
      }
    }, wallet?.config)

    if (wallet?.def.fields.every(f => f.clientOnly)) {
      return initial
    }

    return {
      ...initial,
      ...autowithdrawInitial({ me })
    }
  }, [wallet, me])

  const validate = useCallback(async (data) => {
    try {
      await validateWallet(wallet.def, data,
        { yupOptions: { abortEarly: false }, topLevel: false, skipGenerated: true })
    } catch (error) {
      if (error instanceof ValidationError) {
        return error.inner.reduce((acc, error) => {
          acc[error.path] = error.message
          return acc
        }, {})
      }
      throw error
    }
  }, [wallet.def])

  const { card: { image, title, subtitle } } = wallet?.def || { card: {} }

  return (
    <CenterLayout>
      {image
        ? typeof image === 'object'
          ? <img {...image} alt={title} className='pb-2' />
          : <img src={image} width='33%' alt={title} className='pb-2' />
        : <h2 className='pb-2'>{title}</h2>}
      <h6 className='text-muted text-center pb-3'><Text>{subtitle}</Text></h6>
      <Form
        initial={initial}
        enableReinitialize
        validate={validate}
        onSubmit={async ({ amount, ...values }) => {
          try {
            const newConfig = !isConfigured(wallet)

            // enable wallet if wallet was just configured
            if (newConfig) {
              values.enabled = true
            }

            await save(values, values.enabled)

            toaster.success('saved settings')
            router.push('/settings/wallets')
          } catch (err) {
            console.error(err)
            toaster.danger(err.message || err.toString?.())
          }
        }}
      >
        <SendWarningBanner walletDef={wallet.def} />
        {wallet && <WalletFields wallet={wallet} />}
        <CheckboxGroup name='enabled'>
          <Checkbox
            disabled={!isConfigured(wallet)}
            label='enabled'
            name='enabled'
            groupClassName='mb-0'
          />
        </CheckboxGroup>
        <ReceiveSettings walletDef={wallet.def} />
        <WalletButtonBar
          wallet={wallet} onDelete={async () => {
            try {
              await detach()
              toaster.success('saved settings')
              router.push('/settings/wallets')
            } catch (err) {
              console.error(err)
              const message = 'failed to detach: ' + err.message || err.toString?.()
              toaster.danger(message)
            }
          }}
        />
      </Form>
      <div className='mt-3 w-100'>
        {wallet && <WalletLogs wallet={wallet} embedded />}
      </div>
    </CenterLayout>
  )
}

function SendWarningBanner ({ walletDef }) {
  const { values } = useFormikContext()
  if (!canSend({ def: walletDef, config: values }) || !walletDef.requiresConfig) return null

  return <WalletSecurityBanner />
}

function ReceiveSettings ({ walletDef }) {
  const { values } = useFormikContext()
  return canReceive({ def: walletDef, config: values }) && <AutowithdrawSettings />
}

function WalletFields ({ wallet }) {
  return wallet.def.fields
    .map(({
      name, label = '', type, help, optional, editable, requiredWithout,
      validate, clientOnly, serverOnly, generated, ...props
    }, i) => {
      const rawProps = {
        ...props,
        name,
        initialValue: wallet.config?.[name],
        readOnly: !SSR && isConfigured(wallet) && editable === false && !!wallet.config?.[name],
        groupClassName: props.hidden ? 'd-none' : undefined,
        label: label
          ? (
            <div className='d-flex align-items-center'>
              {label}
              {/* help can be a string or object to customize the label */}
              {help && (
                <Info label={help.label}>
                  <Text>{help.text || help}</Text>
                </Info>
              )}
              {optional && (
                <small className='text-muted ms-2'>
                  {typeof optional === 'boolean' ? 'optional' : <Text>{optional}</Text>}
                </small>
              )}
            </div>
            )
          : undefined,
        required: !optional,
        autoFocus: i === 0
      }
      if (type === 'text') {
        return <ClientInput key={i} {...rawProps} />
      }
      if (type === 'password') {
        return <PasswordInput key={i} {...rawProps} newPass />
      }
      return null
    })
}
