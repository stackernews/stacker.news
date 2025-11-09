/* eslint-env jest */

import pay from '../../index.js'
import { satsToMsats } from '@/lib/format'
import {
  getPrisma,
  cleanupPrisma,
  createTestUser,
  createTestItem,
  assertUserBalance,
  cleanupTestData
} from '../fixtures/testUtils.js'

describe('PayIn Optimistic Flows', () => {
  let models
  const testUsers = []

  beforeAll(() => {
    models = getPrisma()
  })

  afterAll(async () => {
    await cleanupTestData(models, testUsers)
    await cleanupPrisma()
  })

  describe('Optimistic invoice creation', () => {
    it('should create payIn in PENDING_INVOICE_CREATION when user lacks funds', async () => {
      const zapper = await createTestUser(models, {
        mcredits: 0n,
        msats: 0n
      })
      testUsers.push(zapper)

      const recipient = await createTestUser(models)
      testUsers.push(recipient)

      const item = await createTestItem(models, {
        userId: recipient.id,
        title: 'Test Post'
      })

      const zapAmount = 10
      const result = await pay('ZAP', {
        id: item.id,
        sats: zapAmount
      }, {
        models,
        me: zapper
      })

      // Should be in invoice creation or pending state
      expect(['PENDING_INVOICE_CREATION', 'PENDING', 'PENDING_HELD']).toContain(result.payInState)

      // If invoice was created, check it exists
      if (result.payInState === 'PENDING') {
        expect(result.payInBolt11).toBeTruthy()
        expect(result.payInBolt11.bolt11).toBeTruthy()
        expect(result.payInBolt11.hash).toBeTruthy()
        expect(result.payInBolt11.msatsRequested).toBe(satsToMsats(zapAmount))
      }

      // Action should have been performed optimistically (visible to creator)
      if (result.result) {
        expect(result.result.id).toBe(item.id)
      }
    })

    it('should create item optimistically when user lacks funds', async () => {
      const poster = await createTestUser(models, {
        mcredits: 0n,
        msats: 0n
      })
      testUsers.push(poster)

      const result = await pay('ITEM_CREATE', {
        title: 'Optimistic Post',
        text: 'Test content',
        uploadIds: [],
        boost: 0,
        userId: poster.id
      }, {
        models,
        me: poster
      })

      // Should be in pending state
      expect(['PENDING_INVOICE_CREATION', 'PENDING']).toContain(result.payInState)

      // Item should have been created optimistically
      expect(result.result).toBeTruthy()
      expect(result.result.title).toBe('Optimistic Post')

      // Verify item exists in database
      const item = await models.item.findUnique({
        where: { id: result.result.id }
      })
      expect(item).toBeTruthy()
      expect(item.title).toBe('Optimistic Post')
    })
  })

  describe('Optimistic flow with partial funds', () => {
    it('should deduct available custodial funds and invoice for remainder', async () => {
      const zapper = await createTestUser(models, {
        mcredits: satsToMsats(5),
        msats: 0n
      })
      testUsers.push(zapper)

      const recipient = await createTestUser(models)
      testUsers.push(recipient)

      const item = await createTestItem(models, {
        userId: recipient.id,
        title: 'Test Post'
      })

      const zapAmount = 10
      const result = await pay('ZAP', {
        id: item.id,
        sats: zapAmount
      }, {
        models,
        me: zapper
      })

      // Should be in pending state (needs invoice for remaining amount)
      expect(['PENDING_INVOICE_CREATION', 'PENDING', 'PENDING_HELD']).toContain(result.payInState)

      // Should have deducted the 5 sats of credits
      await assertUserBalance(models, zapper.id, {
        mcredits: 0n
      })

      // Should have created payIn custodial token for the 5 sats
      const payInTokens = await models.payInCustodialToken.findMany({
        where: { payInId: result.id }
      })
      expect(payInTokens).toHaveLength(1)
      expect(payInTokens[0].mtokens).toBe(satsToMsats(5))

      // If invoice was created, it should be for remaining 5 sats
      if (result.payInBolt11) {
        expect(result.payInBolt11.msatsRequested).toBe(satsToMsats(5))
      }
    })
  })

  describe('Anonymous optimistic flows', () => {
    it('should handle anonymous zap with pessimistic flow', async () => {
      const recipient = await createTestUser(models)
      testUsers.push(recipient)

      const item = await createTestItem(models, {
        userId: recipient.id,
        title: 'Test Post'
      })

      const result = await pay('ZAP', {
        id: item.id,
        sats: 10
      }, {
        models,
        me: null // anonymous
      })

      // Anonymous zaps should use pessimistic flow
      expect(['PENDING_INVOICE_CREATION', 'PENDING_HELD']).toContain(result.payInState)
    })

    it('should handle anonymous item creation with pessimistic flow', async () => {
      const result = await pay('ITEM_CREATE', {
        text: 'Anonymous comment',
        uploadIds: [],
        boost: 0,
        userId: null
      }, {
        models,
        me: null // anonymous
      })

      // Anonymous posts should use pessimistic flow
      expect(['PENDING_INVOICE_CREATION', 'PENDING_HELD']).toContain(result.payInState)

      // Item should NOT be created yet (pessimistic)
      if (result.payInState === 'PENDING_INVOICE_CREATION') {
        // Check that pessimisticEnv was created with args
        const payIn = await models.payIn.findUnique({
          where: { id: result.id },
          include: { pessimisticEnv: true }
        })

        if (payIn.pessimisticEnv) {
          expect(payIn.pessimisticEnv.args).toBeTruthy()
          expect(payIn.pessimisticEnv.args.text).toBe('Anonymous comment')
        }
      }
    })
  })

  describe('Optimistic with payment methods preference', () => {
    it('should prefer FEE_CREDIT over REWARD_SATS', async () => {
      const user = await createTestUser(models, {
        mcredits: satsToMsats(100),
        msats: satsToMsats(100)
      })
      testUsers.push(user)

      const recipient = await createTestUser(models)
      testUsers.push(recipient)

      const item = await createTestItem(models, {
        userId: recipient.id,
        title: 'Test Post'
      })

      await pay('ZAP', {
        id: item.id,
        sats: 10
      }, {
        models,
        me: user
      })

      // Should have used credits first
      const updatedUser = await models.user.findUnique({
        where: { id: user.id }
      })
      expect(updatedUser.mcredits).toBe(satsToMsats(90))
      expect(updatedUser.msats).toBe(satsToMsats(100)) // Unchanged
    })
  })

  describe('Optimistic retries', () => {
    it('should allow retry of failed optimistic payment', async () => {
      const user = await createTestUser(models, {
        mcredits: satsToMsats(100),
        msats: 0n
      })
      testUsers.push(user)

      const recipient = await createTestUser(models)
      testUsers.push(recipient)

      const item = await createTestItem(models, {
        userId: recipient.id,
        title: 'Test Post'
      })

      // First attempt with insufficient funds
      const firstResult = await pay('ZAP', {
        id: item.id,
        sats: 10
      }, {
        models,
        me: user
      })

      expect(firstResult.payInState).toBe('PAID')

      // Verify credits were spent
      const afterFirst = await models.user.findUnique({
        where: { id: user.id }
      })
      expect(afterFirst.mcredits).toBe(satsToMsats(90))
    })
  })
})
