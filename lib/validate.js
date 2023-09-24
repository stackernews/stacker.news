import { string, ValidationError, number, object, array, addMethod, boolean } from 'yup'
import { BOOST_MIN, MAX_POLL_CHOICE_LENGTH, MAX_TITLE_LENGTH, MAX_POLL_NUM_CHOICES, MIN_POLL_NUM_CHOICES, SUBS_NO_JOBS, MAX_FORWARDS } from './constants'
import { NAME_QUERY } from '../fragments/users'
import { URL_REGEXP, WS_REGEXP } from './url'
import { SUPPORTED_CURRENCIES } from './currency'
import { NOSTR_MAX_RELAY_NUM, NOSTR_PUBKEY_BECH32, NOSTR_PUBKEY_HEX } from './nostr'

export async function ssValidate (schema, data, ...args) {
  try {
    if (typeof schema === 'function') {
      await schema(...args).validate(data)
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
)

const intValidator = number().typeError('must be a number').integer('must be whole')

async function usernameExists (client, name) {
  if (!client) {
    throw new Error('cannot check for user')
  }
  // apollo client
  if (client.query) {
    const { data } = await client.query({ query: NAME_QUERY, variables: { name } })
    return !data.nameAvailable
  }

  // prisma client
  const user = await client.user.findUnique({ where: { name } })
  return !!user
}

export function advPostSchemaMembers (client, me) {
  return {
    boost: intValidator
      .min(BOOST_MIN, `must be blank or at least ${BOOST_MIN}`).test({
        name: 'boost',
        test: async boost => !boost || boost % BOOST_MIN === 0,
        message: `must be divisble be ${BOOST_MIN}`
      }),
    forward: array()
      .max(MAX_FORWARDS, `you can only configure ${MAX_FORWARDS} forward recipients`)
      .of(object().shape({
        nym: string().required('must specify a stacker')
          .test({
            name: 'nym',
            test: async name => {
              if (!name || !name.length) return false
              return await usernameExists(client, name)
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

export function subSelectSchemaMembers (client) {
  return {
    sub: string().required('required').oneOf(SUBS_NO_JOBS, 'required')
  }
}

export function bountySchema (client, me) {
  return object({
    title: titleValidator,
    bounty: intValidator
      .min(1000, 'must be at least 1000')
      .max(1000000, 'must be at most 1m'),
    ...advPostSchemaMembers(client, me),
    ...subSelectSchemaMembers()
  })
}

export function discussionSchema (client, me) {
  return object({
    title: titleValidator,
    ...advPostSchemaMembers(client, me),
    ...subSelectSchemaMembers()
  })
}

export function linkSchema (client, me) {
  return object({
    title: titleValidator,
    url: string().matches(URL_REGEXP, 'invalid url').required('required'),
    ...advPostSchemaMembers(client, me),
    ...subSelectSchemaMembers()
  })
}

export function pollSchema (client, me, numExistingChoices = 0) {
  return object({
    title: titleValidator,
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
    ...advPostSchemaMembers(client, me),
    ...subSelectSchemaMembers()
  })
}

export function userSchema (client) {
  return object({
    name: string()
      .required('required')
      .matches(/^[\w_]+$/, 'only letters, numbers, and _')
      .max(32, 'too long')
      .test({
        name: 'name',
        test: async name => {
          if (!name || !name.length) return false
          return !(await usernameExists(client, name))
        },
        message: 'taken'
      })
  })
}

export const commentSchema = object({
  text: string().required('required').trim()
})

export const jobSchema = object({
  title: titleValidator,
  company: string().required('required').trim(),
  text: string().required('required').trim(),
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

export const settingsSchema = object({
  tipDefault: intValidator.required('required').positive('must be positive'),
  fiatCurrency: string().required('required').oneOf(SUPPORTED_CURRENCIES),
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

export const lnAddrSchema = object({
  addr: string().email('address is no good').required('required'),
  amount: intValidator.required('required').positive('must be positive'),
  maxFee: intValidator.required('required').min(0, 'must be at least 0'),
  comment: string()
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
