import { getGetServerSideProps } from '../../../api/ssrApollo'
import { Form, Input } from '../../../components/form'
import { CenterLayout } from '../../../components/layout'
import { WalletButtonBar, WalletCard } from '../../../components/wallet-card'
import { lnbitsSchema } from '../../../lib/validate'
import { useToast } from '../../../components/toast'
import { useRouter } from 'next/router'
import { useWebLN } from '../../../components/webln'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function LNbits () {
  const { config, setConfig, clearConfig, isEnabled } = useWebLN('lnbits')
  const toaster = useToast()
  const router = useRouter()

  return (
    <CenterLayout>
      <h2 className='pb-2'>lnbits</h2>
      <h6 className='text-muted text-center pb-3'>use lnbits for zapping</h6>
      <Form
        // FIXME initial values are empty since we config is initialized after first render
        initial={{
          url: config?.url || '',
          adminKey: config?.adminKey || ''
        }}
        schema={lnbitsSchema}
        onSubmit={async (values) => {
          try {
            await setConfig(values)
            toaster.success('saved settings')
            router.push('/settings/wallets')
          } catch (err) {
            console.error(err)
            toaster.danger('failed to attach:' + err.message || err.toString?.())
          }
        }}
      >
        <Input
          label='lnbits url'
          name='url'
          required
          autoFocus
        />
        <Input
          type='password'
          autoComplete='false'
          label='admin key'
          name='adminKey'
        />
        <WalletButtonBar
          enabled={isEnabled} onDelete={async () => {
            try {
              await clearConfig()
              toaster.success('saved settings')
              router.push('/settings/wallets')
            } catch (err) {
              console.error(err)
              toaster.danger('failed to unattach:' + err.message || err.toString?.())
            }
          }}
        />
      </Form>
    </CenterLayout>
  )
}

export function LNbitsCard () {
  const { isEnabled } = useWebLN('lnbits')
  return (
    <WalletCard
      title='lnbits'
      badges={['send only', 'non-custodialish']}
      provider='lnbits'
      enabled={isEnabled}
    />
  )
}
