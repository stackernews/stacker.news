import { addMethod, string, mixed, array } from 'yup'
import { parseNwcUrl } from './url'
import { NOSTR_PUBKEY_HEX } from './nostr'
import { ensureB64, HEX_REGEX } from './format'
export * from 'yup'

function orFunc (schemas, msg) {
  return this.test({
    name: 'or',
    message: msg,
    test: value => {
      if (Array.isArray(schemas) && schemas.length > 1) {
        const resee = schemas.map(schema => schema.isValidSync(value))
        return resee.some(res => res)
      } else {
        throw new TypeError('Schemas is not correct array schema')
      }
    },
    exclusive: false
  })
}

addMethod(mixed, 'or', orFunc)
addMethod(string, 'or', orFunc)

addMethod(string, 'hexOrBase64', function (schemas, msg = 'invalid hex or base64 encoding') {
  return this.test({
    name: 'hex-or-base64',
    message: 'invalid encoding',
    test: (val) => {
      if (typeof val === 'undefined') return true
      try {
        ensureB64(val)
        return true
      } catch {
        return false
      }
    }
  }).transform(val => {
    try {
      return ensureB64(val)
    } catch {
      return val
    }
  })
})

addMethod(string, 'url', function (schemas, msg = 'invalid url') {
  return this.test({
    name: 'url',
    message: msg,
    test: value => {
      try {
        // eslint-disable-next-line no-new
        new URL(value)
        return true
      } catch (e) {
        try {
          // eslint-disable-next-line no-new
          new URL(`http://${value}`)
          return true
        } catch (e) {
          return false
        }
      }
    },
    exclusive: false
  })
})

addMethod(string, 'ws', function (schemas, msg = 'invalid websocket') {
  return this.test({
    name: 'ws',
    message: msg,
    test: value => {
      if (typeof value === 'undefined') return true
      try {
        const url = new URL(value)
        return url.protocol === 'ws:' || url.protocol === 'wss:'
      } catch (e) {
        return false
      }
    },
    exclusive: false
  })
})

addMethod(string, 'socket', function (schemas, msg = 'invalid socket') {
  return this.test({
    name: 'socket',
    message: msg,
    test: value => {
      try {
        const url = new URL(`http://${value}`)
        return url.hostname && url.port && !url.username && !url.password &&
            (!url.pathname || url.pathname === '/') && !url.search && !url.hash
      } catch (e) {
        return false
      }
    },
    exclusive: false
  })
})

addMethod(string, 'https', function () {
  return this.test({
    name: 'https',
    message: 'https required',
    test: (url) => {
      try {
        return new URL(url).protocol === 'https:'
      } catch {
        return false
      }
    }
  })
})

addMethod(string, 'wss', function (msg) {
  return this.test({
    name: 'wss',
    message: msg || 'wss required',
    test: (url) => {
      try {
        return new URL(url).protocol === 'wss:'
      } catch {
        return false
      }
    }
  })
})

addMethod(string, 'hex', function (msg) {
  return this.test({
    name: 'hex',
    message: msg || 'invalid hex encoding',
    test: (value) => !value || HEX_REGEX.test(value)
  })
})

addMethod(string, 'nwcUrl', function () {
  return this.test({
    test: (nwcUrl, context) => {
      if (!nwcUrl) return true

      // run validation in sequence to control order of errors
      // inspired by https://github.com/jquense/yup/issues/851#issuecomment-1049705180
      try {
        string().matches(/^nostr\+?walletconnect:\/\//, { message: 'must start with nostr+walletconnect://' }).validateSync(nwcUrl)
        let relayUrls, walletPubkey, secret
        try {
          ({ relayUrls, walletPubkey, secret } = parseNwcUrl(nwcUrl))
        } catch {
          // invalid URL error. handle as if pubkey validation failed to not confuse user.
          throw new Error('pubkey must be 64 hex chars')
        }
        string().required('pubkey required').trim().matches(NOSTR_PUBKEY_HEX, 'pubkey must be 64 hex chars').validateSync(walletPubkey)
        array().of(string().required('relay url required').trim().wss('relay must use wss://')).min(1, 'at least one relay required').validateSync(relayUrls)
        string().required('secret required').trim().matches(/^[0-9a-fA-F]{64}$/, 'secret must be 64 hex chars').validateSync(secret)
      } catch (err) {
        return context.createError({ message: err.message })
      }
      return true
    }
  })
})

addMethod(array, 'equalto', function equals (
  { required, optional },
  message
) {
  return this.test({
    name: 'equalto',
    message: message || `${this.path} has invalid values`,
    test: function (items = []) {
      if (items.length < required.length) {
        return this.createError({ message: `Expected ${this.path} to be at least ${required.length} items, but got ${items.length}` })
      }
      if (items.length > required.length + optional.length) {
        return this.createError({ message: `Expected ${this.path} to be at most ${required.length + optional.length} items, but got ${items.length}` })
      }
      const remainingRequiredSchemas = [...required]
      const remainingOptionalSchemas = [...optional]
      for (let i = 0; i < items.length; i++) {
        const requiredIndex = remainingRequiredSchemas.findIndex(schema => schema.isValidSync(items[i], { strict: true }))
        if (requiredIndex === -1) {
          const optionalIndex = remainingOptionalSchemas.findIndex(schema => schema.isValidSync(items[i], { strict: true }))
          if (optionalIndex === -1) {
            return this.createError({ message: `${this.path}[${i}] has invalid value` })
          }
          remainingOptionalSchemas.splice(optionalIndex, 1)
          continue
        }
        remainingRequiredSchemas.splice(requiredIndex, 1)
      }

      return true
    }
  })
})
