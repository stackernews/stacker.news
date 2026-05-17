import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletLoadingShell } from '@/wallets/client/components'
import { WalletHome } from './index'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

const WALLET_HOME_ROUTES = new Set(['reward-sats', 'cowboy-credits', 'add', 'add-wallet'])

export default function WalletSelectedPage () {
  const router = useRouter()
  const routeId = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id
  const id = Number(routeId)
  const isWalletHomeRoute = WALLET_HOME_ROUTES.has(routeId)

  useEffect(() => {
    if (!router.isReady || Number.isSafeInteger(id) || isWalletHomeRoute) return
    router.replace(`/wallets/${routeId}/configure`)
  }, [id, isWalletHomeRoute, routeId, router])

  if (router.isReady && routeId && !Number.isSafeInteger(id) && !isWalletHomeRoute) {
    return <WalletLoadingShell />
  }

  return <WalletHome routeWalletId={routeId} />
}
