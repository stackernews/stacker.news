import { getGetServerSideProps } from '@/api/ssrApollo'
import { Form, ClientInput, PasswordInput, CheckboxGroup, Checkbox } from '@/components/form'
import { CenterLayout } from '@/components/layout'
import { WalletSecurityBanner } from '@/components/banners'
import { WalletLogs } from '@/components/wallet-logger'
import { useToast } from '@/components/toast'
import { useRouter } from 'next/router'
import { useWallet } from 'wallets'
import Info from '@/components/info'
import Text from '@/components/text'
import { AutowithdrawSettings } from '@/components/autowithdraw-shared'
import dynamic from 'next/dynamic'
import { useIsClient } from '@/components/use-client'

const WalletButtonBar = dynamic(() => import('@/components/wallet-buttonbar.js'), { ssr: false })

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletSettings () {
  const toaster = useToast()
  const router = useRouter()
  const { wallet: name } = router.query
  const wallet = useWallet(name)

  const initial = wallet.fields.reduce((acc, field) => {
    // We still need to run over all wallet fields via reduce
    // even though we use wallet.config as the initial value
    // since wallet.config is empty when wallet is not configured.
    // Also, wallet.config includes general fields like
    // 'enabled' and 'priority' which are not defined in wallet.fields.
    return {
      ...acc,
      [field.name]: wallet.config?.[field.name] || ''
    }
  }, wallet.config)

  // check if wallet uses the form-level validation built into Formik or a Yup schema
  const validateProps = typeof wallet.fieldValidation === 'function'
    ? { validate: wallet.fieldValidation }
    : { schema: wallet.fieldValidation }

  return (
    <CenterLayout>
      <h2 className='pb-2'>{wallet.card.title}</h2>
      <h6 className='text-muted text-center pb-3'><Text>{wallet.card.subtitle}</Text></h6>
      {wallet.canSend && wallet.hasConfig > 0 && <WalletSecurityBanner />}
      <Form
        initial={initial}
        enableReinitialize
        {...validateProps}
        onSubmit={async ({ amount, ...values }) => {
          try {
            const newConfig = !wallet.isConfigured

            // enable wallet if wallet was just configured
            if (newConfig) {
              values.enabled = true
            }

            await wallet.save(values)

            toaster.success('saved settings')
            router.push('/settings/wallets')
          } catch (err) {
            console.error(err)
            toaster.danger(err.message || err.toString?.())
          }
        }}
      >
        <WalletFields wallet={wallet} />
        {wallet.walletType
          ? <AutowithdrawSettings wallet={wallet} />
          : (
            <CheckboxGroup name='enabled'>
              <Checkbox
                disabled={!wallet.isConfigured}
                label='enabled'
                name='enabled'
                groupClassName='mb-0'
              />
            </CheckboxGroup>
            )}
        <WalletButtonBar
          wallet={wallet} onDelete={async () => {
            try {
              await wallet.delete()
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
        <WalletLogs wallet={wallet} embedded />
      </div>
    </CenterLayout>
  )
}

function WalletFields ({ wallet: { config, fields, isConfigured } }) {
  const isClient = useIsClient()

  return fields
    .map(({ name, label = '', type, help, optional, editable, clientOnly, serverOnly, ...props }, i) => {
      const rawProps = {
        ...props,
        name,
        initialValue: config?.[name],
        readOnly: isClient && isConfigured && editable === false && !!config?.[name],
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
