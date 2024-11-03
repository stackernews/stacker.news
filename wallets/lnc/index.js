import bip39Words from '@/lib/bip39-words'
import { string } from '@/lib/yup'

export const name = 'lnc'
export const walletType = 'LNC'
export const walletField = 'walletLNC'

export const fields = [
  {
    name: 'pairingPhrase',
    label: 'pairing phrase',
    type: 'password',
    help: 'We only need permissions for the uri `/lnrpc.Lightning/SendPaymentSync`\n\nCreate a budgeted account with narrow permissions:\n\n```$ litcli accounts create --balance <budget>```\n\n```$ litcli sessions add --type custom --label <your label> --account_id <account_id> --uri /lnrpc.Lightning/SendPaymentSync```\n\nGrab the `pairing_secret_mnemonic` from the output and paste it here.',
    editable: false,
    clientOnly: true,
    validate: string()
      .test(async (value, context) => {
        const words = value ? value.trim().split(/[\s]+/) : []
        for (const w of words) {
          try {
            await string().oneOf(bip39Words).validate(w)
          } catch {
            return context.createError({ message: `'${w}' is not a valid pairing phrase word` })
          }
        }
        if (words.length < 2) {
          return context.createError({ message: 'needs at least two words' })
        }
        if (words.length > 10) {
          return context.createError({ message: 'max 10 words' })
        }
        return true
      })
  },
  {
    name: 'localKey',
    type: 'text',
    hidden: true,
    clientOnly: true,
    generated: true,
    validate: string()
  },
  {
    name: 'remoteKey',
    type: 'text',
    hidden: true,
    clientOnly: true,
    generated: true,
    validate: string()
  },
  {
    name: 'serverHost',
    type: 'text',
    hidden: true,
    clientOnly: true,
    generated: true,
    validate: string()
  }
]

export const card = {
  title: 'LNC',
  subtitle: 'use Lightning Node Connect for LND payments',
  badges: ['send', 'budgetable']
}
