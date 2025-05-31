import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletForms as WalletFormsComponent } from '@/wallets/client/components'
import { unurlify } from '@/wallets/lib/util'
import { useParams } from 'next/navigation'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletForms ({ name }) {
  const params = useParams()
  // if a wallet name is given, we want to create a new user wallet.
  // TODO(wallet-v2): if a number is given, we want to edit a user wallet.
  const walletName = unurlify(params.slug[0])

  if (parseInt(walletName)) {
    return <WalletFormsComponent id={Number(walletName)} />
  }

  return <WalletFormsComponent name={walletName} />
}
