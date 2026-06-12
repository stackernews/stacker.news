import { useCallback, useMemo } from 'react'
import { protocolKey, walletLud16Domain } from '@/wallets/lib/util'
import { useFormikContext } from 'formik'
import { useToast } from '@/components/toast'
import { useWallet } from './context'
import { isMeaningfulDraft } from './draft'

// Bridges an `lud16` parsed from an NWC URL into the LN_ADDR receive field of the
// same form. Autofill is gated by the wallet's expected domain so a hostile NWC
// URL can never silently point receive at an attacker-controlled address. The
// address is stored in full (its input handles the domain-stripped display).
export function useNwcLightningAddressBridge ({ receiveProtocols, forceReceiveLnAddr }) {
  const wallet = useWallet()
  const formik = useFormikContext()
  const toaster = useToast()
  const domain = useMemo(() => walletLud16Domain(wallet?.name), [wallet])

  return useCallback((address) => {
    const protocol = receiveProtocols.find(p => p.name === 'LN_ADDR')
    if (!protocol || !address) return

    const addressDomain = address.split('@')[1]
    if (!domain || addressDomain !== domain) {
      toaster.warning("lightning address domain didn't match", { tag: 'nwc-lud16-foreign' })
      return
    }

    // Seed the LN address once: never clobber an address the user already set, and
    // never yank the active receive card away from another method being configured.
    const lnAddr = formik.values[protocolKey(protocol)] ?? {}
    if (isMeaningfulDraft(protocol, lnAddr)) return
    const otherReceiveInProgress = receiveProtocols.some(
      p => p.name !== 'LN_ADDR' && isMeaningfulDraft(p, formik.values[protocolKey(p)] ?? {}))
    if (otherReceiveInProgress) return

    forceReceiveLnAddr()
    formik.setFieldValue(`${protocolKey(protocol)}.address`, address)
  }, [formik, domain, forceReceiveLnAddr, receiveProtocols, toaster])
}
