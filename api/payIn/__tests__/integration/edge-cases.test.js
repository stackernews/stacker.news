/* eslint-env jest */

import pay, { onFail, onPaid } from '../../index.js'
import { satsToMsats } from '@/lib/format'
import {
  getPrisma,
  cleanupPrisma,
  createTestUser,
  createTestItem,
  assertUserBalance,
  cleanupTestData,
  createPayInInState
} from '../fixtures/testUtils.js'

describe('PayIn Edge Cases', () => {
  let models
  const testUsers = []

  beforeAll(() => {
    models = getPrisma()
  })

  afterAll(async () => {
    await cleanupTestData(models, testUsers)
    await cleanupPrisma()
  })

  describe('Concurrent payments', () => {
    it('should handle concurrent zaps to same item', async () => {
      const zapper1 = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(zapper1)

      const zapper2 = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(zapper2)

      const recipient = await createTestUser(models)
      testUsers.push(recipient)

      const item = await createTestItem(models, {
        userId: recipient.id,
        title: 'Test Post'
      })

      // Execute concurrent zaps
      const results = await Promise.all([
        pay('ZAP', { id: item.id, sats: 10 }, { models, me: zapper1 }),
        pay('ZAP', { id: item.id, sats: 20 }, { models, me: zapper2 })
      ])

      // Both should succeed
      expect(results[0].payInState).toBe('PAID')
      expect(results[1].payInState).toBe('PAID')

      // Verify balances
      await assertUserBalance(models, zapper1.id, {
        msats: satsToMsats(990)
      })
      await assertUserBalance(models, zapper2.id, {
        msats: satsToMsats(980)
      })

      // Verify item received both zaps
      const updatedItem = await models.item.findUnique({
        where: { id: item.id }
      })
      expect(updatedItem.msats).toBeGreaterThanOrEqual(satsToMsats(30))
    })

    it('should prevent deadlocks with mutual zaps', async () => {
      const user1 = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(user1)

      const user2 = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(user2)

      const item1 = await createTestItem(models, {
        userId: user1.id,
        title: 'Post by user1'
      })

      const item2 = await createTestItem(models, {
        userId: user2.id,
        title: 'Post by user2'
      })

      // Execute concurrent mutual zaps
      const results = await Promise.all([
        pay('ZAP', { id: item2.id, sats: 10 }, { models, me: user1 }),
        pay('ZAP', { id: item1.id, sats: 10 }, { models, me: user2 })
      ])

      // Both should succeed without deadlock
      expect(results[0].payInState).toBe('PAID')
      expect(results[1].payInState).toBe('PAID')
    })
  })

  describe('Refund on failure', () => {
    it('should refund custodial tokens on onFail', async () => {
      const user = await createTestUser(models, {
        mcredits: satsToMsats(100),
        msats: satsToMsats(100)
      })
      testUsers.push(user)

      // Create a payIn
      const payIn = await models.payIn.create({
        data: {
          payInType: 'ZAP',
          userId: user.id,
          mcost: satsToMsats(10),
          payInState: 'PENDING'
        }
      })

      // Create payIn custodial tokens (simulating deduction)
      await models.payInCustodialToken.createMany({
        data: [
          {
            payInId: payIn.id,
            mtokens: satsToMsats(5),
            custodialTokenType: 'CREDITS'
          },
          {
            payInId: payIn.id,
            mtokens: satsToMsats(5),
            custodialTokenType: 'SATS'
          }
        ]
      })

      // Manually deduct from user
      await models.user.update({
        where: { id: user.id },
        data: {
          mcredits: satsToMsats(95),
          msats: satsToMsats(95)
        }
      })

      // Call onFail
      await models.$transaction(async (tx) => {
        await onFail(tx, payIn.id)
      })

      // Should have refunded
      await assertUserBalance(models, user.id, {
        mcredits: satsToMsats(100),
        msats: satsToMsats(100)
      })

      // Should have created refund records
      const refunds = await models.refundCustodialToken.findMany({
        where: { payInId: payIn.id }
      })
      expect(refunds).toHaveLength(2)
    })
  })

  describe('Invoice overpayment', () => {
    it('should handle overpayment spillover to credits', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'PENDING', {
        userId: user.id,
        mcost: satsToMsats(10),
        withBolt11: true
      })

      // Create payOut tokens
      await models.payOutCustodialToken.create({
        data: {
          payInId: payIn.id,
          userId: null,
          mtokens: satsToMsats(10),
          payOutType: 'REWARDS_POOL',
          custodialTokenType: 'CREDITS'
        }
      })

      // Simulate overpayment (paid 12 sats instead of 10)
      const msatsReceived = satsToMsats(12)

      await models.$transaction(async (tx) => {
        // Update invoice to show overpayment
        await tx.payInBolt11.update({
          where: { payInId: payIn.id },
          data: { msatsReceived }
        })

        // This would normally be done in payInPaid transition
        const msatsOverpaid = msatsReceived - payIn.mcost
        if (msatsOverpaid > 0) {
          await tx.payOutCustodialToken.create({
            data: {
              mtokens: msatsOverpaid,
              userId: user.id,
              payOutType: 'INVOICE_OVERPAY_SPILLOVER',
              custodialTokenType: 'CREDITS',
              payInId: payIn.id
            }
          })
        }

        await onPaid(tx, payIn.id)
      })

      // Verify spillover was created
      const spillover = await models.payOutCustodialToken.findFirst({
        where: {
          payInId: payIn.id,
          payOutType: 'INVOICE_OVERPAY_SPILLOVER'
        }
      })
      expect(spillover).toBeTruthy()
      expect(spillover.mtokens).toBe(satsToMsats(2))

      // Verify user received the spillover as credits
      const updatedUser = await models.user.findUnique({
        where: { id: user.id }
      })
      expect(updatedUser.mcredits).toBeGreaterThanOrEqual(satsToMsats(2))
    })
  })

  describe('Item forwarding', () => {
    it('should handle zaps to items with forwards', async () => {
      const zapper = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(zapper)

      const author = await createTestUser(models)
      testUsers.push(author)

      const forwardee1 = await createTestUser(models)
      testUsers.push(forwardee1)

      const forwardee2 = await createTestUser(models)
      testUsers.push(forwardee2)

      const item = await createTestItem(models, {
        userId: author.id,
        title: 'Test Post'
      })

      // Add forwards
      await models.itemForward.createMany({
        data: [
          { itemId: item.id, userId: forwardee1.id, pct: 50 },
          { itemId: item.id, userId: forwardee2.id, pct: 30 }
        ]
      })

      // Zap the item
      const result = await pay('ZAP', {
        id: item.id,
        sats: 100
      }, {
        models,
        me: zapper
      })

      expect(result.payInState).toBe('PAID')

      // Verify payOuts
      const payOuts = await models.payOutCustodialToken.findMany({
        where: {
          payInId: result.id,
          payOutType: 'ZAP'
        }
      })

      // Should have payOuts for 2 forwardees + author's remaining
      // 70% of 100 = 70 sats total
      // 50% forward = 35 sats, 30% forward = 21 sats, remaining 14 sats to author
      expect(payOuts).toHaveLength(3)

      const forward1 = payOuts.find(p => p.userId === forwardee1.id)
      const forward2 = payOuts.find(p => p.userId === forwardee2.id)
      const authorPayOut = payOuts.find(p => p.userId === author.id)

      expect(forward1.mtokens).toBe(satsToMsats(100) * 70n / 100n * 50n / 100n) // 35 sats
      expect(forward2.mtokens).toBe(satsToMsats(100) * 70n / 100n * 30n / 100n) // 21 sats
      expect(authorPayOut.mtokens).toBe(satsToMsats(14)) // Remaining
    })
  })

  describe('Territory fees', () => {
    it('should distribute territory fees correctly for zaps', async () => {
      // Use existing 'bitcoin' territory instead of creating new one
      const bitcoinSub = await models.sub.findUnique({
        where: { name: 'bitcoin' }
      })

      const poster = await createTestUser(models)
      testUsers.push(poster)

      const zapper = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(zapper)

      const item = await createTestItem(models, {
        userId: poster.id,
        title: 'Test Post in Bitcoin Territory',
        subName: 'bitcoin'
      })

      // Zap the item
      const result = await pay('ZAP', {
        id: item.id,
        sats: 100
      }, {
        models,
        me: zapper
      })

      expect(result.payInState).toBe('PAID')

      // Verify territory revenue payOut exists
      const payOuts = await models.payOutCustodialToken.findMany({
        where: {
          payInId: result.id,
          payOutType: 'TERRITORY_REVENUE'
        }
      })

      // Territory should get a percentage of the zap (based on rewardsPct)
      expect(payOuts.length).toBeGreaterThan(0)
      if (payOuts.length > 0) {
        const territoryRevenue = payOuts[0]
        // Territory gets (100 - rewardsPct)% of remaining after zap payOut
        const expectedRevenue = satsToMsats(100) * (100n - BigInt(bitcoinSub.rewardsPct)) * 30n / 10000n
        expect(territoryRevenue.mtokens).toBe(expectedRevenue)
      }
    })
  })

  describe('Spam prevention', () => {
    it('should increase cost for rapid posts', async () => {
      const spammer = await createTestUser(models, {
        msats: satsToMsats(10000)
      })
      testUsers.push(spammer)

      // Create first post
      const result1 = await pay('ITEM_CREATE', {
        title: 'Post 1',
        text: 'Content',
        uploadIds: [],
        boost: 0,
        userId: spammer.id
      }, {
        models,
        me: spammer
      })

      const cost1 = result1.mcost

      // Create second post immediately
      const result2 = await pay('ITEM_CREATE', {
        title: 'Post 2',
        text: 'Content',
        uploadIds: [],
        boost: 0,
        userId: spammer.id
      }, {
        models,
        me: spammer
      })

      const cost2 = result2.mcost

      // Second post should cost more (anti-spam)
      expect(cost2).toBeGreaterThan(cost1)
    })
  })

  describe('Beneficiary chains', () => {
    it('should handle nested beneficiaries correctly', async () => {
      const user = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(user)

      // Create post with boost (boost is a beneficiary)
      const result = await pay('ITEM_CREATE', {
        title: 'Boosted Post',
        text: 'Content',
        uploadIds: [],
        boost: 10, // This creates a beneficiary
        userId: user.id
      }, {
        models,
        me: user
      })

      expect(result.payInState).toBe('PAID')

      // Verify beneficiary was created
      const beneficiaries = await models.payIn.findMany({
        where: { benefactorId: result.id }
      })

      expect(beneficiaries.length).toBeGreaterThan(0)

      // Verify both main payIn and beneficiary are PAID
      for (const beneficiary of beneficiaries) {
        expect(beneficiary.payInState).toBe('PAID')
      }
    })
  })
})
