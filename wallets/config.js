import { useMe } from '@/components/me'
import useVault from '@/components/vault/use-vault'
import { useCallback } from 'react'
import { canReceive, canSend, getStorageKey, saveWalletLocally, siftConfig, upsertWalletVariables } from './common'
import { gql, useMutation } from '@apollo/client'
import { generateMutation } from './graphql'
import { REMOVE_WALLET } from '@/fragments/wallet'
import { useWalletLogger } from '@/wallets/logger'
import { useWallets } from '.'
import validateWallet from './validate'
import { WALLET_SEND_PAYMENT_TIMEOUT_MS } from '@/lib/constants'
import { timeoutSignal, withTimeout } from '@/lib/time'

export function useWalletConfigurator (wallet) {
  // TODO(wallet-v2): this will probably need an update
  const { me } = useMe()
  const { reloadLocalWallets } = useWallets()
  // TODO(wallet-v2): this will probably need an update
  const { encrypt, isActive } = useVault()

  // TODO(wallet-v2): this will probably need an update - maybe we don't need a wallet logger on the client anymore?
  const logger = useWalletLogger(wallet)

  // TODO(wallet-v2): import mutation because I intend to generate them during build process
  const [upsertWallet] = useMutation(generateMutation(wallet?.def))

  const [removeWallet] = useMutation(REMOVE_WALLET)
  const [disableFreebies] = useMutation(gql`mutation { disableFreebies }`)

  // TODO(wallet-v2): check if this can be simplified now
  const _saveToServer = useCallback(async (serverConfig, clientConfig, validateLightning) => {
    const variables = await upsertWalletVariables(
      { def: wallet.def, config: { ...serverConfig, ...clientConfig } },
      isActive && encrypt,
      { validateLightning })
    await upsertWallet({ variables })
  }, [encrypt, isActive, wallet.def])

  // TODO(wallet-v2): check if this can be simplified now
  const _saveToLocal = useCallback(async (newConfig) => {
    saveWalletLocally(wallet.def.name, newConfig, me?.id)
    reloadLocalWallets()
  }, [me?.id, wallet.def.name, reloadLocalWallets])

  // TODO(wallet-v2): check if this can be simplified now
  const _validate = useCallback(async (config, validateLightning = true) => {
    const { serverWithShared, clientWithShared } = siftConfig(wallet.def.fields, config)

    let clientConfig = clientWithShared
    let serverConfig = serverWithShared

    if (canSend({ def: wallet.def, config: clientConfig })) {
      try {
        let transformedConfig = await validateWallet(wallet.def, clientWithShared, { skipGenerated: true })
        if (transformedConfig) {
          clientConfig = Object.assign(clientConfig, transformedConfig)
        }
        if (wallet.def.testSendPayment && validateLightning) {
          transformedConfig = await withTimeout(
            wallet.def.testSendPayment(clientConfig, {
              logger,
              signal: timeoutSignal(WALLET_SEND_PAYMENT_TIMEOUT_MS)
            }),
            WALLET_SEND_PAYMENT_TIMEOUT_MS
          )
          if (transformedConfig) {
            clientConfig = Object.assign(clientConfig, transformedConfig)
          }
          // validate again to ensure generated fields are valid
          await validateWallet(wallet.def, clientConfig)
        }
      } catch (err) {
        logger.error(err.message)
        throw err
      }
    } else if (canReceive({ def: wallet.def, config: serverConfig })) {
      const transformedConfig = await validateWallet(wallet.def, serverConfig)
      if (transformedConfig) {
        serverConfig = Object.assign(serverConfig, transformedConfig)
      }
    } else if (wallet.def.requiresConfig) {
      throw new Error('configuration must be able to send or receive')
    }

    return { clientConfig, serverConfig }
  }, [wallet, logger])

  // TODO(wallet-v2): check if this can be simplified now
  const _detachFromServer = useCallback(async () => {
    await removeWallet({ variables: { id: wallet.config.id } })
  }, [wallet.config?.id])

  // TODO(wallet-v2): check if this can be simplified now
  const _detachFromLocal = useCallback(async () => {
    window.localStorage.removeItem(getStorageKey(wallet.def.name, me?.id))
    reloadLocalWallets()
  }, [me?.id, wallet.def.name, reloadLocalWallets])

  // TODO(wallet-v2): check if this can be simplified now
  const save = useCallback(async (newConfig, validateLightning = true) => {
    const { clientWithShared: oldClientConfig } = siftConfig(wallet.def.fields, wallet.config)
    const { clientConfig: newClientConfig, serverConfig: newServerConfig } = await _validate(newConfig, validateLightning)

    const oldCanSend = canSend({ def: wallet.def, config: oldClientConfig })
    const newCanSend = canSend({ def: wallet.def, config: newClientConfig })

    // if vault is active, encrypt and send to server regardless of wallet type
    if (isActive) {
      await _saveToServer(newServerConfig, newClientConfig, validateLightning)
      await _detachFromLocal()
    } else {
      if (newCanSend) {
        await _saveToLocal(newClientConfig)
      } else {
        // if it previously had a client config, remove it
        await _detachFromLocal()
      }
      if (canReceive({ def: wallet.def, config: newServerConfig })) {
        await _saveToServer(newServerConfig, newClientConfig, validateLightning)
      } else if (wallet.config.id) {
        // we previously had a server config
        if (wallet.vaultEntries.length > 0) {
          // we previously had a server config with vault entries, save it
          await _saveToServer(newServerConfig, newClientConfig, validateLightning)
        } else {
          // we previously had a server config without vault entries, remove it
          await _detachFromServer()
        }
      }
    }

    if (newCanSend) {
      disableFreebies().catch(console.error)
      if (oldCanSend) {
        logger.ok('details for sending updated')
      } else {
        logger.ok('details for sending saved')
      }
      if (newConfig.enabled) {
        logger.ok('sending enabled')
      } else {
        logger.info('sending disabled')
      }
    } else if (oldCanSend) {
      logger.info('details for sending deleted')
    }
  }, [isActive, wallet.def, wallet.config, _saveToServer, _saveToLocal, _validate,
    _detachFromLocal, _detachFromServer, disableFreebies])

  // TODO(wallet-v2): check if this can be simplified now
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

    logger.info('details for sending deleted')
  }, [logger, isActive, _detachFromServer, _detachFromLocal])

  return { save, detach }
}
