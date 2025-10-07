/* eslint-env jest */

import { PrismaClient } from '@prisma/client'
import { USER_ID } from '@/lib/constants'

let prisma

// Initialize Prisma client for tests
export function getPrisma () {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    })
  }
  return prisma
}

// Clean up after tests
export async function cleanupPrisma () {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
  }
}

/**
 * Create a test user with specified balances
 */
export async function createTestUser (models, {
  name = `test_user_${Date.now()}_${Math.random()}`,
  msats = 0n,
  mcredits = 0n,
  trust = 0,
  ...otherFields
} = {}) {
  // Ensure msats and mcredits are BigInts
  if (typeof msats === 'number') {
    msats = BigInt(msats)
  }
  if (typeof mcredits === 'number') {
    mcredits = BigInt(mcredits)
  }

  return await models.user.create({
    data: {
      name,
      msats,
      mcredits,
      stackedMsats: 0n,
      stackedMcredits: 0n,
      trust,
      ...otherFields
    }
  })
}

/**
 * Create a test item (post or comment)
 */
export async function createTestItem (models, {
  userId,
  title = 'Test Item',
  text = 'Test content',
  subName = null,
  parentId = null,
  bio = false,
  pollCost = null,
  ...otherFields
} = {}) {
  // For root items (posts), ensure we have a subName
  // For comments, inherit from parent or use default
  let finalSubName = subName
  if (!parentId && !bio && !finalSubName) {
    // Root items need a subName - use 'bitcoin' as default test sub
    finalSubName = 'bitcoin'
  }

  const item = await models.item.create({
    data: {
      userId,
      title: parentId ? null : title,
      text,
      subName: finalSubName,
      parentId,
      bio,
      pollCost,
      ...otherFields
    }
  })

  // Fetch with includes to match what the app expects
  return await models.item.findUnique({
    where: { id: item.id },
    include: {
      itemForwards: true,
      user: true,
      sub: true,
      pollOptions: true
    }
  })
}

/**
 * Create a test territory
 */
export async function createTestTerritory (models, {
  name = `test_territory_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  userId,
  baseCost = 10,
  replyCost = 1,
  billingCost = 100000,
  billedLastAt = new Date()
} = {}) {
  return await models.sub.create({
    data: {
      name,
      userId,
      baseCost,
      replyCost,
      billingCost,
      billedLastAt,
      desc: 'Test territory',
      billingType: 'RENT',
      billingAutoRenew: false,
      rankingType: 'WOT',
      postTypes: ['LINK', 'DISCUSSION', 'POLL', 'JOB', 'BOUNTY']
    }
  })
}

/**
 * Assert that a payIn is in the expected state
 */
export async function assertPayInState (models, payInId, expectedState) {
  const payIn = await models.payIn.findUnique({
    where: { id: payInId },
    include: {
      payInCustodialTokens: true,
      payOutCustodialTokens: true,
      payInBolt11: true,
      payOutBolt11: true
    }
  })

  expect(payIn).toBeTruthy()
  expect(payIn.payInState).toBe(expectedState)

  return payIn
}

/**
 * Assert user balance
 */
export async function assertUserBalance (models, userId, { msats, mcredits }) {
  const user = await models.user.findUnique({ where: { id: userId } })
  expect(user).toBeTruthy()

  if (msats !== undefined) {
    expect(user.msats).toBe(msats)
  }
  if (mcredits !== undefined) {
    expect(user.mcredits).toBe(mcredits)
  }

  return user
}

/**
 * Assert payOut custodial tokens were created correctly
 */
export async function assertPayOutsCreated (models, payInId, expectedPayOuts) {
  const payOuts = await models.payOutCustodialToken.findMany({
    where: { payInId },
    orderBy: { id: 'asc' }
  })

  expect(payOuts).toHaveLength(expectedPayOuts.length)

  for (let i = 0; i < expectedPayOuts.length; i++) {
    const expected = expectedPayOuts[i]
    const actual = payOuts[i]

    if (expected.payOutType) {
      expect(actual.payOutType).toBe(expected.payOutType)
    }
    if (expected.userId !== undefined) {
      expect(actual.userId).toBe(expected.userId)
    }
    if (expected.mtokens) {
      expect(actual.mtokens).toBe(expected.mtokens)
    }
    if (expected.custodialTokenType) {
      expect(actual.custodialTokenType).toBe(expected.custodialTokenType)
    }
  }

  return payOuts
}

/**
 * Assert payIn custodial tokens were created correctly
 */
export async function assertPayInCustodialTokens (models, payInId, expectedTokens) {
  const tokens = await models.payInCustodialToken.findMany({
    where: { payInId },
    orderBy: { id: 'asc' }
  })

  expect(tokens).toHaveLength(expectedTokens.length)

  for (let i = 0; i < expectedTokens.length; i++) {
    const expected = expectedTokens[i]
    const actual = tokens[i]

    if (expected.mtokens) {
      expect(actual.mtokens).toBe(expected.mtokens)
    }
    if (expected.custodialTokenType) {
      expect(actual.custodialTokenType).toBe(expected.custodialTokenType)
    }
  }

  return tokens
}

/**
 * Create a payIn in a specific state for testing transitions
 */
export async function createPayInInState (models, state, {
  payInType = 'ZAP',
  userId,
  mcost = 1000n,
  withBolt11 = false,
  withPayOutBolt11 = false
} = {}) {
  // Ensure mcost is a BigInt
  if (typeof mcost === 'number') {
    mcost = BigInt(mcost)
  }

  // Create an item if this is a ZAP type payIn (ZAP requires itemPayIn)
  let itemId
  if (payInType === 'ZAP') {
    const itemOwner = await models.user.findFirst({
      where: { name: { not: null } },
      orderBy: { id: 'asc' }
    })
    const item = await createTestItem(models, {
      userId: itemOwner.id,
      // Make title unique to avoid Item_unique_time_constraint
      title: `Test Item for Transition ${Date.now()}_${Math.random().toString(36).substring(7)}`
    })
    itemId = item.id
  }

  const data = {
    payInType,
    userId,
    mcost,
    payInState: state,
    // Create itemPayIn for ZAP types
    ...(payInType === 'ZAP' && itemId
      ? {
          itemPayIn: {
            create: {
              itemId
            }
          }
        }
      : {})
  }

  const payIn = await models.payIn.create({
    data,
    include: {
      payInBolt11: true,
      payOutBolt11: true,
      payInCustodialTokens: true,
      payOutCustodialTokens: true,
      itemPayIn: true
    }
  })

  // Add bolt11 invoice if requested
  if (withBolt11) {
    await models.payInBolt11.create({
      data: {
        payInId: payIn.id,
        userId, // Required field
        hash: `test_hash_${payIn.id}_${Date.now()}_${Math.random()}`,
        bolt11: `lnbc${payIn.id}test${Date.now()}`,
        msatsRequested: mcost,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        preimage: `test_preimage_${payIn.id}_${Date.now()}_${Math.random()}`
      }
    })
  }

  // Add payOut bolt11 if requested
  if (withPayOutBolt11) {
    // Calculate 70% using BigInt arithmetic
    const payOutAmount = (mcost * 70n) / 100n

    await models.payOutBolt11.create({
      data: {
        payInId: payIn.id,
        userId,
        hash: `test_payout_hash_${payIn.id}_${Date.now()}`,
        bolt11: `lnbc${payIn.id}payout`,
        msats: payOutAmount,
        payOutType: 'ZAP'
      }
    })
  }

  return await models.payIn.findUnique({
    where: { id: payIn.id },
    include: {
      payInBolt11: true,
      payOutBolt11: true,
      payInCustodialTokens: true,
      payOutCustodialTokens: true
    }
  })
}

/**
 * Mock LND invoice response
 */
export function mockLndInvoice ({
  hash,
  msats = 1000000n,
  /* eslint-disable camelcase */
  is_confirmed = false,
  is_held = false,
  is_canceled = false,
  is_cancelled = false,
  received_mtokens = '1000000'
  /* eslint-enable camelcase */
} = {}) {
  /* eslint-disable camelcase */
  return {
    id: hash,
    is_confirmed,
    is_held,
    is_canceled: is_canceled || is_cancelled,
    received_mtokens,
    confirmed_at: is_confirmed ? new Date().toISOString() : undefined,
    mtokens: String(msats),
    // Add payments array for held invoices (required by hodlInvoiceCltvDetails)
    payments: is_held
      ? [{
          confirmed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          created_height: 800000,
          in_channel: 'test_channel',
          is_canceled: false,
          is_confirmed: false,
          is_held: true,
          mtokens: String(msats),
          timeout: 800144, // Required for hodlInvoiceCltvDetails
          timeout_height: 800144, // 144 blocks from accept
          tokens: Number(BigInt(msats) / 1000n)
        }]
      : undefined,
    // Add received (required for calculating expiry/accept heights)
    received: is_held ? 800000 : undefined
  }
  /* eslint-enable camelcase */
}

/**
 * Mock LND payment response
 */
export function mockLndPayment ({
  hash,
  msats = 1000000n,
  /* eslint-disable camelcase */
  is_confirmed = false,
  is_failed = false,
  fee_mtokens = '30000',
  /* eslint-enable camelcase */
  secret = 'test_preimage'
} = {}) {
  /* eslint-disable camelcase */
  return {
    id: hash,
    is_confirmed,
    is_failed,
    notSent: false,
    payment: is_confirmed
      ? {
          fee_mtokens,
          secret
        }
      : undefined,
    mtokens: String(msats)
  }
  /* eslint-enable camelcase */
}

/**
 * Wait for a condition to be true
 */
export async function waitFor (condition, { timeout = 5000, interval = 100 } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  throw new Error('Timeout waiting for condition')
}

/**
 * Create a test context with models and me
 */
export function createTestContext (models, me = null) {
  return {
    models,
    me: me || { id: USER_ID.anon }
  }
}

/**
 * Clean up test data
 */
export async function cleanupTestData (models, testUsers = []) {
  // Delete in reverse order of dependencies to respect foreign keys
  const userIds = testUsers.map(u => u.id)

  if (userIds.length > 0) {
    try {
      // Delete payIn-related child records first
      await models.payInBolt11.deleteMany({
        where: { payIn: { userId: { in: userIds } } }
      })
      await models.payOutBolt11.deleteMany({
        where: { payIn: { userId: { in: userIds } } }
      })
      await models.payOutCustodialToken.deleteMany({
        where: { payIn: { userId: { in: userIds } } }
      })
      await models.payInCustodialToken.deleteMany({
        where: { payIn: { userId: { in: userIds } } }
      })
      await models.itemPayIn.deleteMany({
        where: { payIn: { userId: { in: userIds } } }
      })
      await models.refundCustodialToken.deleteMany({
        where: { payIn: { userId: { in: userIds } } }
      })

      // Delete parent payIn records
      await models.payIn.deleteMany({
        where: { userId: { in: userIds } }
      })

      // Delete item-related records
      await models.itemForward.deleteMany({
        where: { item: { userId: { in: userIds } } }
      })
      await models.item.deleteMany({
        where: { userId: { in: userIds } }
      })

      // Delete users
      await models.user.deleteMany({
        where: { id: { in: userIds } }
      })
    } catch (error) {
      console.error('Cleanup error:', error.message)
      // Don't throw - best effort cleanup
    }
  }
}

/**
 * Helper to run a test in a transaction that rolls back
 */
export async function runInRollbackTransaction (models, testFn) {
  return await models.$transaction(async (tx) => {
    try {
      await testFn(tx)
      // Force rollback by throwing
      throw new Error('ROLLBACK_TEST')
    } catch (error) {
      if (error.message === 'ROLLBACK_TEST') {
        // This is expected, suppress it
        return
      }
      throw error
    }
  }).catch(error => {
    if (error.message !== 'ROLLBACK_TEST') {
      throw error
    }
  })
}
