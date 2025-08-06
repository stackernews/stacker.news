import { getGetServerSideProps } from '@/api/ssrApollo'
import { useData } from '@/components/use-data'
import { WalletForms as WalletFormsComponent } from '@/wallets/client/components'
import { WALLET } from '@/wallets/client/fragments'
import { useDecryptedWallet } from '@/wallets/client/hooks'
import { unurlify } from '@/wallets/lib/util'
import { useQuery } from '@apollo/client'
import { useRouter } from 'next/router'

const variablesFunc = params => {
  const id = Number(params.slug[0])
  return !Number.isNaN(id) ? { id } : { name: unurlify(params.slug[0]) }
}
export const getServerSideProps = getGetServerSideProps({ query: WALLET, variables: variablesFunc, authRequired: true })

export default function WalletForms ({ ssrData }) {
  const router = useRouter()
  const variables = variablesFunc(router.query)
  const { data, refetch } = useQuery(WALLET, { variables })
  const dat = useData(data, ssrData)

  const decryptedWallet = useDecryptedWallet(dat?.wallet)
  return <WalletFormsComponent wallet={decryptedWallet ?? dat?.wallet} refetch={refetch} />
}
