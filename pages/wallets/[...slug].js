import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletForms as WalletFormsComponent } from '@/wallets/client/components'
import { WALLET } from '@/wallets/client/fragments'
import { useDecryptedWallet } from '@/wallets/client/hooks'
import { unurlify } from '@/wallets/lib/util'

const variablesFunc = params => {
  const id = Number(params.slug[0])
  return !Number.isNaN(id) ? { id } : { name: unurlify(params.slug[0]) }
}
export const getServerSideProps = getGetServerSideProps({ query: WALLET, variables: variablesFunc, authRequired: true })

export default function WalletForms ({ ssrData }) {
  const decryptedWallet = useDecryptedWallet(ssrData?.wallet)
  return <WalletFormsComponent wallet={decryptedWallet ?? ssrData?.wallet} />
}
