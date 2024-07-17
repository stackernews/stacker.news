import { NOSTR_PUBKEY_HEX } from '@/lib/nostr'
import { parseNwcUrl } from '@/lib/url'
import { string } from 'yup'

export const name = 'nwc'

export const fields = [
  {
    name: 'nwcUrl',
    label: 'connection',
    type: 'password',
    validate: {
      type: 'string',
      test: async (nwcUrl, context) => {
        // run validation in sequence to control order of errors
        // inspired by https://github.com/jquense/yup/issues/851#issuecomment-1049705180
        try {
          await string().required('required').validate(nwcUrl)
          await string().matches(/^nostr\+?walletconnect:\/\//, { message: 'must start with nostr+walletconnect://' }).validate(nwcUrl)
          let relayUrl, walletPubkey, secret
          try {
            ({ relayUrl, walletPubkey, secret } = parseNwcUrl(nwcUrl))
          } catch {
            // invalid URL error. handle as if pubkey validation failed to not confuse user.
            throw new Error('pubkey must be 64 hex chars')
          }
          await string().required('pubkey required').trim().matches(NOSTR_PUBKEY_HEX, 'pubkey must be 64 hex chars').validate(walletPubkey)
          await string().required('relay url required').trim().wss('relay must use wss://').validate(relayUrl)
          await string().required('secret required').trim().matches(/^[0-9a-fA-F]{64}$/, 'secret must be 64 hex chars').validate(secret)
        } catch (err) {
          return context.createError({ message: err.message })
        }
        return true
      }
    }
  }
]

export const card = {
  title: 'NWC',
  subtitle: 'use Nostr Wallet Connect for payments',
  badges: ['send only', 'non-custodialish']
}
