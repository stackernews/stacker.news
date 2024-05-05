import { getGetServerSideProps } from '@/api/ssrApollo'
import { Form, ClientInput, ClientCheckbox, PasswordInput } from '@/components/form'
import { CenterLayout } from '@/components/layout'
import { WalletButtonBar, WalletCard, isConfigured } from '@/components/wallet-card'
import { lnbitsSchema } from '@/lib/validate'
import { useToast } from '@/components/toast'
import { useRouter } from 'next/router'
import { useLNbits } from '@/components/webln/lnbits'
import { WalletSecurityBanner } from '@/components/banners'
import { useWebLNConfigurator } from '@/components/webln'
import WalletLogs from '@/components/wallet-logs'
import { Wallet } from '@/lib/constants'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function LNbits () {
  const { provider, enabledProviders, setProvider } = useWebLNConfigurator()
  const lnbits = useLNbits()
  const { name, url, adminKey, saveConfig, clearConfig, status } = lnbits
  const isDefault = provider?.name === name
  const configured = isConfigured(status)
  const toaster = useToast()
  const router = useRouter()

  return (
    <CenterLayout>
      <h2 className='pb-2'>LNbits</h2>
      <h6 className='text-muted text-center pb-3'>use LNbits for payments</h6>
      <WalletSecurityBanner />
      <Form
        initial={{
          url: url || '',
          adminKey: adminKey || '',
          isDefault: isDefault || false
        }}
        schema={lnbitsSchema}
        onSubmit={async ({ isDefault, ...values }) => {
          try {
            await saveConfig(values)
            if (isDefault) setProvider(lnbits)
            toaster.success('saved settings')
            router.push('/settings/wallets')
          } catch (err) {
            console.error(err)
            toaster.danger('failed to attach: ' + err.message || err.toString?.())
          }
        }}
      >
        <ClientInput
          initialValue={url}
          label='lnbits url'
          name='url'
          required
          autoFocus
        />
        <PasswordInput
          initialValue={adminKey}
          label='admin key'
          name='adminKey'
          newPass
          required
        />
        <ClientCheckbox
          disabled={!configured || isDefault || enabledProviders.length === 1}
          initialValue={isDefault}
          label='default payment method'
          name='isDefault'
        />
        <WalletButtonBar
          status={status} onDelete={async () => {
            try {
              await clearConfig()
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
        <WalletLogs wallet={Wallet.LNbits} embedded />
      </div>
    </CenterLayout>
  )
}

export function LNbitsCard () {
  const { status } = useLNbits()
  return (
    <WalletCard
      title='LNbits'
      badges={['send only', 'non-custodialish']}
      provider='lnbits'
      status={status}
    />
  )
}
