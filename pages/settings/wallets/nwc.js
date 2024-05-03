import { getGetServerSideProps } from '@/api/ssrApollo'
import { Form, ClientCheckbox, PasswordInput } from '@/components/form'
import { CenterLayout } from '@/components/layout'
import { WalletButtonBar, WalletCard, isConfigured } from '@/components/wallet-card'
import { nwcSchema } from '@/lib/validate'
import { useToast } from '@/components/toast'
import { useRouter } from 'next/router'
import { useNWC } from '@/components/webln/nwc'
import { WalletSecurityBanner } from '@/components/banners'
import { useWebLNConfigurator } from '@/components/webln'
import WalletLogs from '@/components/wallet-logs'
import { Wallet } from '@/lib/constants'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function NWC () {
  const { provider, enabledProviders, setProvider } = useWebLNConfigurator()
  const nwc = useNWC()
  const { name, nwcUrl, saveConfig, clearConfig, status } = nwc
  const isDefault = provider?.name === name
  const configured = isConfigured(status)
  const toaster = useToast()
  const router = useRouter()

  return (
    <CenterLayout>
      <h2 className='pb-2'>Nostr Wallet Connect</h2>
      <h6 className='text-muted text-center pb-3'>use Nostr Wallet Connect for payments</h6>
      <WalletSecurityBanner />
      <Form
        initial={{
          nwcUrl: nwcUrl || '',
          isDefault: isDefault || false
        }}
        schema={nwcSchema}
        onSubmit={async ({ isDefault, ...values }) => {
          try {
            await saveConfig(values)
            if (isDefault) setProvider(nwc)
            toaster.success('saved settings')
            router.push('/settings/wallets')
          } catch (err) {
            console.error(err)
            toaster.danger('failed to attach: ' + err.message || err.toString?.())
          }
        }}
      >
        <PasswordInput
          initialValue={nwcUrl}
          label='connection'
          name='nwcUrl'
          newPass
          required
          autoFocus
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
        <WalletLogs wallet={Wallet.NWC} embedded />
      </div>
    </CenterLayout>
  )
}

export function NWCCard () {
  const { status } = useNWC()
  return (
    <WalletCard
      title='NWC'
      badges={['send only', 'non-custodialish', 'budgetable']}
      provider='nwc'
      status={status}
    />
  )
}
