import { getGetServerSideProps } from '@/api/ssrApollo'
import { Form, ClientInput, ClientCheckbox, PasswordInput } from '@/components/form'
import { CenterLayout } from '@/components/layout'
import { WalletSecurityBanner } from '@/components/banners'
import { WalletLogs } from '@/components/wallet-logger'
import { useToast } from '@/components/toast'
import { useRouter } from 'next/router'
import { useWallet, Status } from '@/components/wallet'
import Info from '@/components/info'
import Text from '@/components/text'
import { AutowithdrawSettings } from '@/components/autowithdraw-shared'
import dynamic from 'next/dynamic'

const WalletButtonBar = dynamic(() => import('@/components/wallet-buttonbar.js'), { ssr: false })

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletSettings () {
  const toaster = useToast()
  const router = useRouter()
  const { wallet: name } = router.query
  const wallet = useWallet(name)

  const initial = wallet.fields.reduce((acc, field) => {
    // we still need to run over all wallet fields via reduce
    // even though we use wallet.config as the initial value
    // since wallet.config is empty when wallet is not configured
    return {
      ...acc,
      [field.name]: wallet.config?.[field.name] || ''
    }
  }, wallet.config)

  return (
    <CenterLayout>
      <h2 className='pb-2'>{wallet.card.title}</h2>
      <h6 className='text-muted text-center pb-3'>{wallet.card.subtitle}</h6>
      <WalletSecurityBanner />
      <Form
        initial={initial}
        schema={wallet.schema}
        onSubmit={async ({ enabled, ...values }) => {
          try {
            const newConfig = !wallet.isConfigured

            // enable wallet if wallet was just configured
            // local wallets use 'enabled' property
            // server wallets use 'priority' property
            // TODO: make both wallet types use 'priority' property
            if (newConfig) {
              values.priority = true
              enabled = true
            }

            await wallet.save(values)

            if (enabled) wallet.enable()
            else wallet.disable()

            toaster.success('saved settings')
            router.push('/settings/wallets')
          } catch (err) {
            console.error(err)
            const message = 'failed to attach: ' + err.message || err.toString?.()
            toaster.danger(message)
          }
        }}
      >
        <WalletFields wallet={wallet} />
        {wallet.server
          ? <AutowithdrawSettings wallet={wallet} />
          : (
            <ClientCheckbox
              disabled={!wallet.isConfigured}
              initialValue={wallet.status === Status.Enabled}
              label='enabled'
              name='enabled'
            />
            )}
        <WalletButtonBar
          wallet={wallet} onDelete={async () => {
            try {
              wallet.delete()
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

function WalletFields ({ wallet: { config, fields } }) {
  return fields.map(({ name, label, type, help, optional, hint, ...props }, i) => {
    const rawProps = {
      ...props,
      name,
      initialValue: config?.[name],
      label: (
        <div className='d-flex align-items-center'>
          {label}
          {/* help can be a string or object to customize the label */}
          {help && (
            <Info label={help.label || 'help'}>
              <Text>{help.text || help}</Text>
            </Info>
          )}
          {optional && (
            <small className='text-muted ms-2'>
              {typeof optional === 'boolean' ? 'optional' : optional}
            </small>
          )}
        </div>
      ),
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
