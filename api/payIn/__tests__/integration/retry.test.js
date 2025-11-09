/* eslint-env jest */

import { retry } from '../../index.js'
import { satsToMsats } from '@/lib/format'
import {
  getPrisma,
  cleanupPrisma,
  createTestUser,
  createTestItem,
  createPayInInState,
  assertUserBalance,
  cleanupTestData
} from '../fixtures/testUtils.js'

describe('PayIn Retry Functionality', () => {
  let models
  const testUsers = []

  beforeAll(() => {
    models = getPrisma()
  })

  afterAll(async () => {
    await cleanupTestData(models, testUsers)
    await cleanupPrisma()
  })

  describe('Retry failed payIns', () => {
    it('should retry a failed zap', async () => {
      const zapper = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(zapper)

      const recipient = await createTestUser(models)
      testUsers.push(recipient)

      await createTestItem(models, {
        userId: recipient.id,
        title: 'Test Post for Retry'
      })

      // Create a failed payIn (itemPayIn is auto-created for ZAP type)
      const failedPayIn = await createPayInInState(models, 'FAILED', {
        payInType: 'ZAP',
        userId: zapper.id,
        mcost: satsToMsats(10)
      })

      // Create payOut custodial tokens for the failed payIn
      // Important: payOuts must equal mcost (10 sats = 7 + 3)
      await models.payOutCustodialToken.createMany({
        data: [
          {
            payInId: failedPayIn.id,
            userId: recipient.id,
            mtokens: satsToMsats(7),
            payOutType: 'ZAP',
            custodialTokenType: 'CREDITS'
          },
          {
            payInId: failedPayIn.id,
            userId: null,
            mtokens: satsToMsats(3),
            payOutType: 'REWARDS_POOL',
            custodialTokenType: 'CREDITS'
          }
        ]
      })

      // Retry the payIn
      const result = await retry(failedPayIn.id, {
        models,
        me: zapper
      })

      // Should create a new payIn
      expect(result.id).not.toBe(failedPayIn.id)
      expect(result.payInType).toBe('ZAP')
      expect(result.userId).toBe(zapper.id)

      // Should link to original payIn via genesisId
      expect(result.genesisId).toBe(failedPayIn.id)

      // Should update failed payIn's successorId
      const updatedFailed = await models.payIn.findUnique({
        where: { id: failedPayIn.id }
      })
      expect(updatedFailed.successorId).toBe(result.id)

      // Verify retry created a new payIn with same cost
      expect(result.mcost).toBe(satsToMsats(10))

      // If user has funds, should be PAID
      if (result.payInState === 'PAID') {
        // Should have debited user's balance
        await assertUserBalance(models, zapper.id, {
          msats: satsToMsats(990)
        })
      }
    })

    it('should not retry a payIn that is not FAILED', async () => {
      const user = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'PAID', {
        userId: user.id
      })

      await expect(
        retry(payIn.id, { models, me: user })
      ).rejects.toThrow()
    })

    it('should not retry a payIn for a different user', async () => {
      const user1 = await createTestUser(models)
      testUsers.push(user1)

      const user2 = await createTestUser(models)
      testUsers.push(user2)

      const payIn = await createPayInInState(models, 'FAILED', {
        userId: user1.id
      })

      await expect(
        retry(payIn.id, { models, me: user2 })
      ).rejects.toThrow()
    })

    it('should not retry withdrawal payIns', async () => {
      const user = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'FAILED', {
        payInType: 'WITHDRAWAL',
        userId: user.id
      })

      await expect(
        retry(payIn.id, { models, me: user })
      ).rejects.toThrow('Withdrawal payIns cannot be retried')
    })

    it('should clone payOut custodial tokens on retry', async () => {
      const user = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(user)

      const recipient = await createTestUser(models)
      testUsers.push(recipient)

      await createTestItem(models, {
        userId: recipient.id,
        title: 'Test Post for Clone'
      })

      // Create failed payIn
      const failedPayIn = await createPayInInState(models, 'FAILED', {
        payInType: 'ZAP',
        userId: user.id,
        mcost: satsToMsats(10)
      })

      await models.payOutCustodialToken.createMany({
        data: [
          {
            payInId: failedPayIn.id,
            userId: recipient.id,
            mtokens: satsToMsats(7),
            payOutType: 'ZAP',
            custodialTokenType: 'CREDITS'
          },
          {
            payInId: failedPayIn.id,
            userId: null,
            mtokens: satsToMsats(3),
            payOutType: 'REWARDS_POOL',
            custodialTokenType: 'CREDITS'
          }
        ]
      })

      // Retry
      const result = await retry(failedPayIn.id, {
        models,
        me: user
      })

      // Should have cloned payOuts to new payIn
      const newPayOuts = await models.payOutCustodialToken.findMany({
        where: { payInId: result.id },
        orderBy: { payOutType: 'asc' }
      })

      expect(newPayOuts).toHaveLength(2)
      expect(newPayOuts[0].payOutType).toBe('REWARDS_POOL')
      expect(newPayOuts[0].mtokens).toBe(satsToMsats(3))
      expect(newPayOuts[1].payOutType).toBe('ZAP')
      expect(newPayOuts[1].mtokens).toBe(satsToMsats(7))
    })
  })

  describe('Retry chain tracking', () => {
    it('should track genesis payIn across multiple retries', async () => {
      const user = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(user)

      const recipient = await createTestUser(models)
      testUsers.push(recipient)

      await createTestItem(models, {
        userId: recipient.id,
        title: 'Test Post for Genesis'
      })

      // Create original failed payIn
      const originalPayIn = await createPayInInState(models, 'FAILED', {
        payInType: 'ZAP',
        userId: user.id,
        mcost: satsToMsats(10)
      })

      await models.payOutCustodialToken.create({
        data: {
          payInId: originalPayIn.id,
          userId: recipient.id,
          mtokens: satsToMsats(10),
          payOutType: 'ZAP',
          custodialTokenType: 'CREDITS'
        }
      })

      // First retry
      const firstRetry = await retry(originalPayIn.id, {
        models,
        me: user
      })

      expect(firstRetry.genesisId).toBe(originalPayIn.id)

      // Mark first retry as failed
      await models.payIn.update({
        where: { id: firstRetry.id },
        data: { payInState: 'FAILED', successorId: null }
      })

      // Second retry
      const secondRetry = await retry(firstRetry.id, {
        models,
        me: user
      })

      // Should still point to original genesis
      expect(secondRetry.genesisId).toBe(originalPayIn.id)
    })
  })
})
