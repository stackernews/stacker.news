import {
  WALLET,
  UPSERT_WALLET_RECEIVE_BLINK,
  UPSERT_WALLET_RECEIVE_CLN_REST,
  UPSERT_WALLET_RECEIVE_LIGHTNING_ADDRESS,
  UPSERT_WALLET_RECEIVE_LNBITS,
  UPSERT_WALLET_RECEIVE_LNDGRPC,
  UPSERT_WALLET_RECEIVE_NWC,
  UPSERT_WALLET_RECEIVE_PHOENIXD,
  UPSERT_WALLET_SEND_BLINK,
  UPSERT_WALLET_SEND_LNBITS,
  UPSERT_WALLET_SEND_LNC,
  UPSERT_WALLET_SEND_NWC,
  UPSERT_WALLET_SEND_PHOENIXD,
  UPSERT_WALLET_SEND_WEBLN,
  WALLETS,
  REMOVE_WALLET_PROTOCOL,
  UPDATE_WALLET_ENCRYPTION,
  RESET_WALLETS,
  DISABLE_PASSPHRASE_EXPORT
} from '@/wallets/client/fragments'
import { useMutation, useQuery } from '@apollo/client'
import { useDecryption, useEncryption, useSetKey, useWalletLoggerFactory } from '@/wallets/client/hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { isEncryptedField, isWallet, reverseProtocolRelationName } from '@/wallets/lib/util'
import { protocolTestSendPayment } from '@/wallets/client/protocols'
import { timeoutSignal } from '@/lib/time'
import { WALLET_SEND_PAYMENT_TIMEOUT_MS } from '@/lib/constants'
import { useToast } from '@/components/toast'
import { useMe } from '@/components/me'

export function useWalletsQuery () {
  const query = useQuery(WALLETS)
  const [wallets, setWallets] = useState(null)

  const decryptWallet = useWalletDecryption()

  useEffect(() => {
    if (!query.data?.wallets) return
    Promise.all(
      query.data?.wallets.map(w => decryptWallet(w))
    ).then(wallets => setWallets(wallets))
  }, [query.data, decryptWallet])

  useRefetchOnChange(query.refetch)

  return useMemo(() => ({
    ...query,
    // pretend query is still loading until we've decrypted the wallet
    loading: !wallets,
    data: wallets ? { wallets } : null
  }), [query, wallets])
}

function useRefetchOnChange (refetch) {
  const { me } = useMe()
  useEffect(() => {
    refetch()
  }, [refetch, me?.privates?.walletsUpdatedAt])
}

export function useWalletQuery ({ id, name }) {
  const query = useQuery(WALLET, { variables: { id, name } })
  const [wallet, setWallet] = useState(null)

  const decryptWallet = useWalletDecryption()

  useEffect(() => {
    if (!query.data?.wallet) return
    decryptWallet(query.data?.wallet).then(wallet => setWallet(wallet))
  }, [query.data, decryptWallet])

  return useMemo(() => ({
    ...query,
    // pretend query is still loading until we've decrypted the wallet
    loading: !wallet,
    data: wallet ? { wallet } : null
  }), [query, wallet])
}

export function useWalletProtocolUpsert (wallet, protocol) {
  const mutation = getWalletProtocolMutation(protocol)
  const [mutate] = useMutation(mutation)
  const encryptConfig = useEncryptConfig(protocol)
  const testSendPayment = useTestSendPayment(protocol)
  const loggerFactory = useWalletLoggerFactory()

  return useCallback(async (values) => {
    const logger = loggerFactory(protocol)
    logger.info('saving wallet ...')

    try {
      await testSendPayment(values)
    } catch (err) {
      logger.error(err.message)
      throw err
    }

    const encrypted = await encryptConfig(values)

    const variables = encrypted
    if (isWallet(wallet)) {
      variables.walletId = wallet.id
    } else {
      variables.templateId = wallet.id
    }

    let updatedWallet
    try {
      const { data } = await mutate({ variables })
      logger.ok('wallet saved')
      updatedWallet = Object.values(data)[0]
    } catch (err) {
      logger.error(err.message)
      throw err
    }

    return updatedWallet
  }, [mutate, encryptConfig])
}

export function useWalletProtocolRemove (protocol) {
  const [mutate] = useMutation(REMOVE_WALLET_PROTOCOL)
  const toaster = useToast()

  return useCallback(async () => {
    try {
      await mutate({ variables: { id: protocol.id } })
      toaster.success('protocol detached')
    } catch (err) {
      toaster.danger('failed to detach protocol: ' + err.message)
    }
  }, [protocol?.id, mutate, toaster])
}

export function useWalletEncryptionUpdate () {
  const [mutate] = useMutation(UPDATE_WALLET_ENCRYPTION)
  const setKey = useSetKey()
  const encryptConfig = useEncryptConfig()

  return useCallback(async ({ key, hash, wallets }) => {
    const encrypted = await Promise.all(
      wallets.map(async d => ({
        ...d,
        protocols: await Promise.all(
          d.protocols.map(p => {
            return encryptConfig(p.config, { key, protocol: p })
          }))
      }))
    )

    const data = encrypted.map(wallet => ({
      id: wallet.id,
      protocols: wallet.protocols.map(protocol => {
        const { id, __typename: relationName, ...config } = protocol
        const { name, send } = reverseProtocolRelationName(relationName)
        return { name, send, config }
      })
    }))

    await mutate({ variables: { keyHash: hash, wallets: data } })

    await setKey(key)
  }, [mutate, encryptConfig])
}

export function useWalletReset () {
  const [mutate] = useMutation(RESET_WALLETS)

  return useCallback(async () => {
    await mutate()
  }, [mutate])
}

export function useDisablePassphraseExport () {
  const [mutate] = useMutation(DISABLE_PASSPHRASE_EXPORT)

  return useCallback(async () => {
    await mutate()
  }, [mutate])
}

function getWalletProtocolMutation (protocol) {
  switch (protocol.name) {
    case 'LNBITS':
      return protocol.send ? UPSERT_WALLET_SEND_LNBITS : UPSERT_WALLET_RECEIVE_LNBITS
    case 'PHOENIXD':
      return protocol.send ? UPSERT_WALLET_SEND_PHOENIXD : UPSERT_WALLET_RECEIVE_PHOENIXD
    case 'BLINK':
      return protocol.send ? UPSERT_WALLET_SEND_BLINK : UPSERT_WALLET_RECEIVE_BLINK
    case 'LN_ADDR':
      return protocol.send ? null : UPSERT_WALLET_RECEIVE_LIGHTNING_ADDRESS
    case 'NWC':
      return protocol.send ? UPSERT_WALLET_SEND_NWC : UPSERT_WALLET_RECEIVE_NWC
    case 'CLN_REST':
      return protocol.send ? null : UPSERT_WALLET_RECEIVE_CLN_REST
    case 'LND_GRPC':
      return protocol.send ? null : UPSERT_WALLET_RECEIVE_LNDGRPC
    case 'LNC':
      return protocol.send ? UPSERT_WALLET_SEND_LNC : null
    case 'WEBLN':
      return protocol.send ? UPSERT_WALLET_SEND_WEBLN : null
    default:
      return null
  }
}

function useTestSendPayment (protocol) {
  return useCallback(async (values) => {
    if (!protocol.send) return

    await protocolTestSendPayment(
      protocol,
      values,
      { signal: timeoutSignal(WALLET_SEND_PAYMENT_TIMEOUT_MS) }
    )
  }, [protocol])
}

function useWalletDecryption () {
  const decryptConfig = useDecryptConfig()

  return useCallback(async wallet => {
    if (!isWallet(wallet)) return wallet

    try {
      const protocols = await Promise.all(
        wallet.protocols.map(
          async protocol => ({
            ...protocol,
            config: await decryptConfig(protocol.config)
          })
        )
      )
      return { ...wallet, protocols, encrypted: false }
    } catch (err) {
      return { ...wallet, encrypted: true }
    }
  }, [decryptConfig])
}

function useDecryptConfig () {
  const decrypt = useDecryption()

  return useCallback(async (config) => {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(config)
          .map(
            async ([key, value]) => {
              if (!isEncrypted(value)) return [key, value]

              // undo the field aliases we had to use because of https://github.com/graphql/graphql-js/issues/53
              // so we can pretend the GraphQL API returns the fields as they are named in the schema
              let renamed = key.replace(/^encrypted/, '')
              renamed = renamed.charAt(0).toLowerCase() + renamed.slice(1)

              return [
                renamed,
                await decrypt(value)
              ]
            }
          )
      )
    )
  }, [decrypt])
}

function isEncrypted (value) {
  return value.__typename === 'VaultEntry'
}

function useEncryptConfig (defaultProtocol) {
  const encrypt = useEncryption()

  return useCallback(async (config, { key: cryptoKey, protocol } = {}) => {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(config)
          .map(
            async ([fieldKey, value]) => {
              if (!isEncryptedField(protocol ?? defaultProtocol, fieldKey)) return [fieldKey, value]
              return [
                fieldKey,
                await encrypt(value, { key: cryptoKey })
              ]
            }
          )
      )
    )
  }, [defaultProtocol, encrypt])
}
