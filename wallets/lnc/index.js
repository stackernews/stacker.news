import { lncSchema } from '@/lib/validate'
import { sendPayment, validate } from 'wallets/lnc/client'

export const name = 'lnc'

export const fields = [
  {
    name: 'pairingPhrase',
    label: 'pairing phrase',
    type: 'password',
    help: 'We only need permissions for the uri `/lnrpc.Lightning/SendPaymentSync`\n\nCreate a budgeted account with narrow permissions:\n\n```$ litcli accounts create --balance <budget>```\n\n```$ litcli sessions add --type custom --label <your label> --account_id <account_id> --uri /lnrpc.Lightning/SendPaymentSync```\n\nGrab the `pairing_secret_mnemonic` from the output and paste it here.'
  },
  {
    name: 'password',
    label: 'password',
    type: 'password',
    hint: 'encrypts your pairing phrase when stored locally',
    optional: true
  }
]

export const card = {
  title: 'LNC',
  subtitle: 'use Lightning Node Connect for LND payments',
  badges: ['send only', 'non-custodialish', 'budgetable']
}

export const schema = lncSchema

export { sendPayment, validate }
