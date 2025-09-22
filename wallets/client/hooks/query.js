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
import { gql, useApolloClient, useMutation, useQuery } from '@apollo/client'
import { useDecryption, useEncryption, useSetKey, useWalletLoggerFactory, useWalletsUpdatedAt, WalletStatus } from '@/wallets/client/hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  isEncryptedField, isTemplate, isWallet, protocolAvailable, protocolClientSchema, protocolLogName, reverseProtocolRelationName,
  walletLud16Domain
} from '@/wallets/lib/util'
import { protocolTestSendPayment } from '@/wallets/client/protocols'
import { timeoutSignal } from '@/lib/time'
import { FAST_POLL_INTERVAL_MS, WALLET_SEND_PAYMENT_TIMEOUT_MS } from '@/lib/constants'
import { useToast } from '@/components/toast'
import { useMe } from '@/components/me'
import { useTemplates, useWallets, useWalletsLoading } from '@/wallets/client/context'
import { requestPersistentStorage } from '@/components/use-indexeddb'

export function useWalletsQuery () {
  const { me } = useMe()
  const query = useQuery(WALLETS, { skip: !me })
  const [wallets, setWallets] = useState(null)
  const [error, setError] = useState(null)

  const { decryptWallet, ready } = useWalletDecryption()

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
    if (!query.data?.wallets || !ready) return
    Promise.all(
      query.data?.wallets.map(w => decryptWallet(w))
    )
      .then(wallets => wallets.map(server2Client))
      .then(wallets => {
        setWallets(wallets)
        setError(null)
      })
      .catch(err => {
        console.error('failed to decrypt wallets:', err)
        setWallets([])
        // OperationError from the Web Crypto API does not have a message
        setError(new Error('decryption error: ' + (err.message || err.name)))
      })
  }, [query.data, decryptWallet, ready])

  useRefetchOnChange(query.refetch)

  return useMemo(() => ({
    ...query,
    error: error ?? query.error,
    loading: !wallets,
    data: wallets ? { wallets } : null
  }), [query, error, wallets])
}

function useRefetchOnChange (refetch) {
  const { me } = useMe()
  const walletsUpdatedAt = useWalletsUpdatedAt()

  useEffect(() => {
    if (!me?.id) return

    refetch()
  }, [refetch, me?.id, walletsUpdatedAt])
}

export function useDecryptedWallet (wallet) {
  const { decryptWallet, ready } = useWalletDecryption()
  const [decryptedWallet, setDecryptedWallet] = useState(server2Client(wallet))

  useEffect(() => {
    if (!ready || !wallet) return
    decryptWallet(wallet)
      .then(server2Client)
      .then(wallet => setDecryptedWallet(wallet))
      .catch(err => {
        console.error('failed to decrypt wallet:', err)
      })
  }, [decryptWallet, wallet, ready])

  return decryptedWallet
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
  const [mutate] = useMutation(UPDATE_WALLET_ENCRYPTION)
  const setKey = useSetKey()
  const { encryptConfig } = useEncryptConfig()

  return useCallback(async ({ key, hash }) => {
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

    await mutate({ variables: { keyHash: hash, wallets: data } })

    await setKey({ key, hash })
  }, [wallets, mutate, setKey, encryptConfig])
}

export function useWalletReset () {
  const [mutate] = useMutation(RESET_WALLETS)

  return useCallback(async ({ newKeyHash }) => {
    await mutate({ variables: { newKeyHash } })
  }, [mutate])
}

export function useDisablePassphraseExport () {
  const [mutate] = useMutation(DISABLE_PASSPHRASE_EXPORT)

  return useCallback(async () => {
    await mutate()
  }, [mutate])
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

function protocolUpsertMutation (protocol) {
  switch (protocol.name) {
    case 'LNBITS':
      return protocol.send ? UPSERT_WALLET_SEND_LNBITS : UPSERT_WALLET_RECEIVE_LNBITS
    case 'PHOENIXD':
      return protocol.send ? UPSERT_WALLET_SEND_PHOENIXD : UPSERT_WALLET_RECEIVE_PHOENIXD
    case 'BLINK':
      return protocol.send ? UPSERT_WALLET_SEND_BLINK : UPSERT_WALLET_RECEIVE_BLINK
    case 'LN_ADDR':
      return protocol.send ? NOOP_MUTATION : UPSERT_WALLET_RECEIVE_LIGHTNING_ADDRESS
    case 'NWC':
      return protocol.send ? UPSERT_WALLET_SEND_NWC : UPSERT_WALLET_RECEIVE_NWC
    case 'CLN_REST':
      return protocol.send ? UPSERT_WALLET_SEND_CLN_REST : UPSERT_WALLET_RECEIVE_CLN_REST
    case 'LND_GRPC':
      return protocol.send ? NOOP_MUTATION : UPSERT_WALLET_RECEIVE_LND_GRPC
    case 'LNC':
      return protocol.send ? UPSERT_WALLET_SEND_LNC : NOOP_MUTATION
    case 'WEBLN':
      return protocol.send ? UPSERT_WALLET_SEND_WEBLN : NOOP_MUTATION
    case 'CLINK':
      return protocol.send ? NOOP_MUTATION : UPSERT_WALLET_RECEIVE_CLINK
    default:
      return NOOP_MUTATION
  }
}

function protocolTestMutation (protocol) {
  if (protocol.send) return NOOP_MUTATION

  switch (protocol.name) {
    case 'LNBITS':
      return TEST_WALLET_RECEIVE_LNBITS
    case 'PHOENIXD':
      return TEST_WALLET_RECEIVE_PHOENIXD
    case 'BLINK':
      return TEST_WALLET_RECEIVE_BLINK
    case 'LN_ADDR':
      return TEST_WALLET_RECEIVE_LIGHTNING_ADDRESS
    case 'NWC':
      return TEST_WALLET_RECEIVE_NWC
    case 'CLN_REST':
      return TEST_WALLET_RECEIVE_CLN_REST
    case 'LND_GRPC':
      return TEST_WALLET_RECEIVE_LND_GRPC
    case 'CLINK':
      return TEST_WALLET_RECEIVE_CLINK
    default:
      return NOOP_MUTATION
  }
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

// TODO(wallet-v2): remove migration code
// =============================================================
// ****** Below is the migration code for WALLET v1 -> v2 ******
//   remove when we can assume migration is complete (if ever)
// =============================================================

export function useWalletMigrationMutation () {
  const wallets = useWallets()
  const loading = useWalletsLoading()
  const client = useApolloClient()
  const { encryptConfig, ready } = useEncryptConfig()

  // XXX We use a ref for the wallets to avoid duplicate wallets
  //   Without a ref, the migrate callback would depend on the wallets and thus update every time the migration creates a wallet.
  //   This update would then cause the useEffect in wallets/client/context/hooks that triggers the migration to run again before the first migration is complete.
  const walletsRef = useRef(wallets)
  useEffect(() => {
    if (!loading) walletsRef.current = wallets
  }, [loading])

  const migrate = useCallback(async ({ name, enabled, ...configV1 }) => {
    const protocol = { name, send: true }

    const configV2 = migrateConfig(protocol, configV1)

    const isSameProtocol = (p) => {
      const sameName = p.name === protocol.name
      const sameSend = p.send === protocol.send
      const sameConfig = Object.keys(p.config)
        .filter(k => !['__typename', 'id'].includes(k))
        .every(k => p.config[k] === configV2[k])
      return sameName && sameSend && sameConfig
    }

    const exists = walletsRef.current.some(w => w.name === name && w.protocols.some(isSameProtocol))
    if (exists) return

    const schema = protocolClientSchema(protocol)
    await schema.validate(configV2)

    const encrypted = await encryptConfig(configV2, { protocol })

    // decide if we create a new wallet (templateName) or use an existing one (walletId)
    const templateName = getWalletTemplateName(protocol)
    let walletId
    const wallet = walletsRef.current.find(w =>
      w.name === name && !w.protocols.some(p => p.name === protocol.name && p.send)
    )
    if (wallet) {
      walletId = Number(wallet.id)
    }

    await client.mutate({
      mutation: protocolUpsertMutation(protocol),
      variables: {
        ...(walletId ? { walletId } : { templateName }),
        enabled,
        ...encrypted
      }
    })
  }, [client, encryptConfig])

  return useMemo(() => ({ migrate, ready: ready && !loading }), [migrate, ready, loading])
}

export function useUpdateKeyHash () {
  const [mutate] = useMutation(UPDATE_KEY_HASH)

  return useCallback(async (keyHash) => {
    await mutate({ variables: { keyHash } })
  }, [mutate])
}

function migrateConfig (protocol, config) {
  switch (protocol.name) {
    case 'LNBITS':
      return {
        url: config.url,
        apiKey: config.adminKey
      }
    case 'PHOENIXD':
      return {
        url: config.url,
        apiKey: config.primaryPassword
      }
    case 'BLINK':
      return {
        url: config.url,
        apiKey: config.apiKey,
        currency: config.currency
      }
    case 'LNC':
      return {
        pairingPhrase: config.pairingPhrase,
        localKey: config.localKey,
        remoteKey: config.remoteKey,
        serverHost: config.serverHost
      }
    case 'WEBLN':
      return {}
    case 'NWC':
      return {
        url: config.nwcUrl
      }
    default:
      return config
  }
}

function getWalletTemplateName (protocol) {
  switch (protocol.name) {
    case 'LNBITS':
    case 'PHOENIXD':
    case 'BLINK':
    case 'NWC':
      return protocol.name
    case 'LNC':
      return 'LND'
    case 'WEBLN':
      return 'ALBY'
    default:
      return null
  }
}
