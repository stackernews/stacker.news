import { lncSchema } from '@/lib/validate'

export const name = 'lnc'

export const fields = [
  {
    name: 'pairingPhrase',
    label: 'pairing phrase',
    type: 'password',
    optional: 'for sending',
    clientOnly: true,
    help: 'We only need permissions for the uri `/lnrpc.Lightning/SendPaymentSync`\n\nCreate a budgeted account with narrow permissions:\n\n```$ litcli accounts create --balance <budget>```\n\n```$ litcli sessions add --type custom --label <your label> --account_id <account_id> --uri /lnrpc.Lightning/SendPaymentSync```\n\nGrab the `pairing_secret_mnemonic` from the output and paste it here.',
    editable: false
  },
  {
    name: 'localKey',
    type: 'text',
    optional: true,
    clientOnly: true,
    hidden: true
  },
  {
    name: 'remoteKey',
    type: 'text',
    optional: true,
    clientOnly: true,
    hidden: true
  },
  {
    name: 'serverHost',
    type: 'text',
    optional: true,
    clientOnly: true,
    hidden: true
  },
  {
    name: 'pairingPhraseRecv',
    label: 'pairing phrase',
    type: 'password',
    optional: 'for receiving',
    serverOnly: true,
    help: 'We only need permissions for the uri `/lnrpc.Lightning/AddInvoice`\n\nCreate an account with narrow permissions:\n\n```$ litcli accounts create```\n\n```$ litcli sessions add --type custom --label <your label> --account_id <account_id> --uri /lnrpc.Lightning/AddInvoice```\n\nGrab the `pairing_secret_mnemonic` from the output and paste it here.',
    editable: false
  },
  {
    name: 'localKeyRecv',
    type: 'text',
    optional: true,
    serverOnly: true,
    hidden: true
  },
  {
    name: 'remoteKeyRecv',
    type: 'text',
    optional: true,
    serverOnly: true,
    hidden: true
  },
  {
    name: 'serverHostRecv',
    type: 'text',
    optional: true,
    serverOnly: true,
    hidden: true
  }
]

export const card = {
  title: 'LNC',
  subtitle: 'use Lightning Node Connect for LND payments',
  badges: ['send & receive', 'budgetable']
}

export const fieldValidation = lncSchema

export const walletType = 'LNC'

export const walletField = 'walletLNC'

export function computePerms ({ canSend, canReceive }, strict = true) {
  const expectedPerms = []
  const unexpectedPerms = []
  const setPerm = (name, expected) => {
    if (expected) {
      expectedPerms.push(name)
    } else {
      unexpectedPerms.push(name)
    }
  }
  if (strict || canSend !== undefined) {
    setPerm('lnrpc.Lightning.SendPaymentSync', canSend)
  }
  if (strict || canReceive !== undefined) {
    setPerm('lnrpc.Lightning.AddInvoice', canReceive)
  }
  if (strict) {
    setPerm('lnrpc.Lightning.SendCoins', false)
    // ...
  }

  return { expectedPerms, unexpectedPerms }
}
