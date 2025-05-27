import {
  externalLightningAddressValidator,
  runeValidator,
  nwcUrlValidator,
  socketValidator,
  invoiceMacaroonValidator,
  certValidator,
  bip39Validator,
  urlValidator,
  hexValidator
} from '@/wallets/lib/validate'
import { string } from 'yup'

/** @type {Protocol[]} Nostr Wallet Connect (NIP-47) */
// https://github.com/nostr-protocol/nips/blob/master/47.md
const nwcSuite = [
  {
    name: 'NWC',
    send: true,
    displayName: 'Nostr Wallet Connect',
    fields: [
      {
        name: 'url',
        label: 'url',
        placeholder: 'nostr+walletconnect://',
        type: 'password',
        required: true,
        validate: nwcUrlValidator()
      }
    ]
  },
  {
    name: 'NWC',
    send: false,
    displayName: 'Nostr Wallet Connect',
    fields: [
      {
        name: 'url',
        label: 'url',
        placeholder: 'nostr+walletconnect://',
        type: 'text',
        required: true,
        validate: nwcUrlValidator()
      }
    ]
  }
]

/** @type {Protocol} Lightning Address (LUD-16) */
// https://github.com/lnurl/luds/blob/luds/16.md
const lnAddr = {
  name: 'LN_ADDR',
  displayName: 'Lightning Address',
  send: false,
  fields: [
    {
      name: 'address',
      label: 'address',
      type: 'text',
      required: true,
      validate: externalLightningAddressValidator()
    }
  ]
}

/** @type {Protocol} Core Lightning REST API */
// https://docs.corelightning.org/docs/rest
const clnRest = {
  name: 'CLN_REST',
  displayName: 'CLNRest',
  send: false,
  fields: [
    {
      name: 'url',
      label: 'socket',
      type: 'text',
      required: true,
      validate: socketValidator()
    },
    {
      name: 'cert',
      label: 'certificate',
      type: 'password',
      validate: certValidator(),
      required: false
    },
    {
      name: 'rune',
      label: 'rune',
      type: 'password',
      validate: runeValidator({ method: 'invoice' }),
      required: true,
      hint: 'must be restricted to method=invoice'
    }
  ]
}

/** @type {Protocol} LND gRPC API */
const lndGrpc = {
  name: 'LND_GRPC',
  displayName: 'gRPC',
  send: false,
  fields: [
    {
      name: 'socket',
      label: 'socket',
      type: 'text',
      validate: socketValidator(),
      required: true
    },
    {
      name: 'macaroon',
      label: 'macaroon',
      type: 'password',
      validate: invoiceMacaroonValidator(),
      required: true
    },
    {
      name: 'cert',
      label: 'certificate',
      type: 'password',
      validate: certValidator(),
      required: false
    }
  ]
}

/** @type {Protocol} Lightning Node Connect */
// https://github.com/lightninglabs/lightning-node-connect
const lnc = {
  name: 'LNC',
  displayName: 'Lightning Node Connect',
  send: true,
  fields: [
    {
      name: 'pairingPhrase',
      label: 'pairing phrase',
      type: 'password',
      validate: bip39Validator(),
      required: true
    }
    // TODO(wallet-v2): some fields are generated during initial attachment and must also be validated and saved
  ]
}

/** @type {Protocol[]} LNbits */
// https://github.com/lnbits/lnbits
const lnbitsSuite = [
  {
    name: 'LNBITS',
    displayName: 'API',
    send: true,
    fields: [
      {
        name: 'url',
        label: 'url',
        type: 'text',
        validate: urlValidator('clearnet', 'tor'),
        required: true
      },
      {
        name: 'apiKey',
        label: 'admin key',
        type: 'password',
        validate: hexValidator(32),
        required: true
      }
    ]
  },
  {
    name: 'LNBITS',
    displayName: 'API',
    send: false,
    fields: [
      {
        name: 'url',
        label: 'url',
        type: 'text',
        validate: urlValidator('clearnet', 'tor'),
        required: true
      },
      {
        name: 'apiKey',
        type: 'password',
        label: 'invoice key',
        validate: hexValidator(32),
        required: true
      }
    ]
  }
]

/** @type {Protocol[]} Phoenixd */
// https://phoenix.acinq.co/server
const phoenixdSuite = [
  {
    name: 'PHOENIXD',
    displayName: 'API',
    send: true,
    fields: [
      {
        name: 'url',
        type: 'text',
        label: 'url',
        validate: urlValidator('clearnet'),
        required: true
      },
      {
        name: 'apiKey',
        type: 'password',
        label: 'api key',
        validate: hexValidator(64),
        required: true
      }
    ]
  },
  {
    name: 'PHOENIXD',
    displayName: 'API',
    send: false,
    fields: [
      {
        name: 'url',
        type: 'text',
        label: 'url',
        validate: urlValidator('clearnet'),
        required: true
      },
      {
        name: 'apiKey',
        type: 'password',
        label: 'api key',
        validate: hexValidator(64),
        required: true
      }
    ]
  }
]

const blinkApiKeyValidator = string().matches(/^blink_[A-Za-z0-9]+$/, 'must match pattern blink_A-Za-z0-9')
const blinkCurrencyValidator = string().oneOf(['BTC', 'USD'])

/** @type {Protocol[]} Blink */
// http://blink.sv/
const blinkSuite = [
  {
    name: 'BLINK',
    displayName: 'API',
    send: true,
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        label: 'api key',
        validate: blinkApiKeyValidator,
        required: true
      },
      {
        name: 'currency',
        label: 'currency',
        type: 'text',
        required: true,
        validate: blinkCurrencyValidator
      }
    ]
  },
  {
    name: 'BLINK',
    displayName: 'API',
    send: false,
    fields: [
      {
        name: 'apiKey',
        type: 'password',
        label: 'api key',
        validate: blinkApiKeyValidator,
        required: true
      },
      {
        name: 'currency',
        label: 'currency',
        type: 'text',
        required: true,
        validate: blinkCurrencyValidator
      }
    ]
  }
]

/** @type {Protocol} WebLN */
// https://webln.guide/
const webln = {
  name: 'WEBLN',
  displayName: 'WebLN',
  send: true,
  fields: []
}

export default [
  ...nwcSuite,
  lnAddr,
  clnRest,
  lndGrpc,
  lnc,
  ...phoenixdSuite,
  ...lnbitsSuite,
  ...blinkSuite,
  webln
]
