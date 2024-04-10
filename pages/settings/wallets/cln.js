import { getGetServerSideProps } from '@/api/ssrApollo'
import { Form, Input } from '@/components/form'
import { CenterLayout } from '@/components/layout'
import { useMe } from '@/components/me'
import { WalletButtonBar, WalletCard } from '@/components/wallet-card'
import { useApolloClient, useMutation } from '@apollo/client'
import { useToast } from '@/components/toast'
import { CLNAutowithdrawSchema } from '@/lib/validate'
import { useRouter } from 'next/router'
import { AutowithdrawSettings, autowithdrawInitial } from '@/components/autowithdraw-shared'
import { REMOVE_WALLET, UPSERT_WALLET_CLN, WALLET_BY_TYPE } from '@/fragments/wallet'
import WalletLogs from '@/components/wallet-logs'
import Info from '@/components/info'
import Text from '@/components/text'

const variables = { type: 'CLN' }
export const getServerSideProps = getGetServerSideProps({ query: WALLET_BY_TYPE, variables, authRequired: true })

export default function CLN ({ ssrData }) {
  const me = useMe()
  const toaster = useToast()
  const router = useRouter()
  const client = useApolloClient()
  const [upsertWalletCLN] = useMutation(UPSERT_WALLET_CLN, {
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
      <h2 className='pb-2'>CLN</h2>
      <h6 className='text-muted text-center'>autowithdraw to your Core Lightning node</h6>
      <h6 className='text-muted text-center pb-3'> You must have CLNRest working on your node. See <a href='https://docs.corelightning.org/docs/rest' target='_blank' noreferrer rel='noreferrer'>here</a> for more info.</h6>
      <Form
        initial={{
          socket: wallet?.wallet?.socket || '',
          rune: wallet?.wallet?.rune || '',
          cert: wallet?.wallet?.cert || '',
          ...autowithdrawInitial({ me, priority: wallet?.priority })
        }}
        schema={CLNAutowithdrawSchema({ me })}
        onSubmit={async ({ socket, rune, cert, ...settings }) => {
          try {
            await upsertWalletCLN({
              variables: {
                id: wallet?.id,
                socket,
                rune,
                cert,
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
          }
        }}
      >
        <Input
          label='rest host and port'
          name='socket'
          hint='tor or clearnet'
          placeholder='55.5.555.55:3010'
          clear
          required
          autoFocus
        />
        <Input
          label={
            <div className='d-flex align-items-center'>invoice only rune
              <Info>
                <Text>
                  {'We only accept runes that *only* allow `method=invoice`.\nRun this to generate one:\n\n```lightning-cli createrune restrictions=\'["method=invoice"]\'```'}
                </Text>
              </Info>
            </div>
          }
          name='rune'
          clear
          hint='must be restricted to method=invoice'
          required
        />
        <Input
          label={<>cert <small className='text-muted ms-2'>optional if from <a href='https://en.wikipedia.org/wiki/Certificate_authority' target='_blank' rel='noreferrer'>CA</a> (e.g. voltage)</small></>}
          name='cert'
          clear
          hint='hex or base64 encoded'
          placeholder='LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUNNVENDQWRpZ0F3SUJBZ0lRSHBFdFdrcGJwZHV4RVF2eVBPc3NWVEFLQmdncWhrak9QUVFEQWpBdk1SOHcKSFFZRFZRUUtFeFpzYm1RZ1lYVjBiMmRsYm1WeVlYUmxaQ0JqWlhKME1Rd3dDZ1lEVlFRREV3TmliMkl3SGhjTgpNalF3TVRBM01qQXhORE0wV2hjTk1qVXdNekF6TWpBeE5ETTBXakF2TVI4d0hRWURWUVFLRXhac2JtUWdZWFYwCmIyZGxibVZ5WVhSbFpDQmpaWEowTVF3d0NnWURWUVFERXdOaWIySXdXVEFUQmdjcWhrak9QUUlCQmdncWhrak8KUFFNQkJ3TkNBQVJUS3NMVk5oZnhqb1FLVDlkVVdDbzUzSmQwTnBuL1BtYi9LUE02M1JxbU52dFYvdFk4NjJJZwpSbE41cmNHRnBEajhUeFc2OVhIK0pTcHpjWDdlN3N0Um80SFZNSUhTTUE0R0ExVWREd0VCL3dRRUF3SUNwREFUCkJnTlZIU1VFRERBS0JnZ3JCZ0VGQlFjREFUQVBCZ05WSFJNQkFmOEVCVEFEQVFIL01CMEdBMVVkRGdRV0JCVDAKMnh3V25GeHRUNzI0MWxwZlNoNm9FWi9UMWpCN0JnTlZIUkVFZERCeWdnTmliMktDQ1d4dlkyRnNhRzl6ZElJRApZbTlpZ2d4d2IyeGhjaTF1TVMxaWIyS0NGR2h2YzNRdVpHOWphMlZ5TG1sdWRHVnlibUZzZ2dSMWJtbDRnZ3AxCmJtbDRjR0ZqYTJWMGdnZGlkV1pqYjI1dWh3Ui9BQUFCaHhBQUFBQUFBQUFBQUFBQUFBQUFBQUFCaHdTc0VnQUQKTUFvR0NDcUdTTTQ5QkFNQ0EwY0FNRVFDSUEwUTlkRXdoNXpPRnpwL3hYeHNpemh5SkxNVG5yazU1VWx1NHJPRwo4WW52QWlBVGt4U3p3Y3hZZnFscGx0UlNIbmd0NUJFcDBzcXlHL05nenBzb2pmMGNqQT09Ci0tLS0tRU5EIENFUlRJRklDQVRFLS0tLS0K'
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
            }
          }}
        />
      </Form>
      <div className='mt-3 w-100'>
        <WalletLogs wallet='cln' embedded />
      </div>
    </CenterLayout>
  )
}

export function CLNCard ({ wallet }) {
  return (
    <WalletCard
      title='CLN'
      badges={['receive only', 'non-custodial']}
      provider='cln'
      enabled={wallet !== undefined || undefined}
    />
  )
}
