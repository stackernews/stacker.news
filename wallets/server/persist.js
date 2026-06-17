import { GqlInputError } from '@/lib/error'
import { validateSchema } from '@/lib/validate'
import protocols from '@/wallets/lib/protocols'
import { isEncryptedField, protocolRelationName, protocolServerSchema, reverseProtocolRelationName } from '@/wallets/lib/util'

// Persistence mechanics for the polymorphic wallet-protocol model (parent
// WalletProtocol + a typed child table per protocol + a trigger-maintained
// `config` JSON mirror over Vault-encrypted secrets). The GraphQL resolvers in
// resolvers/protocol.js and resolvers/wallet.js drive these; the trigger/model
// quirks (the materialized-config "touch", the @oneOf decode) live here.

// Decode a @oneOf protocol-config wrapper into { protocol, config }. GraphQL
// already enforced exactly one branch; unwraps the WebLN boolean sentinel.
export function decodeProtocolConfig (wrapper) {
  const [relationName, value] = Object.entries(wrapper)[0]
  const protocol = reverseProtocolRelationName(relationName)
  if (!protocol) throw new GqlInputError(`unknown wallet protocol: ${relationName}`)
  if (typeof value === 'boolean') {
    if (value !== true) throw new GqlInputError(`${relationName} must be true`)
    return { protocol, config: {} }
  }
  return { protocol, config: value }
}

// Validate a protocol's config against its server schema, prefixing any error
// with the relation name. Pass `{ keyHash }` on save and rotation to bind
// encrypted fields to the current vault key; plaintext receive probes have no
// encrypted fields and therefore do not need it.
export async function validateProtocolConfig (protocol, config, keyOpts = {}) {
  try {
    await validateSchema(protocolServerSchema(protocol, keyOpts), config)
  } catch (e) {
    throw new GqlInputError(`${protocolRelationName(protocol)}: ${e.message}`)
  }
}

// True when the config persists a vault-encrypted secret — the case that needs
// the materialized-config re-touch and the vault-key OCC.
export function hasEncryptedField (protocol, config) {
  return Object.keys(config).some(key => isEncryptedField(protocol, key))
}

// Upsert a single protocol inside a Prisma transaction. Used by the atomic
// `saveWalletProtocols` mutation.
export async function upsertProtocolInTransaction ({ tx, walletId, userId, protocol, enabled, config }) {
  const relation = protocolRelationName(protocol)
  const id = Number(walletId)

  await tx.wallet.update({
    where: {
      id,
      // this makes sure that users can only update their own wallets
      // (the update will fail in this case and abort the transaction)
      userId
    },
    data: {
      protocols: {
        upsert: {
          where: {
            WalletProtocol_walletId_send_name_key: {
              walletId: id,
              send: protocol.send,
              name: protocol.name
            }
          },
          update: {
            enabled,
            [relation]: {
              update: dataFragment(protocol, config, 'update')
            }
          },
          create: {
            enabled,
            send: protocol.send,
            name: protocol.name,
            [relation]: {
              create: dataFragment(protocol, config, 'create')
            }
          }
        }
      }
    },
    select: {
      id: true
    }
  })
  if (hasEncryptedField(protocol, config)) {
    await touchProtocolRelationForMaterializedConfig({ tx, walletId: id, protocol })
  }
}

// Update an existing protocol's config under a new vault key. Used by
// `updateWalletEncryption` during passphrase rotation; the caller has already
// authenticated and started a transaction, so this is a plain helper rather
// than a GraphQL resolver. `enabled` is intentionally left unchanged.
export async function updateExistingProtocolConfigInTransaction ({ tx, walletId, userId, name, send, config, keyHash }) {
  const protocol = protocols.find(p => p.name === name && p.send === send)
  if (!protocol) throw new GqlInputError(`unknown protocol: ${name}/${send ? 'send' : 'recv'}`)
  await validateProtocolConfig(protocol, config, { keyHash })
  const relation = protocolRelationName(protocol)
  const id = Number(walletId)
  const existing = await tx.walletProtocol.findFirst({
    where: {
      walletId: id,
      name,
      send,
      wallet: {
        userId
      }
    },
    select: {
      id: true
    }
  })

  if (!existing) throw new GqlInputError('wallet changed, please retry rotation')

  const updated = await tx.walletProtocol.update({
    where: {
      id: existing.id
    },
    data: {
      [relation]: {
        update: dataFragment(protocol, config, 'update')
      }
    },
    select: {
      id: true
    }
  })
  if (hasEncryptedField(protocol, config)) {
    await touchProtocolRelationForMaterializedConfig({ tx, walletId: id, protocol })
  }
  return updated
}

function dataFragment (protocol, args, type) {
  return Object.fromEntries(
    Object.entries(args).map(
      ([key, value]) => {
        if (isEncryptedField(protocol, key)) {
          return [key, { [type]: { value: value.value, iv: value.iv } }]
        }
        return [key, value]
      }
    )
  )
}

// The wallet_to_jsonb trigger materializes Vault rows into WalletProtocol.config,
// but Prisma writes the relation table before the Vault rows it references, so we
// touch the relation row again to make the immediate trigger see the final Vault
// values. Only needed when the config has an encrypted (Vault-backed) field.
async function touchProtocolRelationForMaterializedConfig ({ tx, walletId, protocol }) {
  await tx.walletProtocol.update({
    where: {
      WalletProtocol_walletId_send_name_key: {
        walletId: Number(walletId),
        send: protocol.send,
        name: protocol.name
      }
    },
    data: {
      [protocolRelationName(protocol)]: {
        update: {
          updatedAt: new Date()
        }
      }
    },
    select: {
      id: true
    }
  })
}

// Resolve the target wallet for a save: create a new one from the template, or
// verify ownership of an existing one. The explicit ownership check beats the
// opaque "record not found" the following nested writes would otherwise raise.
export async function resolveWalletForSave (tx, { walletId, templateName, userId }) {
  if (templateName) {
    const { id } = await tx.wallet.create({ data: { templateName, userId } })
    return id
  }
  const id = Number(walletId)
  const owned = await tx.wallet.findUnique({ where: { id, userId }, select: { id: true } })
  if (!owned) throw new GqlInputError('wallet not found')
  return id
}

export async function applyRemoves (tx, { removeIds, walletId, userId }) {
  if (removeIds.length === 0) return
  // vaults are deleted via trigger
  const { count } = await tx.walletProtocol.deleteMany({
    where: { id: { in: removeIds }, walletId, wallet: { userId } }
  })
  if (count !== removeIds.length) {
    throw new GqlInputError('one or more wallet protocols to remove were not found')
  }
}

// Drop a wallet with no protocols left so the user isn't shown an empty stub on
// the configure page. Returns whether it deleted.
export async function deleteWalletIfEmpty (tx, walletId) {
  const protocolCount = await tx.walletProtocol.count({ where: { walletId } })
  if (protocolCount > 0) return false
  await tx.wallet.delete({ where: { id: walletId } })
  return true
}

// Verify-only OCC: lock the user row and confirm the vault key still matches the
// hash the encrypted configs were validated against; abort if a passphrase
// rotation committed meanwhile, so we never persist a send secret under a stale
// key. (updateWalletEncryption/resetWallets use the other OCC style — a
// conditional key *write* via updateVaultMetadata — since they rotate the key.)
export async function assertVaultKeyUnchanged (tx, userId, expectedHash) {
  const [current] = await tx.$queryRaw`
    -- FOR NO KEY UPDATE (not FOR UPDATE): this is a non-key read/guard, so it still
    -- serializes against the passphrase rotation (a non-key vaultKeyHash write) but
    -- doesn't upgrade the user-row lock this tx already holds — which would deadlock
    -- with another tx escalating its own lock on the same row.
    SELECT "vaultKeyHash" FROM users WHERE id = ${userId} FOR NO KEY UPDATE`
  if (current?.vaultKeyHash !== expectedHash) {
    throw new GqlInputError('passphrase changed, please retry')
  }
}
