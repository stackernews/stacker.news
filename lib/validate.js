import { string, ValidationError, number, object, array, addMethod, boolean, date } from 'yup'
import {
  BOOST_MIN, MAX_POLL_CHOICE_LENGTH, MAX_TITLE_LENGTH, MAX_POLL_NUM_CHOICES,
  MIN_POLL_NUM_CHOICES, MAX_FORWARDS, BOOST_MULT, MAX_TERRITORY_DESC_LENGTH, POST_TYPES,
  TERRITORY_BILLING_TYPES, MAX_COMMENT_TEXT_LENGTH, MAX_POST_TEXT_LENGTH, MIN_TITLE_LENGTH, BOUNTY_MIN, BOUNTY_MAX, BALANCE_LIMIT_MSATS
} from './constants'
import { SUPPORTED_CURRENCIES } from './currency'
import { NOSTR_MAX_RELAY_NUM, NOSTR_PUBKEY_BECH32, NOSTR_PUBKEY_HEX } from './nostr'
import { msatsToSats, numWithUnits, abbrNum, ensureB64, B64_URL_REGEX } from './format'
import * as usersFragments from '@/fragments/users'
import * as subsFragments from '@/fragments/subs'
import { isInvoicableMacaroon, isInvoiceMacaroon } from './macaroon'
import { TOR_REGEXP, parseNwcUrl } from './url'
import { datePivot } from './time'
import { decodeRune } from '@/lib/cln'
import bip39Words from './bip39-words'

const { SUB } = subsFragments
const { NAME_QUERY } = usersFragments

export async function ssValidate (schema, data, args) {
  try {
    if (typeof schema === 'function') {
      await schema(args).validate(data)
    } else {
      await schema.validate(data)
    }
  } catch (e) {
    if (e instanceof ValidationError) {
      throw new Error(`${e.path}: ${e.message}`)
    }
    throw e
  }
}

export async function formikValidate (validate, data) {
  const errors = await validate(data)
  if (Object.keys(errors).length > 0) {
    const [key, message] = Object.entries(errors)[0]
    throw new Error(`${key}: ${message}`)
  }
}

addMethod(string, 'or', function (schemas, msg) {
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

const titleValidator = string().required('required').trim().max(
  MAX_TITLE_LENGTH,
  ({ max, value }) => `-${Math.abs(max - value.length)} characters remaining`
).min(MIN_TITLE_LENGTH, `must be at least ${MIN_TITLE_LENGTH} characters`)

const textValidator = (max) => string().trim().max(
  max,
  ({ max, value }) => `-${Math.abs(max - value.length)} characters remaining`
)
const nameValidator = string()
  .required('required')
  .matches(/^[\w_]+$/, 'only letters, numbers, and _')
  .max(32, 'too long')

const intValidator = number().typeError('must be a number').integer('must be whole')
const floatValidator = number().typeError('must be a number')

const lightningAddressValidator = process.env.NODE_ENV === 'development'
  ? string().or(
    [string().matches(/^[\w_]+@localhost:\d+$/), string().matches(/^[\w_]+@app:\d+$/), string().email()],
    'address is no good')
  : string().email('address is no good')

const hexOrBase64Validator = string().test({
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
})

async function usernameExists (name, { client, models }) {
  if (!client && !models) {
    throw new Error('cannot check for user')
  }
  // apollo client
  if (client) {
    const { data } = await client.query({ query: NAME_QUERY, variables: { name } })
    return !data.nameAvailable
  }

  // prisma client
  const user = await models.user.findUnique({ where: { name } })
  return !!user
}

async function subExists (name, { client, models, me, filter }) {
  if (!client && !models) {
    throw new Error('cannot check for territory')
  }

  let sub
  // apollo client
  if (client) {
    const { data } = await client.query({ query: SUB, variables: { sub: name }, fetchPolicy: 'no-cache' })
    sub = data?.sub
  } else {
    sub = await models.sub.findUnique({ where: { name } })
  }

  return !!sub && (!filter || filter(sub))
}

async function subActive (name, { client, models, me }) {
  if (!client && !models) {
    throw new Error('cannot check if territory is active')
  }

  let sub
  // apollo client
  if (client) {
    const { data } = await client.query({ query: SUB, variables: { sub: name } })
    sub = data?.sub
  } else {
    sub = await models.sub.findUnique({ where: { name } })
  }

  return sub ? sub.status !== 'STOPPED' : undefined
}

async function subHasPostType (name, type, { client, models }) {
  if (!client && !models) {
    throw new Error('cannot check for territory')
  }
  // apollo client
  if (client) {
    const { data } = await client.query({ query: SUB, variables: { name } })
    return !!(data?.sub?.postTypes?.includes(type))
  }

  // prisma client
  const sub = await models.sub.findUnique({ where: { name } })
  return !!(sub?.postTypes?.includes(type))
}

export function advPostSchemaMembers ({ me, existingBoost = 0, ...args }) {
  const boostMin = existingBoost || BOOST_MIN
  return {
    boost: intValidator
      .min(boostMin, `must be ${existingBoost ? '' : 'blank or '}at least ${boostMin}`).test({
        name: 'boost',
        test: async boost => (!existingBoost && !boost) || boost % BOOST_MULT === 0,
        message: `must be divisble be ${BOOST_MULT}`
      }),
    forward: array()
      .max(MAX_FORWARDS, `you can only configure ${MAX_FORWARDS} forward recipients`)
      .of(object().shape({
        nym: string().required('must specify a stacker')
          .test({
            name: 'nym',
            test: async name => {
              if (!name || !name.length) return false
              return await usernameExists(name, args)
            },
            message: 'stacker does not exist'
          })
          .test({
            name: 'self',
            test: async name => {
              return me?.name !== name
            },
            message: 'cannot forward to yourself'
          }),
        pct: intValidator.required('must specify a percentage').min(1, 'percentage must be at least 1').max(100, 'percentage must not exceed 100')
      }))
      .compact((v) => !v.nym && !v.pct)
      .test({
        name: 'sum',
        test: forwards => forwards ? forwards.map(fwd => Number(fwd.pct)).reduce((sum, cur) => sum + cur, 0) <= 100 : true,
        message: 'the total forward percentage exceeds 100%'
      })
      .test({
        name: 'uniqueStackers',
        test: forwards => forwards ? new Set(forwards.map(fwd => fwd.nym)).size === forwards.length : true,
        message: 'duplicate stackers cannot be specified to receive forwarded sats'
      })
  }
}

export function subSelectSchemaMembers (args) {
  return {
    sub: string().required('required').test({
      name: 'sub',
      test: async sub => {
        if (!sub || !sub.length) return false
        return await subExists(sub, args)
      },
      message: 'pick valid territory'
    }).test({
      name: 'sub',
      test: async sub => {
        if (!sub || !sub.length) return false
        return await subActive(sub, args)
      },
      message: 'territory is not active'
    })
  }
}
// for testing advPostSchemaMembers in isolation
export function advSchema (args) {
  return object({
    ...advPostSchemaMembers(args)
  })
}

export const autowithdrawSchemaMembers = {
  enabled: boolean(),
  autoWithdrawThreshold: intValidator.required('required').min(0, 'must be at least 0').max(msatsToSats(BALANCE_LIMIT_MSATS), `must be at most ${abbrNum(msatsToSats(BALANCE_LIMIT_MSATS))}`),
  autoWithdrawMaxFeePercent: floatValidator.required('required').min(0, 'must be at least 0').max(50, 'must not exceed 50')
}

export const lnAddrAutowithdrawSchema = object({
  address: lightningAddressValidator.required('required').test({
    name: 'address',
    test: addr => !addr.endsWith('@stacker.news'),
    message: 'automated withdrawals must be external'
  }),
  ...autowithdrawSchemaMembers
})

export const LNDAutowithdrawSchema = object({
  socket: string().socket().required('required'),
  macaroon: hexOrBase64Validator.required('required').test({
    name: 'macaroon',
    test: v => isInvoiceMacaroon(v) || isInvoicableMacaroon(v),
    message: 'not an invoice macaroon or an invoicable macaroon'
  }),
  cert: hexOrBase64Validator,
  ...autowithdrawSchemaMembers
})

export const CLNAutowithdrawSchema = object({
  socket: string().socket().required('required'),
  rune: string().matches(B64_URL_REGEX, { message: 'invalid rune' }).required('required')
    .test({
      name: 'rune',
      test: (v, context) => {
        const decoded = decodeRune(v)
        if (!decoded) return context.createError({ message: 'invalid rune' })
        if (decoded.restrictions.length === 0) {
          return context.createError({ message: 'rune must be restricted to method=invoice' })
        }
        if (decoded.restrictions.length !== 1 || decoded.restrictions[0].alternatives.length !== 1) {
          return context.createError({ message: 'rune must be restricted to method=invoice only' })
        }
        if (decoded.restrictions[0].alternatives[0] !== 'method=invoice') {
          return context.createError({ message: 'rune must be restricted to method=invoice only' })
        }
        return true
      }
    }),
  cert: hexOrBase64Validator,
  ...autowithdrawSchemaMembers
})

export function bountySchema (args) {
  return object({
    title: titleValidator,
    text: textValidator(MAX_POST_TEXT_LENGTH),
    bounty: intValidator
      .min(BOUNTY_MIN, `must be at least ${numWithUnits(BOUNTY_MIN)}`)
      .max(BOUNTY_MAX, `must be at most ${numWithUnits(BOUNTY_MAX)}`),
    ...advPostSchemaMembers(args),
    ...subSelectSchemaMembers(args)
  }).test({
    name: 'post-type-supported',
    test: ({ sub }) => subHasPostType(sub, 'BOUNTY', args),
    message: 'territory does not support bounties'
  })
}

export function discussionSchema (args) {
  return object({
    title: titleValidator,
    text: textValidator(MAX_POST_TEXT_LENGTH),
    ...advPostSchemaMembers(args),
    ...subSelectSchemaMembers(args)
  }).test({
    name: 'post-type-supported',
    test: ({ sub }) => subHasPostType(sub, 'DISCUSSION', args),
    message: 'territory does not support discussions'
  })
}

export function linkSchema (args) {
  return object({
    title: titleValidator,
    text: textValidator(MAX_POST_TEXT_LENGTH),
    url: string().url().required('required'),
    ...advPostSchemaMembers(args),
    ...subSelectSchemaMembers(args)
  }).test({
    name: 'post-type-supported',
    test: ({ sub }) => subHasPostType(sub, 'LINK', args),
    message: 'territory does not support links'
  })
}

export function pollSchema ({ numExistingChoices = 0, ...args }) {
  return object({
    title: titleValidator,
    text: textValidator(MAX_POST_TEXT_LENGTH),
    options: array().of(
      string().trim().test('my-test', 'required', function (value) {
        return (this.path !== 'options[0]' && this.path !== 'options[1]') || value
      }).max(MAX_POLL_CHOICE_LENGTH,
        ({ max, value }) => `-${Math.abs(max - value.length)} characters remaining`
      )
    ).test({
      message: `at most ${MAX_POLL_NUM_CHOICES} choices`,
      test: arr => arr.length <= MAX_POLL_NUM_CHOICES - numExistingChoices
    }).test({
      message: `at least ${MIN_POLL_NUM_CHOICES} choices required`,
      test: arr => arr.length >= MIN_POLL_NUM_CHOICES - numExistingChoices
    }),
    pollExpiresAt: date().nullable().min(datePivot(new Date(), { days: 1 }), 'Expiration must be at least 1 day in the future'),
    ...advPostSchemaMembers(args),
    ...subSelectSchemaMembers(args)
  }).test({
    name: 'post-type-supported',
    test: ({ sub }) => subHasPostType(sub, 'POLL', args),
    message: 'territory does not support polls'
  })
}

export function territorySchema (args) {
  return object({
    name: nameValidator
      .test({
        name: 'name',
        test: async name => {
          if (!name || !name.length) return false
          const editing = !!args.sub?.name
          // don't block submission on edits or unarchival
          const isEdit = sub => sub.name === args.sub.name
          const isArchived = sub => sub.status === 'STOPPED'
          const filter = sub => editing ? !isEdit(sub) : !isArchived(sub)
          const exists = await subExists(name, { ...args, filter })
          return !exists
        },
        message: 'taken'
      }),
    desc: string().required('required').trim().max(
      MAX_TERRITORY_DESC_LENGTH,
      ({ max, value }) => `-${Math.abs(max - value.length)} characters remaining`
    ),
    baseCost: intValidator
      .min(1, 'must be at least 1')
      .max(100000, 'must be at most 100k'),
    postTypes: array().of(string().oneOf(POST_TYPES)).min(1, 'must support at least one post type'),
    billingType: string().required('required').oneOf(TERRITORY_BILLING_TYPES, 'required'),
    nsfw: boolean()
  })
}

export function territoryTransferSchema ({ me, ...args }) {
  return object({
    userName: nameValidator
      .test({
        name: 'name',
        test: async name => {
          if (!name || !name.length) return false
          return await usernameExists(name, args)
        },
        message: 'user does not exist'
      })
      .test({
        name: 'name',
        test: name => !me || me.name !== name,
        message: 'cannot transfer to yourself'
      })
  })
}

export function userSchema (args) {
  return object({
    name: nameValidator
      .test({
        name: 'name',
        test: async name => {
          if (!name || !name.length) return false
          return !(await usernameExists(name, args))
        },
        message: 'taken'
      })
  })
}

export const commentSchema = object({
  text: textValidator(MAX_COMMENT_TEXT_LENGTH).required('required')
})

export const jobSchema = object({
  title: titleValidator,
  company: string().required('required').trim(),
  text: textValidator(MAX_POST_TEXT_LENGTH).required('required'),
  url: string()
    .or([string().email(), string().url()], 'invalid url or email')
    .required('required'),
  maxBid: intValidator.min(0, 'must be at least 0').required('required'),
  location: string().test(
    'no-remote',
    "don't write remote, just check the box",
    v => !v?.match(/\bremote\b/gi))
    .when('remote', {
      is: (value) => !value,
      then: schema => schema.required('required').trim()
    })
})

export const emailSchema = object({
  email: string().email('email is no good').required('required')
})

export const urlSchema = object({
  url: string().url().required('required')
})

export const namedUrlSchema = object({
  text: string().required('required').trim(),
  url: string().url().required('required')
})

export const amountSchema = object({
  amount: intValidator.required('required').positive('must be positive')
})

export const actSchema = object({
  sats: intValidator.required('required').positive('must be positive'),
  act: string().required('required').oneOf(['TIP', 'DONT_LIKE_THIS'])
})

export const settingsSchema = object({
  tipDefault: intValidator.required('required').positive('must be positive'),
  fiatCurrency: string().required('required').oneOf(SUPPORTED_CURRENCIES),
  withdrawMaxFeeDefault: intValidator.required('required').positive('must be positive'),
  nostrPubkey: string().nullable()
    .or([
      string().nullable().matches(NOSTR_PUBKEY_HEX, 'must be 64 hex chars'),
      string().nullable().matches(NOSTR_PUBKEY_BECH32, 'invalid bech32 encoding')], 'invalid pubkey'),
  nostrRelays: array().of(
    string().ws()
  ).max(NOSTR_MAX_RELAY_NUM,
    ({ max, value }) => `${Math.abs(max - value.length)} too many`),
  hideBookmarks: boolean(),
  hideGithub: boolean(),
  hideNostr: boolean(),
  hideTwitter: boolean(),
  hideWalletBalance: boolean(),
  diagnostics: boolean(),
  noReferralLinks: boolean(),
  hideIsContributor: boolean(),
  zapUndos: intValidator.nullable().min(0, 'must be greater or equal to 0')
})

const warningMessage = 'If I logout, even accidentally, I will never be able to access my account again'
export const lastAuthRemovalSchema = object({
  warning: string().matches(warningMessage, 'does not match').required('required')
})

export const withdrawlSchema = object({
  invoice: string().required('required').trim(),
  maxFee: intValidator.required('required').min(0, 'must be at least 0')
})

export const lnAddrSchema = ({ payerData, min, max, commentAllowed } = {}) =>
  object({
    addr: lightningAddressValidator.required('required'),
    amount: (() => {
      const schema = intValidator.required('required').positive('must be positive').min(
        min || 1, `must be at least ${min || 1}`)
      return max ? schema.max(max, `must be at most ${max}`) : schema
    })(),
    maxFee: intValidator.required('required').min(0, 'must be at least 0'),
    comment: commentAllowed
      ? string().max(commentAllowed, `must be less than ${commentAllowed}`)
      : string()
  }).concat(object().shape(Object.keys(payerData || {}).reduce((accum, key) => {
    const entry = payerData[key]
    if (key === 'email') {
      accum[key] = string().email()
    } else if (key === 'identifier') {
      accum[key] = boolean()
    } else {
      accum[key] = string()
    }
    if (entry?.mandatory) {
      accum[key] = accum[key].required()
    }
    return accum
  }, {})))

export const lnbitsSchema = object({
  url: process.env.NODE_ENV === 'development'
    ? string()
      .or([string().matches(/^(http:\/\/)?localhost:\d+$/), string().url()], 'invalid url')
      .required('required').trim()
    : string().url().required('required').trim()
      .test(async (url, context) => {
        if (TOR_REGEXP.test(url)) {
          // allow HTTP and HTTPS over Tor
          if (!/^https?:\/\//.test(url)) {
            return context.createError({ message: 'http or https required' })
          }
          return true
        }
        try {
          // force HTTPS over clearnet
          await string().https().validate(url)
        } catch (err) {
          return context.createError({ message: err.message })
        }
        return true
      }),
  adminKey: string().length(32).required('required')
})

export const nwcSchema = object({
  nwcUrl: string()
    .required('required')
    .test(async (nwcUrl, context) => {
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
    })
})

export const lncSchema = object({
  pairingPhrase: array()
    .transform(function (value, originalValue) {
      if (this.isType(value) && value !== null) {
        return value
      }
      return originalValue ? originalValue.trim().split(/[\s]+/) : []
    })
    .test(async (words, context) => {
      for (const w of words) {
        try {
          await string().oneOf(bip39Words).validate(w)
        } catch {
          return context.createError({ message: `'${w}' is not a valid pairing phrase word` })
        }
      }
      return true
    })
    .min(2, 'needs at least two words')
    .max(10, 'max 10 words')
    .required('required')
})

export const bioSchema = object({
  bio: string().required('required').trim()
})

export const inviteSchema = object({
  gift: intValidator.positive('must be greater than 0').required('required'),
  limit: intValidator.positive('must be positive')
})

export const pushSubscriptionSchema = object({
  endpoint: string().url().required('required').trim(),
  p256dh: string().required('required').trim(),
  auth: string().required('required').trim()
})

export const lud18PayerDataSchema = (k1) => object({
  name: string(),
  pubkey: string(),
  email: string().email('bad email address'),
  identifier: string()
})

// check if something is _really_ a number.
// returns true for every number in this range: [-Infinity, ..., 0, ..., Infinity]
export const isNumber = x => typeof x === 'number' && !Number.isNaN(x)
