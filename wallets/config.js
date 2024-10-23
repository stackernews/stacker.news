import { useMe } from '@/components/me'
import useVault from '@/components/vault/use-vault'
import { useCallback } from 'react'
import { canReceive, canSend, getStorageKey, isClientField, isServerField } from './common'
import { useMutation } from '@apollo/client'
import { generateMutation } from './graphql'
import { REMOVE_WALLET } from '@/fragments/wallet'
import { walletValidate } from '@/lib/validate'
import { useWalletLogger } from '@/components/wallet-logger'
import { useWallets } from '.'

export function useWalletConfigurator (wallet) {
  const { me } = useMe()
  const { reloadLocalWallets } = useWallets()
  const { encrypt, isActive } = useVault()
  const { logger } = useWalletLogger(wallet?.def)
  const [upsertWallet] = useMutation(generateMutation(wallet?.def))
  const [removeWallet] = useMutation(REMOVE_WALLET)

  const _saveToServer = useCallback(async (serverConfig, clientConfig) => {
    const vaultEntries = []
    if (clientConfig) {
      for (const [key, value] of Object.entries(clientConfig)) {
        vaultEntries.push({ key, value: encrypt(value) })
      }
    }
    await upsertWallet({ variables: { ...serverConfig, vaultEntries } })
  }, [encrypt, isActive])

  const _saveToLocal = useCallback(async (newConfig) => {
    window.localStorage.setItem(getStorageKey(wallet.def.name, me?.id), JSON.stringify(newConfig))
    reloadLocalWallets()
  }, [me?.id, wallet.def.name, reloadLocalWallets])

  const save = useCallback(async (newConfig, validate = true) => {
    let clientConfig = extractClientConfig(wallet.def.fields, newConfig)
    let serverConfig = extractServerConfig(wallet.def.fields, newConfig)

    if (validate) {
      if (canSend(wallet)) {
        let transformedConfig = await walletValidate(wallet, clientConfig)
        if (transformedConfig) {
          clientConfig = Object.assign(clientConfig, transformedConfig)
        }
        if (wallet.def.testSendPayment) {
          transformedConfig = await wallet.def.testSendPayment(clientConfig, { me, logger })
          if (transformedConfig) {
            clientConfig = Object.assign(clientConfig, transformedConfig)
          }
        }
      }

      if (canReceive(wallet)) {
        const transformedConfig = await walletValidate(wallet, serverConfig)
        if (transformedConfig) {
          serverConfig = Object.assign(serverConfig, transformedConfig)
        }
      }
    }

    // if vault is active, encrypt and send to server regardless of wallet type
    if (isActive) {
      await _saveToServer(serverConfig, clientConfig)
    } else {
      if (canSend(wallet)) {
        await _saveToLocal(clientConfig)
      }
      if (canReceive(wallet)) {
        await _saveToServer(serverConfig)
      }
    }
  }, [wallet, encrypt, isActive])

  const _detachFromServer = useCallback(async () => {
    await removeWallet({ variables: { id: wallet.config.id } })
  }, [wallet.config.id])

  const _detachFromLocal = useCallback(async () => {
    // if vault is not active and has a client config, delete from local storage
    window.localStorage.removeItem(getStorageKey(wallet.def.name, me?.id))
  }, [me?.id, wallet.def.name])

  const detach = useCallback(async () => {
    if (isActive) {
      await _detachFromServer()
    } else {
      if (wallet.config.id) {
        await _detachFromServer()
      }

      await _detachFromLocal()
    }
  }, [isActive, _detachFromServer, _detachFromLocal])

  return { save, detach }
}

function extractConfig (fields, config, client, includeMeta = true) {
  return Object.entries(config).reduce((acc, [key, value]) => {
    const field = fields.find(({ name }) => name === key)

    // filter server config which isn't specified as wallet fields
    // (we allow autowithdraw members to pass validation)
    if (client && key === 'id') return acc

    // field might not exist because config.enabled doesn't map to a wallet field
    if ((!field && includeMeta) || (field && (client ? isClientField(field) : isServerField(field)))) {
      return {
        ...acc,
        [key]: value
      }
    } else {
      return acc
    }
  }, {})
}

function extractClientConfig (fields, config) {
  return extractConfig(fields, config, true, true)
}

function extractServerConfig (fields, config) {
  return extractConfig(fields, config, false, true)
}
