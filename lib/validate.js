import { string, ValidationError, number, object, array, addMethod, boolean } from 'yup'
import {
  BOOST_MIN, MAX_POLL_CHOICE_LENGTH, MAX_TITLE_LENGTH, MAX_POLL_NUM_CHOICES,
  MIN_POLL_NUM_CHOICES, MAX_FORWARDS, BOOST_MULT, MAX_TERRITORY_DESC_LENGTH, POST_TYPES,
  TERRITORY_BILLING_TYPES, MAX_COMMENT_TEXT_LENGTH, MAX_POST_TEXT_LENGTH, MIN_TITLE_LENGTH, BOUNTY_MIN, BOUNTY_MAX, BALANCE_LIMIT_MSATS
} from './constants'
import { URL_REGEXP, WS_REGEXP } from './url'
import { SUPPORTED_CURRENCIES } from './currency'
import { NOSTR_MAX_RELAY_NUM, NOSTR_PUBKEY_BECH32, NOSTR_PUBKEY_HEX } from './nostr'
import { msatsToSats, numWithUnits, abbrNum } from './format'
import * as usersFragments from '../fragments/users'
import * as subsFragments from '../fragments/subs'
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
    [string().matches(/^[\w_]+@localhost:\d+$/), string().email()],
    'address is no good')
  : string().email('address is no good')

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

async function subExists (name, { client, models, me }) {
  if (!client && !models) {
    throw new Error('cannot check for territory')
  }

  let sub
  // apollo client
  if (client) {
    const { data } = await client.query({ query: SUB, variables: { sub: name } })
    sub = data?.sub
  } else {
    sub = await models.sub.findUnique({ where: { name } })
  }

  return !!sub && sub.userId !== Number(me?.id)
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

  return sub && sub.status !== 'STOPPED'
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
  // for subSelectSchemaMembers we want to filter out me
  // because we want to allow the user to select their own territory
  const { me, ...filteredArgs } = args
  return {
    sub: string().required('required').test({
      name: 'sub',
      test: async sub => {
        if (!sub || !sub.length) return false
        return await subExists(sub, filteredArgs)
      },
      message: 'pick valid territory'
    }).test({
      name: 'sub',
      test: async sub => {
        if (!sub || !sub.length) return false
        return await subActive(sub, filteredArgs)
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

export function lnAddrAutowithdrawSchema ({ me } = {}) {
  return object({
    lnAddr: lightningAddressValidator.required('required').test({
      name: 'lnAddr',
      test: addr => !addr.endsWith('@stacker.news'),
      message: 'automated withdrawals must be external'
    }),
    autoWithdrawThreshold: intValidator.required('required').min(0, 'must be at least 0').max(msatsToSats(BALANCE_LIMIT_MSATS), `must be at most ${abbrNum(msatsToSats(BALANCE_LIMIT_MSATS))}`),
    autoWithdrawMaxFeePercent: floatValidator.required('required').min(0, 'must be at least 0').max(50, 'must not exceed 50')
  })
}

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
    url: string().matches(URL_REGEXP, 'invalid url').required('required'),
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
          return !(await subExists(name, args))
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
    billingType: string().required('required').oneOf(TERRITORY_BILLING_TYPES, 'required')
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
  url: string().matches(URL_REGEXP, 'invalid url').required('required')
})

export const namedUrlSchema = object({
  text: string().required('required').trim(),
  url: string().matches(URL_REGEXP, 'invalid url').required('required')
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
    string().matches(WS_REGEXP, 'invalid web socket address')
  ).max(NOSTR_MAX_RELAY_NUM,
    ({ max, value }) => `${Math.abs(max - value.length)} too many`),
  hideBookmarks: boolean(),
  hideWalletBalance: boolean(),
  diagnostics: boolean(),
  hideIsContributor: boolean()
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
