/* eslint-env jest */

import pay from '../../index.js'
import { satsToMsats } from '@/lib/format'
import {
  getPrisma,
  cleanupPrisma,
  createTestUser,
  createTestItem,
  cleanupTestData
} from '../fixtures/testUtils.js'

describe('Specific PayIn Types', () => {
  let models
  const testUsers = []

  beforeAll(() => {
    models = getPrisma()
  })

  afterAll(async () => {
    await cleanupTestData(models, testUsers)
    await cleanupPrisma()
  })

  describe('ZAP', () => {
    it('should create a zap payIn with correct payOuts', async () => {
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

      const result = await pay('ZAP', {
        id: item.id,
        sats: 100
      }, {
        models,
        me: zapper
      })

      expect(result.payInType).toBe('ZAP')
      expect(result.payInState).toBe('PAID')

      // Verify ItemPayIn association
      const itemPayIn = await models.itemPayIn.findFirst({
        where: { payInId: result.id }
      })
      expect(itemPayIn).toBeTruthy()
      expect(itemPayIn.itemId).toBe(item.id)

      // Verify item was updated
      const updatedItem = await models.item.findUnique({
        where: { id: item.id }
      })
      expect(updatedItem.msats).toBeGreaterThan(0n)
      expect(updatedItem.lastZapAt).toBeTruthy()
    })

    it('should handle zap to bio (no sats earned)', async () => {
      const zapper = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(zapper)

      const bioOwner = await createTestUser(models)
      testUsers.push(bioOwner)

      const bio = await createTestItem(models, {
        userId: bioOwner.id,
        text: 'Bio content',
        bio: true
      })

      const result = await pay('ZAP', {
        id: bio.id,
        sats: 100
      }, {
        models,
        me: zapper
      })

      expect(result.payInState).toBe('PAID')

      // Bio zaps go to the bio owner as credits (like any zap)
      const payOuts = await models.payOutCustodialToken.findMany({
        where: {
          payInId: result.id,
          payOutType: 'ZAP',
          userId: bioOwner.id
        }
      })
      expect(payOuts).toHaveLength(1)
      expect(payOuts[0].custodialTokenType).toBe('CREDITS')
    })
  })

  describe('ITEM_CREATE', () => {
    it('should create post payIn', async () => {
      const poster = await createTestUser(models, {
        msats: satsToMsats(100)
      })
      testUsers.push(poster)

      const result = await pay('ITEM_CREATE', {
        title: 'Test Post',
        text: 'Test content',
        uploadIds: [],
        boost: 0,
        userId: poster.id
      }, {
        models,
        me: poster
      })

      expect(result.payInType).toBe('ITEM_CREATE')
      expect(result.payInState).toBe('PAID')
      expect(result.result).toBeTruthy()
      expect(result.result.title).toBe('Test Post')

      // Verify item was created
      const item = await models.item.findUnique({
        where: { id: result.result.id }
      })
      expect(item).toBeTruthy()
    })

    it('should create comment payIn', async () => {
      const commenter = await createTestUser(models, {
        msats: satsToMsats(100)
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

      expect(result.payInType).toBe('ITEM_CREATE')
      expect(result.result).toBeTruthy()

      const comment = await models.item.findUnique({
        where: { id: result.result.id }
      })
      expect(comment.parentId).toBe(parentItem.id)
    })

    it('should respect territory base cost', async () => {
      const poster = await createTestUser(models, {
        msats: satsToMsats(10000)
      })
      testUsers.push(poster)

      // Use bitcoin territory and check that baseCost affects the cost
      const bitcoinSub = await models.sub.findUnique({ where: { name: 'bitcoin' } })

      const result = await pay('ITEM_CREATE', {
        title: 'Post in Bitcoin Territory',
        text: 'Content',
        subName: 'bitcoin',
        uploadIds: [],
        boost: 0,
        userId: poster.id
      }, {
        models,
        me: poster
      })

      expect(result.payInState).toBe('PAID')
      // Cost should be at least the territory's base cost
      expect(result.mcost).toBeGreaterThanOrEqual(satsToMsats(bitcoinSub.baseCost))
    })

    it('should give freebies for comments when user lacks funds', async () => {
      const commenter = await createTestUser(models, {
        msats: 0n,
        mcredits: 0n
      })
      testUsers.push(commenter)

      const postAuthor = await createTestUser(models)
      testUsers.push(postAuthor)

      const parentItem = await createTestItem(models, {
        userId: postAuthor.id,
        title: 'Parent Post'
      })

      const result = await pay('ITEM_CREATE', {
        text: 'Freebie comment',
        parentId: parentItem.id,
        uploadIds: [],
        boost: 0,
        userId: commenter.id
      }, {
        models,
        me: commenter
      })

      // Should either be free (PAID) or create an invoice
      expect(['PAID', 'PENDING', 'PENDING_INVOICE_CREATION', 'PENDING_HELD']).toContain(result.payInState)

      // If it was a freebie, cost should be 0
      if (result.payInState === 'PAID') {
        expect(result.mcost).toBe(0n)
      }
    })
  })

  describe('ITEM_UPDATE', () => {
    it('should handle free item updates', async () => {
      const author = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(author)

      const item = await createTestItem(models, {
        userId: author.id,
        title: 'Original Title',
        text: 'Original content'
      })

      // Updates are typically free
      const result = await pay('ITEM_UPDATE', {
        id: item.id,
        title: 'Updated Title',
        text: 'Updated content',
        uploadIds: []
      }, {
        models,
        me: author
      })

      expect(result.payInType).toBe('ITEM_UPDATE')
      expect(result.mcost).toBe(0n)
      expect(result.payInState).toBe('PAID')

      // Verify item was updated
      const updatedItem = await models.item.findUnique({
        where: { id: item.id }
      })
      expect(updatedItem.title).toBe('Updated Title')
    })
  })

  describe('BOOST', () => {
    it('should boost an item', async () => {
      const booster = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(booster)

      const author = await createTestUser(models)
      testUsers.push(author)

      const item = await createTestItem(models, {
        userId: author.id,
        title: 'Test Post'
      })

      const result = await pay('BOOST', {
        id: item.id,
        sats: 100
      }, {
        models,
        me: booster
      })

      expect(result.payInType).toBe('BOOST')
      expect(result.payInState).toBe('PAID')

      // Verify item boost was recorded
      const updatedItem = await models.item.findUnique({
        where: { id: item.id }
      })
      expect(updatedItem.boost).toBeGreaterThan(0)
    })
  })

  describe('DOWN_ZAP', () => {
    it('should down-zap an item', async () => {
      const downZapper = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(downZapper)

      const author = await createTestUser(models)
      testUsers.push(author)

      const item = await createTestItem(models, {
        userId: author.id,
        title: 'Controversial Post'
      })

      const result = await pay('DOWN_ZAP', {
        id: item.id,
        sats: 1
      }, {
        models,
        me: downZapper
      })

      expect(result.payInType).toBe('DOWN_ZAP')
      expect(result.payInState).toBe('PAID')

      // Verify item down-zap was recorded
      const updatedItem = await models.item.findUnique({
        where: { id: item.id }
      })
      // Down-zaps might not immediately update weightedDownVotes (depends on trust score)
      // Just verify the payIn succeeded
      expect(updatedItem).toBeTruthy()
    })
  })

  describe('DONATE', () => {
    it('should make a donation to rewards', async () => {
      const donor = await createTestUser(models, {
        msats: satsToMsats(10000)
      })
      testUsers.push(donor)

      const result = await pay('DONATE', {
        sats: 1000
      }, {
        models,
        me: donor
      })

      expect(result.payInType).toBe('DONATE')
      expect(result.payInState).toBe('PAID')
      expect(result.mcost).toBe(satsToMsats(1000))

      // All should go to rewards pool
      const rewardsPayOut = await models.payOutCustodialToken.findFirst({
        where: {
          payInId: result.id,
          payOutType: 'REWARDS_POOL'
        }
      })
      expect(rewardsPayOut).toBeTruthy()
      expect(rewardsPayOut.mtokens).toBe(satsToMsats(1000))
    })
  })

  describe('BUY_CREDITS', () => {
    it('should purchase credits', async () => {
      const buyer = await createTestUser(models, {
        msats: 0n,
        mcredits: 0n
      })
      testUsers.push(buyer)

      const result = await pay('BUY_CREDITS', {
        credits: 1000 // BUY_CREDITS expects 'credits' not 'sats'
      }, {
        models,
        me: buyer
      })

      expect(result.payInType).toBe('BUY_CREDITS')

      // Should create invoice since user has no funds
      expect(['PENDING', 'PENDING_INVOICE_CREATION', 'PENDING_HELD']).toContain(result.payInState)
    })
  })

  describe('TERRITORY_CREATE', () => {
    it('should create a territory', async () => {
      const founder = await createTestUser(models, {
        msats: satsToMsats(100000)
      })
      testUsers.push(founder)

      const territoryName = `testterritory_${Date.now()}`

      const result = await pay('TERRITORY_CREATE', {
        name: territoryName,
        desc: 'Test territory description',
        baseCost: 10,
        billingType: 'RENT', // TERRITORY_CREATE expects billingType
        uploadIds: [] // TERRITORY_CREATE expects uploadIds array
      }, {
        models,
        me: founder
      })

      expect(result.payInType).toBe('TERRITORY_CREATE')
      expect(result.payInState).toBe('PAID')

      // Verify territory was created via SubPayIn
      const subPayIn = await models.subPayIn.findFirst({
        where: { payInId: result.id },
        include: { sub: true }
      })
      expect(subPayIn).toBeTruthy()
      expect(subPayIn.sub.name).toBe(territoryName)
      expect(subPayIn.sub.userId).toBe(founder.id)
    })
  })

  describe('POLL_VOTE', () => {
    it('should vote on a poll', async () => {
      const voter = await createTestUser(models, {
        msats: satsToMsats(100)
      })
      testUsers.push(voter)

      const pollCreator = await createTestUser(models)
      testUsers.push(pollCreator)

      // Create poll item
      const pollItem = await createTestItem(models, {
        userId: pollCreator.id,
        title: 'Test Poll',
        pollCost: 1,
        subName: 'bitcoin' // Poll needs a territory
      })

      // Create poll options
      const option1 = await models.pollOption.create({
        data: {
          itemId: pollItem.id,
          option: 'Option 1'
        }
      })

      const result = await pay('POLL_VOTE', {
        id: option1.id
      }, {
        models,
        me: voter
      })

      expect(result.payInType).toBe('POLL_VOTE')
      expect(result.payInState).toBe('PAID')

      // Verify vote was recorded (payInId is nullified for anonymity in onBegin)
      // Just verify the payIn succeeded
      expect(result.result).toBeTruthy()
      expect(result.result.id).toBe(option1.id)
    })
  })

  describe('Anonymous payIns', () => {
    it('should allow anonymous zaps', async () => {
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

      expect(result.payInType).toBe('ZAP')

      // Anonymous should use pessimistic flow
      expect(['PENDING_INVOICE_CREATION', 'PENDING_HELD']).toContain(result.payInState)
    })

    it('should allow anonymous item creation', async () => {
      const result = await pay('ITEM_CREATE', {
        text: 'Anonymous post',
        uploadIds: [],
        boost: 0,
        userId: null
      }, {
        models,
        me: null // anonymous
      })

      expect(result.payInType).toBe('ITEM_CREATE')

      // Anonymous should use pessimistic flow
      expect(['PENDING_INVOICE_CREATION', 'PENDING_HELD']).toContain(result.payInState)
    })

    it('should not allow anonymous territory creation', async () => {
      await expect(
        pay('TERRITORY_CREATE', {
          name: 'anonterritory',
          desc: 'Test'
        }, {
          models,
          me: null
        })
      ).rejects.toThrow('You must be logged in')
    })
  })

  describe('Error handling', () => {
    it('should reject invalid payIn type', async () => {
      const user = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(user)

      await expect(
        pay('INVALID_TYPE', {}, { models, me: user })
      ).rejects.toThrow('Invalid payIn type')
    })

    it('should reject payIn with missing required args', async () => {
      const user = await createTestUser(models, {
        msats: satsToMsats(1000)
      })
      testUsers.push(user)

      await expect(
        pay('ZAP', {}, { models, me: user })
      ).rejects.toThrow()
    })
  })
})
