import { useMe } from '@/components/me'
import useVault from '@/components/vault/use-vault'
import { useCallback } from 'react'
import { canReceive, canSend, getStorageKey } from './common'
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

  const _saveToServer = useCallback(async (serverConfig, clientConfig, validateLightning) => {
    const { serverWithShared, settings, clientOnly } = siftConfig(wallet.def.fields, { ...serverConfig, ...clientConfig })
    const vaultEntries = []
    if (clientOnly) {
      for (const [key, value] of Object.entries(clientOnly)) {
        vaultEntries.push({ key, value: encrypt(value) })
      }
    }
    await upsertWallet({ variables: { ...serverWithShared, settings, validateLightning, vaultEntries } })
  }, [encrypt, isActive, wallet.def.fields])

  const _saveToLocal = useCallback(async (newConfig) => {
    window.localStorage.setItem(getStorageKey(wallet.def.name, me?.id), JSON.stringify(newConfig))
    reloadLocalWallets()
  }, [me?.id, wallet.def.name, reloadLocalWallets])

  const _validate = useCallback(async (config, validateLightning = true) => {
    const { serverWithShared, clientWithShared } = siftConfig(wallet.def.fields, config)

    let clientConfig = clientWithShared
    let serverConfig = serverWithShared

    if (canSend({ def: wallet.def, config: clientConfig })) {
      let transformedConfig = await walletValidate(wallet.def, clientWithShared)
      if (transformedConfig) {
        clientConfig = Object.assign(clientConfig, transformedConfig)
      }
      if (wallet.def.testSendPayment && validateLightning) {
        transformedConfig = await wallet.def.testSendPayment(clientConfig, { me, logger })
        if (transformedConfig) {
          clientConfig = Object.assign(clientConfig, transformedConfig)
        }
      }
    } else if (canReceive({ def: wallet.def, config: serverConfig })) {
      const transformedConfig = await walletValidate(wallet.def, serverConfig)
      if (transformedConfig) {
        serverConfig = Object.assign(serverConfig, transformedConfig)
      }
    } else {
      throw new Error('configuration must be able to send or receive')
    }

    return { clientConfig, serverConfig }
  }, [wallet])

  const save = useCallback(async (newConfig, validateLightning = true) => {
    const { clientConfig, serverConfig } = await _validate(newConfig, validateLightning)

    // if vault is active, encrypt and send to server regardless of wallet type
    if (isActive) {
      await _saveToServer(serverConfig, clientConfig, validateLightning)
    } else {
      if (canSend({ def: wallet.def, config: clientConfig })) {
        await _saveToLocal(clientConfig)
      }
      if (canReceive({ def: wallet.def, config: serverConfig })) {
        await _saveToServer(serverConfig, clientConfig, validateLightning)
      }
    }
  }, [isActive, _saveToServer, _saveToLocal, _validate])

  const _detachFromServer = useCallback(async () => {
    await removeWallet({ variables: { id: wallet.config.id } })
  }, [wallet.config?.id])

  const _detachFromLocal = useCallback(async () => {
    window.localStorage.removeItem(getStorageKey(wallet.def.name, me?.id))
  }, [me?.id, wallet.def.name])

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

function siftConfig (fields, config) {
  const sifted = {
    clientOnly: {},
    serverOnly: {},
    shared: {},
    serverWithShared: {},
    clientWithShared: {},
    settings: {}
  }

  for (const [key, value] of Object.entries(config)) {
    if (['id'].includes(key)) {
      sifted.serverOnly[key] = value
      continue
    }

    if (['autoWithdrawMaxFeePercent', 'autoWithdrawThreshold', 'autoWithdrawMaxFeeTotal'].includes(key)) {
      sifted.serverOnly[key] = value
      sifted.settings[key] = value
      continue
    }

    const field = fields.find(({ name }) => name === key)

    if (field) {
      if (field.serverOnly) {
        sifted.serverOnly[key] = value
      } else if (field.clientOnly) {
        sifted.clientOnly[key] = value
      } else {
        sifted.shared[key] = value
      }
    } else {
      sifted.shared[key] = value
    }
  }

  sifted.serverWithShared = { ...sifted.shared, ...sifted.serverOnly }
  sifted.clientWithShared = { ...sifted.shared, ...sifted.clientOnly }

  return sifted
}
