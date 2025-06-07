import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletForms as WalletFormsComponent } from '@/wallets/client/components'
import { unurlify } from '@/wallets/lib/util'
import { useParams } from 'next/navigation'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletForms ({ name }) {
  const params = useParams()
  const walletName = unurlify(params.slug[0])

  if (parseInt(walletName)) {
    return <WalletFormsComponent id={Number(walletName)} />
  }

  return <WalletFormsComponent name={walletName} />
}
