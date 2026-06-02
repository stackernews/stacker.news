import { getGetServerSideProps } from '@/api/ssrApollo'
import {
  WalletConfigureForm,
  WalletDetailRoutePage
} from '@/wallets/client/components'
import { useRouteTemplate } from '@/wallets/client/hooks'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function AddWalletTemplatePage () {
  const { template, ready, routeTemplate } = useRouteTemplate()

  return (
    <WalletDetailRoutePage ready={ready} resource={template} title='configure' notFoundMessage='this wallet template could not be found'>
      {wallet => <WalletConfigureForm key={routeTemplate} wallet={wallet} />}
    </WalletDetailRoutePage>
  )
}
