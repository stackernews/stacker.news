import { getGetServerSideProps } from '@/api/ssrApollo'
import {
  WalletErrorShell,
  WalletLoadingShell,
  WalletRouteGateShell,
  WalletMultiStepForm,
  WalletShell
} from '@/wallets/client/components'
import { useTemplates, useWallets } from '@/wallets/client/hooks'
import { unurlify } from '@/wallets/lib/util'
import styles from '@/styles/wallet.module.css'
import { useMemo } from 'react'
import { useRouter } from 'next/router'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletConfigurePage () {
  const router = useRouter()
  const wallets = useWallets()
  const templates = useTemplates()
  const routeId = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id
  const wallet = useMemo(() => {
    if (!routeId) return null

    const id = Number(routeId)
    if (!Number.isNaN(id)) {
      return wallets.find(wallet => Number(wallet.id) === id) ?? null
    }

    const templateName = unurlify(routeId)
    return templates.find(template => template.name === templateName) ?? null
  }, [routeId, wallets, templates])

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
            : (
              <WalletShell noSidebar>
                <main className={styles.walletMain}>
                  <WalletMultiStepForm key={routeId} wallet={wallet} />
                </main>
              </WalletShell>
              )}
    </WalletRouteGateShell>
  )
}
