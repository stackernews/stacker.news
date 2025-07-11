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
  DISABLE_PASSPHRASE_EXPORT,
  SET_WALLET_PRIORITIES,
  UPDATE_KEY_HASH
} from '@/wallets/client/fragments'
import { useApolloClient, useMutation, useQuery } from '@apollo/client'
import { useDecryption, useEncryption, useSetKey, useWalletLogger, WalletStatus } from '@/wallets/client/hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  isEncryptedField, isTemplate, isWallet, protocolAvailable, protocolClientSchema, reverseProtocolRelationName
} from '@/wallets/lib/util'
import { protocolTestSendPayment } from '@/wallets/client/protocols'
import { timeoutSignal } from '@/lib/time'
import { WALLET_SEND_PAYMENT_TIMEOUT_MS } from '@/lib/constants'
import { useToast } from '@/components/toast'
import { useMe } from '@/components/me'
import { useWallets, useLoading as useWalletsLoading } from '@/wallets/client/context'

export function useWalletsQuery () {
  const { me } = useMe()
  const query = useQuery(WALLETS, { skip: !me })
  const [wallets, setWallets] = useState(null)

  const { decryptWallet, ready } = useWalletDecryption()

  useEffect(() => {
    if (!query.data?.wallets || !ready) return
    Promise.all(
      query.data?.wallets.map(w => decryptWallet(w))
    )
      .then(wallets => wallets.map(protocolCheck))
      .then(wallets => wallets.map(undoFieldAlias))
      .then(wallets => setWallets(wallets))
      .catch(err => {
        console.error('failed to decrypt wallets:', err)
        setWallets([])
      })
  }, [query.data, decryptWallet, ready])

  useRefetchOnChange(query.refetch)

  return useMemo(() => ({
    ...query,
    loading: !wallets,
    data: wallets ? { wallets } : null
  }), [query, wallets])
}

function protocolCheck (wallet) {
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

function undoFieldAlias ({ id, ...wallet }) {
  // Just like for encrypted fields, we have to use a field alias for the name field of templates
  // because of https://github.com/graphql/graphql-js/issues/53.
  // We undo this here so this only affects the GraphQL layer but not the rest of the code.
  if (isTemplate(wallet)) {
    return { ...wallet, name: id }
  }

  if (!wallet.template) return wallet

  const { id: templateId, ...template } = wallet.template
  return { id, ...wallet, template: { name: templateId, ...template } }
}

function useRefetchOnChange (refetch) {
  const { me } = useMe()

  useEffect(() => {
    if (!me?.id) return

    refetch()
  }, [refetch, me?.id, me?.privates?.walletsUpdatedAt])
}

export function useWalletQuery ({ id, name }) {
  const { me } = useMe()
  const query = useQuery(WALLET, { variables: { id, name }, skip: !me })
  const [wallet, setWallet] = useState(null)

  const { decryptWallet, ready } = useWalletDecryption()

  useEffect(() => {
    if (!query.data?.wallet || !ready) return
    decryptWallet(query.data?.wallet)
      .then(protocolCheck)
      .then(undoFieldAlias)
      .then(wallet => setWallet(wallet))
      .catch(err => {
        console.error('failed to decrypt wallet:', err)
      })
  }, [query.data, decryptWallet, ready])

  return useMemo(() => ({
    ...query,
    loading: !wallet,
    data: wallet ? { wallet } : null
  }), [query, wallet])
}

export function useWalletProtocolUpsert (wallet, protocol) {
  const mutation = getWalletProtocolMutation(protocol)
  const [mutate] = useMutation(mutation)
  const { encryptConfig } = useEncryptConfig(protocol)
  const testSendPayment = useTestSendPayment(protocol)
  const logger = useWalletLogger(protocol)

  return useCallback(async (values) => {
    logger.info('saving wallet ...')

    if (isTemplate(protocol)) {
      values.enabled = true
    }

    // skip network tests if we're disabling the wallet
    const networkTests = values.enabled
    if (networkTests) {
      try {
        const additionalValues = await testSendPayment(values)
        values = { ...values, ...additionalValues }
      } catch (err) {
        logger.error(err.message)
        throw err
      }
    }

    const encrypted = await encryptConfig(values)

    const variables = encrypted
    if (!protocol.send) {
      variables.networkTests = networkTests
    }
    if (isWallet(wallet)) {
      variables.walletId = wallet.id
    } else {
      variables.templateName = wallet.name
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
  }, [wallet, protocol, logger, testSendPayment, encryptConfig, mutate])
}

export function useLightningAddressUpsert () {
  // TODO(wallet-v2): parse domain from address input to use correct wallet template
  // useWalletProtocolUpsert needs to support passing in the wallet in the callback for that
  const wallet = { name: 'LN_ADDR', __typename: 'WalletTemplate' }
  const protocol = { name: 'LN_ADDR', send: false, __typename: 'WalletProtocolTemplate' }
  return useWalletProtocolUpsert(wallet, protocol)
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
  const { encryptConfig } = useEncryptConfig()

  return useCallback(async ({ key, hash, wallets }) => {
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
  }, [mutate, encryptConfig])
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

    return await protocolTestSendPayment(
      protocol,
      values,
      { signal: timeoutSignal(WALLET_SEND_PAYMENT_TIMEOUT_MS) }
    )
  }, [protocol])
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
      mutation: getWalletProtocolMutation(protocol),
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
      return 'ALBY_BROWSER_EXTENSION'
    default:
      return null
  }
}
