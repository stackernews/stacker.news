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

/**
 * Protocol names as used in the database
 * @typedef {'NWC'|'LNBITS'|'PHOENIXD'|'BLINK'|'WEBLN'|'LN_ADDR'|'LNC'|'CLN_REST'|'LND_GRPC'} ProtocolName
 * @typedef {'text'|'password'} InputType
 */

/**
 * @typedef {Object} Protocol
 * @property {ProtocolName} name - must match a protocol name in the database
 * @property {string} displayName - protocol name in user interface
 * @property {boolean} send - is this protocol for sending payments?
 * @property {ProtocolField[]} fields - protocol fields for configuration
 * @property {string} relationName - name of the relation in the ProtocolWallet prisma model
 */

/**
 * @typedef {Object} ProtocolField
 * @property {string} name - formik name
 * @property {string} label - field label shown in user interface
 * @property {InputType} type - input type (text, password)
 * @property {boolean} required - whether field is required
 * @property {yup.Schema} validate - validation rules to apply
 * @property {string} [placeholder] - placeholder text shown in input field
 * @property {string} [hint] - hint text shown below field
 */

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
        validate: nwcUrlValidator(),
        encrypt: true
      }
    ],
    relationName: 'walletSendNWC'
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
    ],
    relationName: 'walletRecvNWC'
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
  ],
  relationName: 'walletRecvLightningAddress'
}

/** @type {Protocol} Core Lightning REST API */
// https://docs.corelightning.org/docs/rest
const clnRest = {
  name: 'CLN_REST',
  displayName: 'CLNRest',
  send: false,
  fields: [
    {
      name: 'socket',
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
  ],
  relationName: 'walletRecvCLNRest'
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
  ],
  relationName: 'walletRecvLNDGRPC'
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
      required: true,
      encrypt: true
    }
    // TODO(wallet-v2): some fields are generated during initial attachment and must also be validated and saved
  ],
  relationName: 'walletSendLNC'
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
        required: true,
        encrypt: true
      }
    ],
    relationName: 'walletSendLNbits'
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
    ],
    relationName: 'walletRecvLNbits'
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
        required: true,
        encrypt: true
      }
    ],
    relationName: 'walletSendPhoenixd'
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
    ],
    relationName: 'walletRecvPhoenixd'
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
        required: true,
        encrypt: true
      },
      {
        name: 'currency',
        label: 'currency',
        type: 'text',
        required: true,
        validate: blinkCurrencyValidator,
        encrypt: true
      }
    ],
    relationName: 'walletSendBlink'
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
    ],
    relationName: 'walletRecvBlink'
  }
]

/** @type {Protocol} WebLN */
// https://webln.guide/
const webln = {
  name: 'WEBLN',
  displayName: 'WebLN',
  send: true,
  fields: [],
  relationName: 'walletSendWebLN'
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
