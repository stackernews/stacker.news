import { getGetServerSideProps } from '../../../api/ssrApollo'
import { Form, Input } from '../../../components/form'
import { CenterLayout } from '../../../components/layout'
import { useMe } from '../../../components/me'
import { WalletButtonBar, WalletCard } from '../../../components/wallet-card'
import { useMutation } from '@apollo/client'
import { useToast } from '../../../components/toast'
import { CoreLightningAutowithdrawSchema } from '../../../lib/validate'
import { useRouter } from 'next/router'
import { AutowithdrawSettings, autowithdrawInitial } from '../../../components/autowithdraw-shared'
import { REMOVE_WALLET, UPSERT_WALLET_CORE_LIGHTNING, WALLET_BY_TYPE } from '../../../fragments/wallet'
import Info from '../../../components/info'
import Text from '../../../components/text'

const variables = { type: 'CORE_LIGHTNING' }
export const getServerSideProps = getGetServerSideProps({ query: WALLET_BY_TYPE, variables, authRequired: true })

export default function CoreLightning ({ ssrData }) {
  const me = useMe()
  const toaster = useToast()
  const router = useRouter()
  const [upsertWalletCoreLightning] = useMutation(UPSERT_WALLET_CORE_LIGHTNING)
  const [removeWallet] = useMutation(REMOVE_WALLET)

  const { walletByType: wallet } = ssrData || {}
  
  return (
    <CenterLayout>
      <h2 className='pb-2'>Core Lightning</h2>
      <h6 className='text-muted text-center pb-3'>autowithdraw to your Core Lightning node</h6>
      <h6 className='text-muted text-center pb-3'> You must have CLNRest working on your node. <a href='https://docs.corelightning.org/docs/rest\n\n'>More info here.</a></h6>

      <Form
        initial={{
          socket: wallet?.wallet?.socket || '',
          rune: wallet?.wallet?.rune || '',
          ...autowithdrawInitial({ me, priority: wallet?.priority })
        }}
        schema={CoreLightningAutowithdrawSchema({ me })}
        onSubmit={async ({ socket, rune, ...settings }) => {
          try {
            await upsertWalletCoreLightning({
              variables: {
                id: wallet?.id,
                socket,
                rune,
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
          label='grpc host and port'
          name='socket'
          hint='tor or clearnet'
          placeholder='55.5.555.55:10001'
          clear
          required
          autoFocus
        />
        <Input
          label={
            <div className='d-flex align-items-center'>Invoice Only Rune
              <Info label='privacy tip'>
                <Text>
                  {'***invoice only rune*** for your convenience. To gain better privacy, generate a new rune as follows:\n\n```lightning-cli createrune restrictions=invoice```\n\nfor older core lightning versions use ```lightning-cli commando-rune restrictions=method=invoice```'}
                </Text>
              </Info>
            </div>
          }
          name='rune'
          clear
          hint='base64 encoded'
          placeholder='AgEDbG5kAlgDChCn7YgfWX7uTkQQgXZ2uahNEgEwGhYKB2FkZHJlc3MSBHJlYWQSBXdyaXRlGhcKCGludm9pY2VzEgRyZWFkEgV3cml0ZRoPCgdvbmNoYWluEgRyZWFkAAAGIJkMBrrDV0npU90JV0TGNJPrqUD8m2QYoTDjolaL6eBs'
          required
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
    </CenterLayout>
  )
}

export function CoreLightningCard ({ wallet }) {
  return (
    <WalletCard
      title='Core Lightning'
      badges={['receive only', 'non-custodial']}
      provider='core-lightning'
      enabled={wallet !== undefined || undefined}
    />
  )
}
