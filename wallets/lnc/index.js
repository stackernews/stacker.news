import { lncSchema } from '@/lib/validate'

export const name = 'lnc'

export const fields = [
  {
    name: 'pairingPhrase',
    label: 'pairing phrase',
    type: 'password',
    help: 'We only need permissions for the uri `/lnrpc.Lightning/SendPaymentSync`\n\nCreate a budgeted account with narrow permissions:\n\n```$ litcli accounts create --balance <budget>```\n\n```$ litcli sessions add --type custom --label <your label> --account_id <account_id> --uri /lnrpc.Lightning/SendPaymentSync```\n\nGrab the `pairing_secret_mnemonic` from the output and paste it here.',
    editable: false
  },
  {
    name: 'localKey',
    type: 'text',
    optional: true,
    hidden: true
  },
  {
    name: 'remoteKey',
    type: 'text',
    optional: true,
    hidden: true
  },
  {
    name: 'serverHost',
    type: 'text',
    optional: true,
    hidden: true
  }
]

export const card = {
  title: 'LNC',
  subtitle: 'use Lightning Node Connect for LND payments',
  badges: ['send only', 'budgetable']
}

export const fieldValidation = lncSchema
