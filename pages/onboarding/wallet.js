import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletOnboarding } from '@/wallets/client/components/onboarding'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletOnboardingPage () {
  return <WalletOnboarding />
}
