import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { timeoutSignal } from '@/lib/time'
import { FAST_POLL_INTERVAL_MS, WALLET_SEND_PAYMENT_TIMEOUT_MS } from '@/lib/constants'
import { useToast } from '@/components/toast'
import { useMe } from '@/components/me'
import { requestPersistentStorage } from '@/components/use-indexeddb'
import {
  UPSERT_WALLET_RECEIVE_BLINK,
  UPSERT_WALLET_RECEIVE_CLN_REST,
  UPSERT_WALLET_RECEIVE_LIGHTNING_ADDRESS,
  UPSERT_WALLET_RECEIVE_LNBITS,
  UPSERT_WALLET_RECEIVE_LND_GRPC,
  UPSERT_WALLET_RECEIVE_NWC,
  UPSERT_WALLET_RECEIVE_PHOENIXD,
  UPSERT_WALLET_RECEIVE_CLINK,
  UPSERT_WALLET_SEND_BLINK,
  UPSERT_WALLET_SEND_LNBITS,
  UPSERT_WALLET_SEND_LNC,
  UPSERT_WALLET_SEND_NWC,
  UPSERT_WALLET_SEND_PHOENIXD,
  UPSERT_WALLET_SEND_WEBLN,
  UPSERT_WALLET_SEND_CLN_REST,
  UPSERT_WALLET_SEND_CLINK,
  WALLETS,
  UPDATE_WALLET_ENCRYPTION,
  RESET_WALLETS,
  DISABLE_PASSPHRASE_EXPORT,
  SET_WALLET_PRIORITIES,
  UPDATE_KEY_HASH,
  TEST_WALLET_RECEIVE_LNBITS,
  TEST_WALLET_RECEIVE_PHOENIXD,
  TEST_WALLET_RECEIVE_BLINK,
  TEST_WALLET_RECEIVE_LIGHTNING_ADDRESS,
  TEST_WALLET_RECEIVE_NWC,
  TEST_WALLET_RECEIVE_CLN_REST,
  TEST_WALLET_RECEIVE_LND_GRPC,
  TEST_WALLET_RECEIVE_CLINK,
  DELETE_WALLET
} from '@/wallets/client/fragments'
import { ME } from '@/fragments/users'
import { gql, useApolloClient, useMutation, useQuery } from '@apollo/client'
import {
  SET_KEY,
  useTemplates,
  useWallets,
  useWalletsDispatch,
  useWalletSendReady,
  useWithKeySync,
  useKeySyncInProgress
} from '@/wallets/client/hooks/global'
import { WalletSendStateNotReadyError } from '@/wallets/client/errors'
import {
  stageVaultKeyWithRollback,
  useDecryption,
  useEncryption,
  useVaultLocalStore
} from '@/wallets/client/hooks/crypto'
import { useWalletsUpdatedAt, WalletStatus } from '@/wallets/client/hooks/wallet'
import {
  isEncryptedField, isTemplate, isWallet, protocolAvailable, protocolLogName, reverseProtocolRelationName, walletLud16Domain
} from '@/wallets/lib/util'
import { protocolTestSendPayment } from '@/wallets/client/protocols'
import { useWalletLoggerFactory } from './logger'

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function updateVaultRemoteMetadata (client, patch) {
  client.cache.updateQuery({ query: ME }, data => {
    if (!data?.me?.privates) return data

    return {
      me: {
        ...data.me,
        privates: {
          ...data.me.privates,
          ...patch
        }
      }
    }
  })
}

export function useWalletQueryRefreshState ({
  keySyncInProgress,
  keyHashUpdatedAt,
  clearWalletData,
  refetch
}) {
  const keyHashUpdatedAtRef = useRef(keyHashUpdatedAt)
  const [remoteRefreshPending, setRemoteRefreshPending] = useState(false)

  useEffect(() => {
    if (!keySyncInProgress) return

    // Save/reset flows should not keep serving stale decrypted wallets
    // while the replacement key and wallet metadata are being synced.
    clearWalletData()
  }, [keySyncInProgress, clearWalletData])

  useClientLayoutEffect(() => {
    const previousKeyHashUpdatedAt = keyHashUpdatedAtRef.current
    keyHashUpdatedAtRef.current = keyHashUpdatedAt

    if (!keyHashUpdatedAt || previousKeyHashUpdatedAt === keyHashUpdatedAt) return
    // undefined -> value is initial hydration, not a key change
    if (!previousKeyHashUpdatedAt) return

    // Run before paint so wallet pages do not briefly render stale unlocked content.
    clearWalletData()
    setRemoteRefreshPending(true)
  }, [keyHashUpdatedAt, clearWalletData])

  useEffect(() => {
    if (!remoteRefreshPending) return

    let cancelled = false
    let retryTimeout

    const refetchRemoteWallets = async () => {
      try {
        await refetch()
        if (cancelled) return
        setRemoteRefreshPending(false)
      } catch (err) {
        if (cancelled) return
        console.error('failed to refetch wallets after key update:', err)
        // Keep the unsafe window closed until we successfully replace stale server data.
        retryTimeout = setTimeout(() => {
          refetchRemoteWallets()
        }, FAST_POLL_INTERVAL_MS)
      }
    }

    refetchRemoteWallets()

    return () => {
      cancelled = true
      clearTimeout(retryTimeout)
    }
  }, [remoteRefreshPending, refetch])

  return keySyncInProgress || remoteRefreshPending
}

export function useWalletsQuery () {
  const { me } = useMe()
  const query = useQuery(WALLETS, { skip: !me })
  const [wallets, setWallets] = useState(null)
  const [error, setError] = useState(null)
  const keySyncInProgress = useKeySyncInProgress()
  const walletsUpdatedAt = useWalletsUpdatedAt()
  const keyHashUpdatedAt = me?.privates?.vaultKeyHashUpdatedAt ?? null

  const { decryptWallet, ready } = useWalletDecryption()
  const serverWallets = query.data?.wallets ?? null
  const clearWalletData = useCallback(() => {
    setWallets(null)
    setError(null)
  }, [])

  const refreshWindowActive = useWalletQueryRefreshState({
    keySyncInProgress,
    keyHashUpdatedAt,
    clearWalletData,
    refetch: query.refetch
  })
  // Keep retrying through transient Apollo fetch errors while the unsafe
  // refresh window is still active, but continue surfacing local decrypt errors.
  const queryError = refreshWindowActive ? null : query.error
  const walletsError = error ?? queryError ?? null
  const shouldDecryptWallets = serverWallets != null && ready && !refreshWindowActive
  const walletSendReady = !walletsError && !refreshWindowActive && wallets != null

  useEffect(() => {
    // the query might fail because of network errors like ERR_NETWORK_CHANGED
    // but for some reason, the retry link does not retry the query so we poll instead ourselves here.
    // https://github.com/stackernews/stacker.news/issues/2522
    if (!wallets) {
      query.startPolling(FAST_POLL_INTERVAL_MS)
    } else {
      query.stopPolling()
    }
    return () => query.stopPolling()
  }, [query.startPolling, query.stopPolling, wallets])

  useEffect(() => {
    if (!shouldDecryptWallets) return

    let cancelled = false

    Promise.all(
      serverWallets.map(w => decryptWallet(w))
    )
      .then(wallets => wallets.map(server2Client))
      .then(wallets => {
        if (cancelled) return
        setWallets(wallets)
        setError(null)
      })
      .catch(err => {
        if (cancelled) return
        console.error('failed to decrypt wallets:', err)
        setWallets([])
        // OperationError from the Web Crypto API does not have a message
        setError(new Error('decryption error: ' + (err.message || err.name)))
      })
    return () => {
      cancelled = true
    }
  }, [serverWallets, decryptWallet, shouldDecryptWallets])

  useEffect(() => {
    if (!me?.id) return

    query.refetch()
  }, [query.refetch, me?.id, walletsUpdatedAt])

  return useMemo(() => ({
    ...query,
    walletsData: wallets == null ? null : { wallets },
    walletsError,
    walletSendReady
  }), [query, wallets, walletsError, walletSendReady])
}

function server2Client (wallet) {
  // some protocols require a specific client environment
  // e.g. WebLN requires a browser extension
  function checkProtocolAvailability (wallet) {
    if (isTemplate(wallet)) return wallet

    const protocols = wallet.protocols.map(protocol => {
      return {
        ...protocol,
        enabled: protocol.enabled && protocolAvailable(protocol)
      }
    })

    const sendEnabled = protocols.some(p => p.send && p.enabled)
    const receiveEnabled = protocols.some(p => !p.send && p.enabled)

    return {
      ...wallet,
      send: !sendEnabled ? WalletStatus.DISABLED : wallet.send,
      receive: !receiveEnabled ? WalletStatus.DISABLED : wallet.receive,
      protocols
    }
  }

  // Just like for encrypted fields, we have to use a field alias for the name field of templates
  // because of https://github.com/graphql/graphql-js/issues/53.
  // We undo this here so this only affects the GraphQL layer but not the rest of the code.
  function undoFieldAlias ({ id, ...wallet }) {
    if (isTemplate(wallet)) {
      return { ...wallet, name: id }
    }

    if (!wallet.template) return wallet

    const { id: templateId, ...template } = wallet.template
    return { id, ...wallet, template: { name: templateId, ...template } }
  }

  return wallet ? undoFieldAlias(checkProtocolAvailability(wallet)) : wallet
}

export function useWalletProtocolUpsert () {
  const client = useApolloClient()
  const loggerFactory = useWalletLoggerFactory()
  const { encryptConfig } = useEncryptConfig()

  return useCallback(async (wallet, protocol, values) => {
    const logger = loggerFactory(protocol)
    const mutation = protocolUpsertMutation(protocol)
    const name = `${protocolLogName(protocol)} ${protocol.send ? 'send' : 'receive'}`

    logger.info(`saving ${name} ...`)

    const encrypted = await encryptConfig(values, { protocol })

    const variables = encrypted
    if (isWallet(wallet)) {
      variables.walletId = wallet.id
    } else {
      variables.templateName = wallet.name
    }

    let updatedWallet
    try {
      const { data } = await client.mutate({ mutation, variables })
      logger.ok(`${name} saved`)
      updatedWallet = Object.values(data)[0]
    } catch (err) {
      logger.error(err.message)
      throw err
    }

    requestPersistentStorage()

    return updatedWallet
  }, [client, loggerFactory, encryptConfig])
}

export function useLightningAddressUpsert () {
  const protocol = useMemo(() => ({ name: 'LN_ADDR', send: false, __typename: 'WalletProtocolTemplate' }), [])
  const upsert = useWalletProtocolUpsert()
  const testCreateInvoice = useTestCreateInvoice(protocol)
  const mapper = useLightningAddressToWalletMapper()

  return useCallback(async (address) => {
    await testCreateInvoice({ address })
    const wallet = mapper(address)
    return await upsert(wallet, protocol, { address, enabled: true })
  }, [testCreateInvoice, mapper, upsert, protocol])
}

function useLightningAddressToWalletMapper () {
  const templates = useTemplates()
  return useCallback((address) => {
    return templates
      .filter(t => t.protocols.some(p => p.name === 'LN_ADDR'))
      .find(t => {
        const domain = walletLud16Domain(t.name)
        // the LN_ADDR wallet supports lightning addresses but does not have a domain because it's a generic wallet for any LN address
        return domain && address.endsWith(domain)
      }) ?? { name: 'LN_ADDR', __typename: 'WalletTemplate' }
  }, [templates])
}

export function useWalletEncryptionUpdate () {
  const wallets = useWallets()
  const walletSendReady = useWalletSendReady()
  const dispatch = useWalletsDispatch()
  const client = useApolloClient()
  const { deleteKey, readKey, writeKey } = useVaultLocalStore()
  const [mutate] = useMutation(UPDATE_WALLET_ENCRYPTION)
  const { encryptConfig } = useEncryptConfig()
  const withKeySync = useWithKeySync()

  return useCallback(async ({ key, hash }) => {
    if (!walletSendReady) {
      throw new WalletSendStateNotReadyError()
    }

    const encrypted = await Promise.all(
      wallets.map(async d => ({
        ...d,
        protocols: await Promise.all(
          d.protocols.map(p => {
            return encryptConfig(p.config, { key, hash, protocol: p })
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

    await withKeySync(async () => {
      // Stage the replacement key locally first so a successful server update
      // never leaves this device without the matching key material.
      const { updatedAt } = await stageVaultKeyWithRollback({
        deleteKey,
        readKey,
        writeKey,
        key,
        hash,
        runServerChange: async () => {
          await mutate({ variables: { keyHash: hash, wallets: data } })
        }
      })

      dispatch({ type: SET_KEY, key, hash, updatedAt })
      updateVaultRemoteMetadata(client, {
        showPassphrase: false,
        vaultKeyHash: hash,
        vaultKeyHashUpdatedAt: new Date(updatedAt).toISOString()
      })
      await client.refetchQueries({ include: [ME] })
    })
  }, [wallets, walletSendReady, dispatch, client, deleteKey, readKey, writeKey, mutate, encryptConfig, withKeySync])
}

export function useWalletReset () {
  const client = useApolloClient()
  const dispatch = useWalletsDispatch()
  const { deleteKey, readKey, writeKey } = useVaultLocalStore()
  const [mutate] = useMutation(RESET_WALLETS)
  const withKeySync = useWithKeySync()

  return useCallback(async ({ key, newKeyHash }) => {
    await withKeySync(async () => {
      const { updatedAt } = await stageVaultKeyWithRollback({
        deleteKey,
        readKey,
        writeKey,
        key,
        hash: newKeyHash,
        runServerChange: async () => {
          await mutate({ variables: { newKeyHash } })
        }
      })

      dispatch({ type: SET_KEY, key, hash: newKeyHash, updatedAt })
      updateVaultRemoteMetadata(client, {
        showPassphrase: true,
        vaultKeyHash: newKeyHash,
        vaultKeyHashUpdatedAt: new Date(updatedAt).toISOString()
      })
      await client.refetchQueries({ include: [ME] })
    })
  }, [client, dispatch, deleteKey, readKey, writeKey, mutate, withKeySync])
}

export function useDisablePassphraseExport () {
  const client = useApolloClient()
  const [mutate] = useMutation(DISABLE_PASSPHRASE_EXPORT)

  return useCallback(async () => {
    await mutate()

    updateVaultRemoteMetadata(client, {
      showPassphrase: false
    })
  }, [client, mutate])
}

export function useSetWalletPriorities () {
  const [mutate] = useMutation(SET_WALLET_PRIORITIES)
  const toaster = useToast()

  return useCallback(async (wallets) => {
    const priorities = wallets.map((wallet, index) => ({
      id: wallet.id,
      priority: index
    }))

    try {
      await mutate({ variables: { priorities } })
    } catch (err) {
      console.error('failed to update wallet priorities:', err)
      toaster.danger('failed to update wallet priorities')
    }
  }, [mutate, toaster])
}

// we only have test mutations for receive protocols and useMutation throws if we pass null to it,
// so we use this placeholder mutation in such cases to respect the rules of hooks.
// (the mutation would throw if called but we make sure to never call it.)
const NOOP_MUTATION = gql`mutation noop { noop }`

const UPSERT_PROTOCOL_MUTATIONS = {
  LNBITS: {
    send: UPSERT_WALLET_SEND_LNBITS,
    receive: UPSERT_WALLET_RECEIVE_LNBITS
  },
  PHOENIXD: {
    send: UPSERT_WALLET_SEND_PHOENIXD,
    receive: UPSERT_WALLET_RECEIVE_PHOENIXD
  },
  BLINK: {
    send: UPSERT_WALLET_SEND_BLINK,
    receive: UPSERT_WALLET_RECEIVE_BLINK
  },
  LN_ADDR: {
    receive: UPSERT_WALLET_RECEIVE_LIGHTNING_ADDRESS
  },
  NWC: {
    send: UPSERT_WALLET_SEND_NWC,
    receive: UPSERT_WALLET_RECEIVE_NWC
  },
  CLN_REST: {
    send: UPSERT_WALLET_SEND_CLN_REST,
    receive: UPSERT_WALLET_RECEIVE_CLN_REST
  },
  LND_GRPC: {
    receive: UPSERT_WALLET_RECEIVE_LND_GRPC
  },
  LNC: {
    send: UPSERT_WALLET_SEND_LNC
  },
  WEBLN: {
    send: UPSERT_WALLET_SEND_WEBLN
  },
  CLINK: {
    send: UPSERT_WALLET_SEND_CLINK,
    receive: UPSERT_WALLET_RECEIVE_CLINK
  }
}

const RECEIVE_TEST_MUTATIONS = {
  LNBITS: TEST_WALLET_RECEIVE_LNBITS,
  PHOENIXD: TEST_WALLET_RECEIVE_PHOENIXD,
  BLINK: TEST_WALLET_RECEIVE_BLINK,
  LN_ADDR: TEST_WALLET_RECEIVE_LIGHTNING_ADDRESS,
  NWC: TEST_WALLET_RECEIVE_NWC,
  CLN_REST: TEST_WALLET_RECEIVE_CLN_REST,
  LND_GRPC: TEST_WALLET_RECEIVE_LND_GRPC,
  CLINK: TEST_WALLET_RECEIVE_CLINK
}

function protocolUpsertMutation (protocol) {
  const mutationType = protocol.send ? 'send' : 'receive'
  return UPSERT_PROTOCOL_MUTATIONS[protocol.name]?.[mutationType] ?? NOOP_MUTATION
}

function protocolTestMutation (protocol) {
  if (protocol.send) return NOOP_MUTATION
  return RECEIVE_TEST_MUTATIONS[protocol.name] ?? NOOP_MUTATION
}

export function useTestSendPayment (protocol) {
  return useCallback(async (values) => {
    return await protocolTestSendPayment(
      protocol,
      values,
      { signal: timeoutSignal(WALLET_SEND_PAYMENT_TIMEOUT_MS) }
    )
  }, [protocol])
}

export function useTestCreateInvoice (protocol) {
  const mutation = protocolTestMutation(protocol)
  const [testCreateInvoice] = useMutation(mutation)

  return useCallback(async (values) => {
    return await testCreateInvoice({ variables: values })
  }, [testCreateInvoice])
}

export function useWalletDelete (wallet) {
  const [mutate] = useMutation(DELETE_WALLET)

  return useCallback(async () => {
    await mutate({ variables: { id: wallet.id } })
  }, [mutate, wallet.id])
}

function useWalletDecryption () {
  const { decryptConfig, ready } = useDecryptConfig()

  const decryptWallet = useCallback(async wallet => {
    if (!isWallet(wallet)) return wallet

    const protocols = await Promise.all(
      wallet.protocols.map(
        async protocol => ({
          ...protocol,
          config: await decryptConfig(protocol.config)
        })
      )
    )
    return { ...wallet, protocols }
  }, [decryptConfig])

  return useMemo(() => ({ decryptWallet, ready }), [decryptWallet, ready])
}

function useDecryptConfig () {
  const { decrypt, ready } = useDecryption()

  const decryptConfig = useCallback(async (config) => {
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

  return useMemo(() => ({ decryptConfig, ready }), [decryptConfig, ready])
}

function isEncrypted (value) {
  return value.__typename === 'VaultEntry'
}

function useEncryptConfig (defaultProtocol, options = {}) {
  const { encrypt, ready } = useEncryption(options)

  const encryptConfig = useCallback(async (config, { key: cryptoKey, hash, protocol } = {}) => {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(config)
          .map(
            async ([fieldKey, value]) => {
              if (!isEncryptedField(protocol ?? defaultProtocol, fieldKey)) return [fieldKey, value]
              return [
                fieldKey,
                await encrypt(value, { key: cryptoKey, hash })
              ]
            }
          )
      )
    )
  }, [defaultProtocol, encrypt])

  return useMemo(() => ({ encryptConfig, ready }), [encryptConfig, ready])
}

export function useUpdateKeyHash () {
  const [mutate] = useMutation(UPDATE_KEY_HASH)

  return useCallback(async (keyHash) => {
    await mutate({ variables: { keyHash } })
  }, [mutate])
}
