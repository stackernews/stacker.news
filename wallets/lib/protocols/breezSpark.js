import { bip39Validator } from '@/wallets/lib/validate'
import { generateRandomPassphrase } from '@/wallets/lib/crypto'
import { bech32m } from 'bech32'

// Spark
// https://github.com/breez/spark-sdk
// https://sdk-doc-spark.breez.technology/
// https://breez.github.io/spark-sdk/breez_sdk_spark/

export default {
  name: 'BREEZ_SPARK',
  send: true,
  displayName: 'Spark',
  fields: [
    {
      name: 'mnemonic',
      label: 'mnemonic',
      type: 'password',
      required: true,
      validate: bip39Validator(),
      encrypt: true,
      initial: generateRandomPassphrase,
      disabled: true
    },
    {
      name: 'username'
    }
  ],
  relationName: 'walletSendBreezSpark'
}

function getIdentityPublicKey (sparkAddress) {
  const decoded = bech32m.decode(sparkAddress)
  const pubkey = Buffer.from(bech32m.fromWords(decoded.words)).toString('hex').slice(4)
  return pubkey
}

export function getUsername (sparkAddress) {
  const identityPublicKey = getIdentityPublicKey(sparkAddress)
  // max lnurl username length is 64 characters
  // https://github.com/breez/spark-sdk/blob/71b8cb097d2bc846be427599b1bf44eae897786f/crates/breez-sdk/lnurl/src/routes.rs#L326
  return identityPublicKey.slice(0, 64)
}
