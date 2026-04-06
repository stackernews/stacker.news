import { getGetServerSideProps } from '@/api/ssrApollo'
import {
  WalletErrorShell,
  WalletLoadingShell,
  WalletRouteGateShell,
  WalletMultiStepForm
} from '@/wallets/client/components'
import { useTemplates, useWallets } from '@/wallets/client/hooks'
import { useMemo } from 'react'
import { useRouter } from 'next/router'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function Wallet () {
  const router = useRouter()
  const wallets = useWallets()
  const templates = useTemplates()
  const routeType = Array.isArray(router.query.type) ? router.query.type[0] : router.query.type
  const wallet = useMemo(() => {
    if (!routeType) return null

    const id = Number(routeType)
    if (!Number.isNaN(id)) {
      return wallets.find(wallet => Number(wallet.id) === id) ?? null
    }

    const templateName = routeType.toUpperCase().replace(/-/g, '_')
    return templates.find(template => template.name === templateName) ?? null
  }, [routeType, wallets, templates])

  return (
    <WalletRouteGateShell>
      {!router.isReady
        ? (
          <WalletLoadingShell />
          )
        : !wallet
            ? (
              <WalletErrorShell
                title='wallet not found'
                message='this wallet could not be found'
              />
              )
            : <WalletMultiStepForm wallet={wallet} />}
    </WalletRouteGateShell>
  )
}
