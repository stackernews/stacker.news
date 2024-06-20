import { getGetServerSideProps } from '@/api/ssrApollo'
import { Form, ClientInput, ClientCheckbox, PasswordInput } from '@/components/form'
import { CenterLayout } from '@/components/layout'
import { WalletButtonBar } from '@/components/wallet-card'
import { lnbitsSchema } from '@/lib/validate'
import { WalletSecurityBanner } from '@/components/banners'
import { WalletLogs } from '@/components/wallet-logger'
import { useToast } from '@/components/toast'
import { useRouter } from 'next/router'
import { useWallet } from '@/components/wallet'

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
  }, {
    isDefault: wallet.isDefault || false
  })

  return (
    <CenterLayout>
      <h2 className='pb-2'>{wallet.card.title}</h2>
      <h6 className='text-muted text-center pb-3'>use {wallet.card.title} for payments</h6>
      <WalletSecurityBanner />
      <Form
        initial={initial}
        schema={lnbitsSchema}
        onSubmit={async ({ isDefault, ...values }) => {
          try {
            await wallet.validate(values)
            wallet.saveConfig(values)
            wallet.enable()
            toaster.success('saved settings')
            router.push('/settings/wallets')
          } catch (err) {
            console.error(err)
            toaster.danger('failed to attach: ' + err.message || err.toString?.())
          }
        }}
      >
        <WalletFields wallet={wallet} />
        <ClientCheckbox
          disabled={false}
          initialValue={false}
          label='default payment method'
          name='isDefault'
        />
        <WalletButtonBar
          wallet={wallet} onDelete={async () => {
            try {
              wallet.clearConfig()
              toaster.success('saved settings')
              router.push('/settings/wallets')
            } catch (err) {
              console.error(err)
              toaster.danger('failed to detach: ' + err.message || err.toString?.())
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
  return fields.map(({ name, label, type }, i) => {
    const props = {
      initialValue: config?.[name],
      label,
      name,
      required: true,
      autoFocus: i === 0
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
