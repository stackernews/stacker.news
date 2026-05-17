import { getGetServerSideProps } from '@/api/ssrApollo'

const authRequiredProps = getGetServerSideProps({ authRequired: true })

export async function getServerSideProps (context) {
  const auth = await authRequiredProps(context)
  if (auth.redirect) return auth

  const destination = context.query?.type === 'lnaddr'
    ? '/wallets/reward-sats/send?lnaddr=1'
    : '/wallets/reward-sats/send'

  return {
    redirect: {
      destination,
      permanent: false
    }
  }
}

export default function WithdrawRedirect () {
  return null
}
