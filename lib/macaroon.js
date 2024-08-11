import { importMacaroon, base64ToBytes } from 'macaroon'
import { MacaroonId } from './macaroon-id'
import isEqual from 'lodash/isEqual'
import isEqualWith from 'lodash/isEqualWith'
import { ensureB64 } from './format'

function decodeMacaroon (macaroon) {
  macaroon = ensureB64(macaroon)
  return importMacaroon(Buffer.from(macaroon, 'base64'))
}

function macaroonOPs (macaroon) {
  try {
    const m = decodeMacaroon(macaroon)
    const macJson = m.exportJSON()

    if (macJson.i64) {
      const identBytes = Buffer.from(base64ToBytes(macJson.i64))
      if (identBytes[0] === 0x03) {
        const id = MacaroonId.decode(identBytes.slice(1))
        return id.toJSON().ops
      }
    }
  } catch (e) {
    console.error('macaroonOPs error:', e.message)
  }

  return []
}

function arrayCustomizer (value1, value2) {
  if (Array.isArray(value1) && Array.isArray(value2)) {
    value1.sort()
    value2.sort()
    return value1.length === value2.length &&
     (isEqual(value1, value2) || value1.every((v, i) => isEqualWith(v, value2[i], arrayCustomizer)))
  }
}

export function isInvoicableMacaroon (macaroon) {
  return isEqualWith(macaroonOPs(macaroon), INVOICABLE_MACAROON_OPS, arrayCustomizer)
}

export function isInvoiceMacaroon (macaroon) {
  return isEqualWith(macaroonOPs(macaroon), INVOICE_MACAROON_OPS, arrayCustomizer)
}

export function isAdminMacaroon (macaroon) {
  return isEqualWith(macaroonOPs(macaroon), ADMIN_MACAROON_OPS, arrayCustomizer)
}

export function isReadOnlyMacaroon (macaroon) {
  return isEqualWith(macaroonOPs(macaroon), READ_ONLY_MACAROON_OPS, arrayCustomizer)
}

const INVOICABLE_MACAROON_OPS = [
  {
    entity: 'invoices',
    actions: [
      'read',
      'write'
    ]
  }
]

const INVOICE_MACAROON_OPS = [
  {
    entity: 'address',
    actions: [
      'read',
      'write'
    ]
  },
  {
    entity: 'invoices',
    actions: [
      'read',
      'write'
    ]
  },
  {
    entity: 'onchain',
    actions: [
      'read'
    ]
  }
]

const ADMIN_MACAROON_OPS = [
  {
    entity: 'address',
    actions: [
      'read',
      'write'
    ]
  },
  {
    entity: 'info',
    actions: [
      'read',
      'write'
    ]
  },
  {
    entity: 'invoices',
    actions: [
      'read',
      'write'
    ]
  },
  {
    entity: 'macaroon',
    actions: [
      'generate',
      'read',
      'write'
    ]
  },
  {
    entity: 'message',
    actions: [
      'read',
      'write'
    ]
  },
  {
    entity: 'offchain',
    actions: [
      'read',
      'write'
    ]
  },
  {
    entity: 'onchain',
    actions: [
      'read',
      'write'
    ]
  },
  {
    entity: 'peers',
    actions: [
      'read',
      'write'
    ]
  },
  {
    entity: 'signer',
    actions: [
      'generate',
      'read'
    ]
  }
]

const READ_ONLY_MACAROON_OPS = [
  {
    entity: 'address',
    actions: [
      'read'
    ]
  },
  {
    entity: 'info',
    actions: [
      'read'
    ]
  },
  {
    entity: 'invoices',
    actions: [
      'read'
    ]
  },
  {
    entity: 'macaroon',
    actions: [
      'read'
    ]
  },
  {
    entity: 'message',
    actions: [
      'read'
    ]
  },
  {
    entity: 'offchain',
    actions: [
      'read'
    ]
  },
  {
    entity: 'onchain',
    actions: [
      'read'
    ]
  },
  {
    entity: 'peers',
    actions: [
      'read'
    ]
  },
  {
    entity: 'signer',
    actions: [
      'read'
    ]
  }
]
