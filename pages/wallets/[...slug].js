import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletForms as WalletFormsComponent } from '@/wallets/client/components'
import { unurlify } from '@/wallets/lib/util'
import { useParams } from 'next/navigation'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletForms () {
  const params = useParams()
  const walletName = unurlify(params.slug[0])

  // if the wallet name is a number, we are showing a configured wallet
  // otherwise, we are showing a template
  const isNumber = !Number.isNaN(Number(walletName))
  if (isNumber) {
    return <WalletFormsComponent id={Number(walletName)} />
  }

  return <WalletFormsComponent name={walletName} />
}
