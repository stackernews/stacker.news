import { getGetServerSideProps } from '@/api/ssrApollo'
import { Form, Input } from '@/components/form'
import { CenterLayout } from '@/components/layout'
import { useMe } from '@/components/me'
import { WalletButtonBar, WalletCard } from '@/components/wallet-card'
import { useApolloClient, useMutation } from '@apollo/client'
import { useToast } from '@/components/toast'
import { lnAddrAutowithdrawSchema } from '@/lib/validate'
import { useRouter } from 'next/router'
import { AutowithdrawSettings, autowithdrawInitial } from '@/components/autowithdraw-shared'
import { REMOVE_WALLET, UPSERT_WALLET_LNADDR, WALLET_BY_TYPE } from '@/fragments/wallet'
import WalletLogs from '@/components/wallet-logs'

const variables = { type: 'LIGHTNING_ADDRESS' }
export const getServerSideProps = getGetServerSideProps({ query: WALLET_BY_TYPE, variables, authRequired: true })

export default function LightningAddress ({ ssrData }) {
  const me = useMe()
  const toaster = useToast()
  const router = useRouter()
  const client = useApolloClient()
  const [upsertWalletLNAddr] = useMutation(UPSERT_WALLET_LNADDR, {
    refetchQueries: ['WalletLogs'],
    onError: (err) => {
      client.refetchQueries({ include: ['WalletLogs'] })
      throw err
    }
  })
  const [removeWallet] = useMutation(REMOVE_WALLET, {
    refetchQueries: ['WalletLogs'],
    onError: (err) => {
      client.refetchQueries({ include: ['WalletLogs'] })
      throw err
    }
  })

  const { walletByType: wallet } = ssrData || {}

  return (
    <CenterLayout>
      <h2 className='pb-2'>lightning address</h2>
      <h6 className='text-muted text-center pb-3'>autowithdraw to a lightning address</h6>
      <Form
        initial={{
          address: wallet?.wallet?.address || '',
          ...autowithdrawInitial({ me, priority: wallet?.priority })
        }}
        schema={lnAddrAutowithdrawSchema({ me })}
        onSubmit={async ({ address, ...settings }) => {
          try {
            await upsertWalletLNAddr({
              variables: {
                id: wallet?.id,
                address,
                settings: {
                  ...settings,
                  autoWithdrawThreshold: Number(settings.autoWithdrawThreshold),
                  autoWithdrawMaxFeePercent: Number(settings.autoWithdrawMaxFeePercent)
                }
              }
            })
            toaster.success('saved settings')
            router.push('/settings/wallets')
          } catch (err) {
            console.error(err)
            toaster.danger('failed to attach: ' + err.message || err.toString?.())
          }
        }}
      >
        <Input
          label='lightning address'
          name='address'
          autoComplete='off'
          required
          autoFocus
        />
        <AutowithdrawSettings />
        <WalletButtonBar
          enabled={!!wallet} onDelete={async () => {
            try {
              await removeWallet({ variables: { id: wallet?.id } })
              toaster.success('saved settings')
              router.push('/settings/wallets')
            } catch (err) {
              console.error(err)
              toaster.danger('failed to unattach:' + err.message || err.toString?.())
            }
          }}
        />
      </Form>
      <div className='mt-3'>
        <WalletLogs wallet='lnAddr' embedded />
      </div>
    </CenterLayout>
  )
}

export function LightningAddressWalletCard ({ wallet }) {
  return (
    <WalletCard
      title='lightning address'
      badges={['receive only', 'non-custodialish']}
      provider='lightning-address'
      enabled={wallet !== undefined || undefined}
    />
  )
}
