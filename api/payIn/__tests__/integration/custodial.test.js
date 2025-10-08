/* eslint-env jest */

import pay from '../../index.js'
import { satsToMsats } from '@/lib/format'
import {
  getPrisma,
  cleanupPrisma,
  createTestUser,
  createTestItem,
  assertUserBalance,
  assertPayInCustodialTokens,
  cleanupTestData
} from '../fixtures/testUtils.js'

describe('PayIn Custodial Flows', () => {
  let models
  const testUsers = []

  beforeAll(() => {
    models = getPrisma()
  })

  afterAll(async () => {
    await cleanupTestData(models, testUsers)
    await cleanupPrisma()
  })

  describe('Zap with custodial funds', () => {
    it('should pay for a zap with sufficient fee credits', async () => {
      const zapper = await createTestUser(models, {
        mcredits: satsToMsats(1000)
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

      // Assert payIn was created and paid immediately
      // Note: payIn properties are spread at top level, not nested under result.payIn
      expect(result).toBeTruthy()
      expect(result.payInState).toBe('PAID')
      expect(result.payInType).toBe('ZAP')
      expect(result.mcost).toBe(satsToMsats(zapAmount))

      // Assert zapper's balance was debited
      await assertUserBalance(models, zapper.id, {
        mcredits: satsToMsats(1000 - zapAmount)
      })

      // Assert payIn custodial token was created
      await assertPayInCustodialTokens(models, result.id, [
        { mtokens: satsToMsats(zapAmount), custodialTokenType: 'CREDITS' }
      ])

      // Assert payOuts were created
      const payOuts = await models.payOutCustodialToken.findMany({
        where: { payInId: result.id },
        orderBy: { payOutType: 'asc' }
      })

      expect(payOuts.length).toBeGreaterThan(0)

      // Find the ZAP payOut (should be 70% of total)
      const zapPayOut = payOuts.find(p => p.payOutType === 'ZAP')
      expect(zapPayOut).toBeTruthy()
      expect(zapPayOut.mtokens).toBe(satsToMsats(zapAmount) * 70n / 100n)

      // Assert recipient received the credits
      const updatedRecipient = await assertUserBalance(models, recipient.id, {})
      expect(updatedRecipient.mcredits).toBeGreaterThanOrEqual(satsToMsats(zapAmount) * 70n / 100n)
    })

    it('should pay for a zap with sufficient reward sats', async () => {
      const zapper = await createTestUser(models, {
        msats: satsToMsats(1000)
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

      expect(result.payInState).toBe('PAID')

      // Assert zapper's sats balance was debited
      await assertUserBalance(models, zapper.id, {
        msats: satsToMsats(1000 - zapAmount)
      })

      // Assert payIn custodial token was created with SATS
      await assertPayInCustodialTokens(models, result.id, [
        { mtokens: satsToMsats(zapAmount), custodialTokenType: 'SATS' }
      ])
    })

    it('should pay with mixed credits and sats when user has both', async () => {
      const zapper = await createTestUser(models, {
        mcredits: satsToMsats(5),
        msats: satsToMsats(100)
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

      expect(result.payInState).toBe('PAID')

      // Should prioritize spending credits first
      const payInTokens = await models.payInCustodialToken.findMany({
        where: { payInId: result.id },
        orderBy: { id: 'asc' }
      })

      // Should have used 5 sats of credits and 5 sats of reward sats
      const creditsToken = payInTokens.find(t => t.custodialTokenType === 'CREDITS')
      const satsToken = payInTokens.find(t => t.custodialTokenType === 'SATS')

      expect(creditsToken.mtokens).toBe(satsToMsats(5))
      expect(satsToken.mtokens).toBe(satsToMsats(5))

      // Assert final balances
      await assertUserBalance(models, zapper.id, {
        mcredits: 0n,
        msats: satsToMsats(95)
      })
    })
  })

  describe('Item creation with custodial funds', () => {
    it('should create an item with sufficient credits', async () => {
      const poster = await createTestUser(models, {
        mcredits: satsToMsats(100)
      })
      testUsers.push(poster)

      // Use existing 'bitcoin' territory instead of creating a new one
      const result = await pay('ITEM_CREATE', {
        title: 'Test Post',
        text: 'Test content',
        subName: 'bitcoin',
        uploadIds: [],
        boost: 0,
        userId: poster.id
      }, {
        models,
        me: poster
      })

      expect(result.payInState).toBe('PAID')
      expect(result.result).toBeTruthy()
      expect(result.result.title).toBe('Test Post')

      // Assert item was created
      const item = await models.item.findUnique({
        where: { id: result.result.id }
      })
      expect(item).toBeTruthy()
      expect(item.title).toBe('Test Post')
      expect(item.userId).toBe(poster.id)

      // Assert poster's balance was debited
      const updatedPoster = await models.user.findUnique({
        where: { id: poster.id }
      })
      expect(updatedPoster.mcredits).toBeLessThan(satsToMsats(100))
    })

    it('should create a comment with sufficient credits', async () => {
      const commenter = await createTestUser(models, {
        mcredits: satsToMsats(10)
      })
      testUsers.push(commenter)

      const postAuthor = await createTestUser(models)
      testUsers.push(postAuthor)

      const parentItem = await createTestItem(models, {
        userId: postAuthor.id,
        title: 'Parent Post'
      })

      const result = await pay('ITEM_CREATE', {
        text: 'Test comment',
        parentId: parentItem.id,
        uploadIds: [],
        boost: 0,
        userId: commenter.id
      }, {
        models,
        me: commenter
      })

      expect(result.payInState).toBe('PAID')
      expect(result.result).toBeTruthy()

      // Assert comment was created
      const comment = await models.item.findUnique({
        where: { id: result.result.id }
      })
      expect(comment).toBeTruthy()
      expect(comment.text).toBe('Test comment')
      expect(comment.parentId).toBe(parentItem.id)
    })
  })

  describe('Withdrawal with custodial funds', () => {
    it('should fail to create withdrawal without valid bolt11', async () => {
      const withdrawer = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(withdrawer)

      // Withdrawal requires a valid bolt11 invoice
      await expect(
        pay('WITHDRAWAL', {
          invoice: 'invalid_invoice',
          maxFee: 10
        }, {
          models,
          me: withdrawer
        })
      ).rejects.toThrow()
    })
  })

  describe('Error cases', () => {
    it('should create invoice when user has insufficient funds', async () => {
      const poorUser = await createTestUser(models, {
        mcredits: 0n,
        msats: 0n
      })
      testUsers.push(poorUser)

      const recipient = await createTestUser(models)
      testUsers.push(recipient)

      const item = await createTestItem(models, {
        userId: recipient.id,
        title: 'Test Post'
      })

      // Should create an invoice since user has no funds
      const result = await pay('ZAP', {
        id: item.id,
        sats: 10
      }, {
        models,
        me: poorUser
      })

      // Should be in PENDING state with invoice
      expect(result.payInState).toBe('PENDING')
      expect(result.payInBolt11).toBeTruthy()
      expect(result.payInBolt11.bolt11).toBeTruthy()
    })

    it('should fail when paying to invalid item', async () => {
      const zapper = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(zapper)

      await expect(
        pay('ZAP', {
          id: 999999999,
          sats: 10
        }, {
          models,
          me: zapper
        })
      ).rejects.toThrow()
    })

    it('should fail when anonymous user tries non-anonable action', async () => {
      await expect(
        pay('TERRITORY_CREATE', {
          name: `testterritory_${Date.now()}`,
          desc: 'Test',
          baseCost: 10
        }, {
          models,
          me: null
        })
      ).rejects.toThrow('You must be logged in')
    })
  })

  describe('Beneficiaries', () => {
    it('should handle item creation with boost as beneficiary', async () => {
      const poster = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(poster)

      const result = await pay('ITEM_CREATE', {
        title: 'Boosted Post',
        text: 'Test content',
        uploadIds: [],
        boost: 10,
        userId: poster.id
      }, {
        models,
        me: poster
      })

      expect(result.payInState).toBe('PAID')

      // Assert beneficiary was created for boost
      const beneficiaries = await models.payIn.findMany({
        where: { benefactorId: result.id }
      })

      expect(beneficiaries.length).toBeGreaterThan(0)
      expect(beneficiaries.some(b => b.payInType === 'BOOST')).toBe(true)
    })
  })
})
