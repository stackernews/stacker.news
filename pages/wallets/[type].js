import { getGetServerSideProps } from '@/api/ssrApollo'
import { useData } from '@/components/use-data'
import {
  WalletCenteredPromptShell,
  WalletErrorShell,
  WalletKeyStorageUnavailableShell,
  WalletLoadingShell,
  WalletMultiStepForm
} from '@/wallets/client/components'
import { WALLET } from '@/wallets/client/fragments'
import {
  KeyStatus,
  useDecryptedWallet,
  useKeyError,
  useNeedsPassphraseSetup,
  usePassphrasePrompt,
  usePassphraseSetup,
  useRefetchOnRemoteKeyHashChange,
  useWalletsError,
  useWalletsLoading
} from '@/wallets/client/hooks'
import { unurlify } from '@/wallets/lib/util'
import { useQuery } from '@apollo/client'
import { useRouter } from 'next/router'

const variablesFunc = params => {
  const id = Number(params.type)
  return !Number.isNaN(id) ? { id } : { name: unurlify(params.type) }
}
export const getServerSideProps = getGetServerSideProps({ query: WALLET, variables: variablesFunc, authRequired: true })

export default function Wallet ({ ssrData }) {
  const router = useRouter()
  const variables = variablesFunc(router.query)
  const keyError = useKeyError()
  const needsPassphraseSetup = useNeedsPassphraseSetup()
  const walletsLoading = useWalletsLoading()
  const walletsError = useWalletsError()
  const { SetupPrompt } = usePassphraseSetup()
  const BlockingPassphrasePrompt = usePassphrasePrompt({ showCancel: false })
  // this will print the following warning in the console:
  //   Warning: fragment with name WalletTemplateFields already exists.
  //   graphql-tag enforces all fragment names across your application to be unique
  // this is not a problem because the warning is only meant to avoid overwriting fragments but we're reusing it
  const { data, error: walletError, refetch } = useQuery(WALLET, { variables })
  const dat = useData(data, ssrData)
  const needsFreshWalletData = useRefetchOnRemoteKeyHashChange(refetch, {
    errorMessage: 'failed to refetch wallet after key update:'
  })

  if (keyError === KeyStatus.KEY_STORAGE_UNAVAILABLE) {
    return <WalletKeyStorageUnavailableShell />
  }

  if (keyError === KeyStatus.WRONG_KEY) {
    return (
      <WalletCenteredPromptShell>
        {BlockingPassphrasePrompt}
      </WalletCenteredPromptShell>
    )
  }

  if (needsPassphraseSetup) {
    if (walletsError) {
      return (
        <WalletErrorShell
          title='failed to load wallets'
          message={walletsError.message}
        />
      )
    }

    if (walletsLoading) {
      return <WalletLoadingShell />
    }

    return (
      <WalletCenteredPromptShell>
        {SetupPrompt}
      </WalletCenteredPromptShell>
    )
  }

  if (walletError) {
    return (
      <WalletErrorShell
        title='failed to load wallet'
        message={walletError.message}
      />
    )
  }

  if (needsFreshWalletData) {
    return <WalletLoadingShell message='refreshing wallet' />
  }

  return <WalletFormPage wallet={dat?.wallet ?? ssrData?.wallet} />
}

function WalletFormPage ({ wallet }) {
  const decryptedWallet = useDecryptedWallet(wallet)
  const resolvedWallet = decryptedWallet ?? wallet

  if (!resolvedWallet) {
    return null
  }

  return <WalletMultiStepForm wallet={resolvedWallet} />
}
