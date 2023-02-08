import * as Yup from 'yup'
import { BOOST_MIN, MAX_POLL_CHOICE_LENGTH, MAX_TITLE_LENGTH, MAX_POLL_NUM_CHOICES, MIN_POLL_NUM_CHOICES } from './constants'
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
    if (e instanceof Yup.ValidationError) {
      throw new Error(`${e.path}: ${e.message}`)
    }
    throw e
  }
}

Yup.addMethod(Yup.string, 'or', function (schemas, msg) {
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

const titleValidator = Yup.string().required('required').trim().max(
  MAX_TITLE_LENGTH,
  ({ max, value }) => `${Math.abs(max - value.length)} too many`
)

const intValidator = Yup.number().typeError('must be a number').integer('must be whole')

async function usernameExists (client, name) {
  if (!client) {
    throw new Error('cannot check for user')
  }
  // apollo client
  if (client.query) {
    const { data } = await client.query({ query: NAME_QUERY, variables: { name }, fetchPolicy: 'network-only' })
    return !data.nameAvailable
  }

  // prisma client
  const user = await client.user.findUnique({ where: { name } })
  return !!user
}

// not sure how to use this on server ...
export function advPostSchemaMembers (client) {
  return {
    boost: intValidator
      .min(BOOST_MIN, `must be blank or at least ${BOOST_MIN}`).test({
        name: 'boost',
        test: async boost => {
          if (!boost || boost % BOOST_MIN === 0) return true
          return false
        },
        message: `must be divisble be ${BOOST_MIN}`
      }),
    forward: Yup.string()
      .test({
        name: 'name',
        test: async name => {
          if (!name || !name.length) return true
          return await usernameExists(client, name)
        },
        message: 'user does not exist'
      })
  }
}

export function bountySchema (client) {
  return Yup.object({
    title: titleValidator,
    bounty: intValidator
      .min(1000, 'must be at least 1000')
      .max(1000000, 'must be at most 1m'),
    ...advPostSchemaMembers(client)
  })
}

export function discussionSchema (client) {
  return Yup.object({
    title: titleValidator,
    ...advPostSchemaMembers(client)
  })
}

export function linkSchema (client) {
  return Yup.object({
    title: titleValidator,
    url: Yup.string().matches(URL_REGEXP, 'invalid url').required('required'),
    ...advPostSchemaMembers(client)
  })
}

export function pollSchema (client, numExistingChoices) {
  return Yup.object({
    title: titleValidator,
    options: Yup.array().of(
      Yup.string().trim().test('my-test', 'required', function (value) {
        return (this.path !== 'options[0]' && this.path !== 'options[1]') || value
      }).max(MAX_POLL_CHOICE_LENGTH,
        ({ max, value }) => `${Math.abs(max - value.length)} too many characters`
      )
    ).test({
      message: `at most ${MAX_POLL_NUM_CHOICES} choices`,
      test: arr => arr.length <= MAX_POLL_NUM_CHOICES - numExistingChoices
    }).test({
      message: `at least ${MIN_POLL_NUM_CHOICES} choices required`,
      test: arr => arr.length >= MIN_POLL_NUM_CHOICES - numExistingChoices
    }),
    ...advPostSchemaMembers(client)
  })
}

export function userSchema (client) {
  return Yup.object({
    name: Yup.string()
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

export const commentSchema = Yup.object({
  text: Yup.string().required('required').trim()
})

export const jobSchema = Yup.object({
  title: titleValidator,
  company: Yup.string().required('required').trim(),
  text: Yup.string().required('required').trim(),
  url: Yup.string()
    .or([Yup.string().email(), Yup.string().url()], 'invalid url or email')
    .required('required'),
  maxBid: intValidator.min(0, 'must be at least 0').required('required'),
  location: Yup.string().test(
    'no-remote',
    "don't write remote, just check the box",
    v => !v?.match(/\bremote\b/gi))
    .when('remote', {
      is: (value) => !value,
      then: Yup.string().required('required').trim()
    })
})

export const emailSchema = Yup.object({
  email: Yup.string().email('email is no good').required('required')
})

export const urlSchema = Yup.object({
  url: Yup.string().matches(URL_REGEXP, 'invalid url').required('required')
})

export const namedUrlSchema = Yup.object({
  text: Yup.string().required('required').trim(),
  url: Yup.string().matches(URL_REGEXP, 'invalid url').required('required')
})

export const amountSchema = Yup.object({
  amount: intValidator.required('required').positive('must be positive')
})

export const settingsSchema = Yup.object({
  tipDefault: intValidator.required('required').positive('must be positive'),
  fiatCurrency: Yup.string().required('required').oneOf(SUPPORTED_CURRENCIES),
  nostrPubkey: Yup.string()
    .or([
      Yup.string().matches(NOSTR_PUBKEY_HEX, 'must be 64 hex chars'),
      Yup.string().matches(NOSTR_PUBKEY_BECH32, 'invalid bech32 encoding')], 'invalid pubkey'),
  nostrRelays: Yup.array().of(
    Yup.string().matches(WS_REGEXP, 'invalid web socket address')
  ).max(NOSTR_MAX_RELAY_NUM,
    ({ max, value }) => `${Math.abs(max - value.length)} too many`)
})

const warningMessage = 'If I logout, even accidentally, I will never be able to access my account again'
export const lastAuthRemovalSchema = Yup.object({
  warning: Yup.string().matches(warningMessage, 'does not match').required('required')
})

export const withdrawlSchema = Yup.object({
  invoice: Yup.string().required('required').trim(),
  maxFee: intValidator.required('required').min(0, 'must be at least 0')
})

export const lnAddrSchema = Yup.object({
  addr: Yup.string().email('address is no good').required('required'),
  amount: intValidator.required('required').positive('must be positive'),
  maxFee: intValidator.required('required').min(0, 'must be at least 0')
})

export const bioSchema = Yup.object({
  bio: Yup.string().required('required').trim()
})

export const inviteSchema = Yup.object({
  gift: intValidator.positive('must be greater than 0').required('required'),
  limit: intValidator.positive('must be positive')
})
