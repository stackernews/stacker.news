import { useMe } from '@/components/me'
import useVault from '@/components/vault/use-vault'
import { useCallback } from 'react'
import { canReceive, canSend, getStorageKey, saveWalletLocally, siftConfig, upsertWalletVariables } from './common'
import { useMutation } from '@apollo/client'
import { generateMutation } from './graphql'
import { REMOVE_WALLET } from '@/fragments/wallet'
import { useWalletLogger } from '@/components/wallet-logger'
import { useWallets } from '.'
import validateWallet from './validate'

export function useWalletConfigurator (wallet) {
  const { me } = useMe()
  const { reloadLocalWallets } = useWallets()
  const { encrypt, isActive } = useVault()
  const { logger } = useWalletLogger(wallet?.def)
  const [upsertWallet] = useMutation(generateMutation(wallet?.def))
  const [removeWallet] = useMutation(REMOVE_WALLET)

  const _saveToServer = useCallback(async (serverConfig, clientConfig, validateLightning) => {
    const variables = await upsertWalletVariables(
      { def: wallet.def, config: { ...serverConfig, ...clientConfig } },
      isActive && encrypt,
      { validateLightning })
    await upsertWallet({ variables })
  }, [encrypt, isActive, wallet.def])

  const _saveToLocal = useCallback(async (newConfig) => {
    saveWalletLocally(wallet.def.name, newConfig, me?.id)
    reloadLocalWallets()
  }, [me?.id, wallet.def.name, reloadLocalWallets])

  const _validate = useCallback(async (config, validateLightning = true) => {
    const { serverWithShared, clientWithShared } = siftConfig(wallet.def.fields, config)

    let clientConfig = clientWithShared
    let serverConfig = serverWithShared

    if (canSend({ def: wallet.def, config: clientConfig })) {
      let transformedConfig = await validateWallet(wallet.def, clientWithShared, { skipGenerated: true })
      if (transformedConfig) {
        clientConfig = Object.assign(clientConfig, transformedConfig)
      }
      if (wallet.def.testSendPayment && validateLightning) {
        transformedConfig = await wallet.def.testSendPayment(clientConfig, { me, logger })
        if (transformedConfig) {
          clientConfig = Object.assign(clientConfig, transformedConfig)
        }
        // validate again to ensure generated fields are valid
        await validateWallet(wallet.def, clientConfig)
      }
    } else if (canReceive({ def: wallet.def, config: serverConfig })) {
      const transformedConfig = await validateWallet(wallet.def, serverConfig)
      if (transformedConfig) {
        serverConfig = Object.assign(serverConfig, transformedConfig)
      }
    } else {
      throw new Error('configuration must be able to send or receive')
    }

    return { clientConfig, serverConfig }
  }, [wallet])

  const _detachFromServer = useCallback(async () => {
    await removeWallet({ variables: { id: wallet.config.id } })
  }, [wallet.config?.id])

  const _detachFromLocal = useCallback(async () => {
    window.localStorage.removeItem(getStorageKey(wallet.def.name, me?.id))
    reloadLocalWallets()
  }, [me?.id, wallet.def.name, reloadLocalWallets])

  const save = useCallback(async (newConfig, validateLightning = true) => {
    const { clientConfig, serverConfig } = await _validate(newConfig, validateLightning)

    // if vault is active, encrypt and send to server regardless of wallet type
    if (isActive) {
      await _saveToServer(serverConfig, clientConfig, validateLightning)
      await _detachFromLocal()
    } else {
      if (canSend({ def: wallet.def, config: clientConfig })) {
        await _saveToLocal(clientConfig)
      } else {
        // if it previously had a client config, remove it
        await _detachFromLocal()
      }
      if (canReceive({ def: wallet.def, config: serverConfig })) {
        await _saveToServer(serverConfig, clientConfig, validateLightning)
      } else if (wallet.config.id) {
        // if it previously had a server config, remove it
        await _detachFromServer()
      }
    }
  }, [isActive, wallet.def, _saveToServer, _saveToLocal, _validate,
    _detachFromLocal, _detachFromServer])

  const detach = useCallback(async () => {
    if (isActive) {
      // if vault is active, detach all wallets from server
      await _detachFromServer()
    } else {
      if (wallet.config.id) {
        await _detachFromServer()
      }

      // if vault is not active and has a client config, delete from local storage
      await _detachFromLocal()
    }
  }, [isActive, _detachFromServer, _detachFromLocal])

  return { save, detach }
}
