import { getGetServerSideProps } from '@/api/ssrApollo'
import { Form, ClientInput, ClientCheckbox, PasswordInput } from '@/components/form'
import { CenterLayout } from '@/components/layout'
import { WalletButtonBar } from '@/components/wallet-card'
import { WalletSecurityBanner } from '@/components/banners'
import { WalletLogs } from '@/components/wallet-logger'
import { useToast } from '@/components/toast'
import { useRouter } from 'next/router'
import { useWallet, Status } from '@/components/wallet'
import Info from '@/components/info'
import Text from '@/components/text'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletSettings () {
  const toaster = useToast()
  const router = useRouter()
  const { wallet: name } = router.query
  const wallet = useWallet(name)

  const initial = wallet.fields.reduce((acc, field) => {
    return {
      ...acc,
      [field.name]: wallet.config?.[field.name] || ''
    }
  }, {})

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
            await wallet.save(values)
            // enable wallet if checkbox was set or if wallet was just configured
            if (enabled || newConfig) wallet.enable()
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
        <ClientCheckbox
          disabled={false}
          initialValue={wallet.status === Status.Enabled}
          label='enabled'
          name='enabled'
        />
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
  return fields.map(({ name, label, type, help, optional, hint }, i) => {
    const props = {
      initialValue: config?.[name],
      label: (
        <div className='d-flex align-items-center'>
          {label}
          {help && (
            <Info label='help'>
              <Text>{help}</Text>
            </Info>
          )}
          {optional && <small className='text-muted ms-2'>optional</small>}
        </div>
      ),
      name,
      required: !optional,
      autoFocus: i === 0,
      hint
    }
    if (type === 'text') {
      return <ClientInput key={i} {...props} />
    }
    if (type === 'password') {
      return <PasswordInput key={i} {...props} newPass />
    }
    return null
  })
}
