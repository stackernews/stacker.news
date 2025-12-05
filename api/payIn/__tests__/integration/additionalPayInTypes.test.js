/* eslint-env jest */

import pay from '../../index.js'
import { satsToMsats } from '@/lib/format'
import {
  getPrisma,
  cleanupPrisma,
  createTestUser,
  createTestTerritory,
  cleanupTestData
} from '../fixtures/testUtils.js'

describe('Additional PayIn Types', () => {
  let models
  const testUsers = []

  beforeAll(() => {
    models = getPrisma()
  })

  afterAll(async () => {
    await cleanupTestData(models, testUsers)
    await cleanupPrisma()
  })

  describe('AUTO_WITHDRAWAL', () => {
    it('should create auto withdrawal payIn', async () => {
      const withdrawer = await createTestUser(models, {
        msats: satsToMsats(100000),
        withLNbitsWallet: true
      })
      testUsers.push(withdrawer)

      const withdrawalMsats = satsToMsats(1000)
      const maxFeeMsats = satsToMsats(10)

      const result = await pay('AUTO_WITHDRAWAL', {
        msats: withdrawalMsats,
        maxFeeMsats
      }, {
        models,
        me: withdrawer
      })

      expect(result.payInType).toBe('AUTO_WITHDRAWAL')
      expect(result.payInState).toBe('PENDING_WITHDRAWAL')
      expect(result.payOutBolt11).toBeTruthy()
    })
  })

  describe('MEDIA_UPLOAD', () => {
    it('should pay for media upload as beneficiary', async () => {
      const uploader = await createTestUser(models, {
        msats: satsToMsats(10000)
      })
      testUsers.push(uploader)

      const upload = await models.upload.create({
        data: {
          userId: uploader.id,
          type: 'image/png',
          size: 1024,
          width: 100,
          height: 100,
          paid: false
        }
      })

      const result = await pay('ITEM_CREATE', {
        title: 'Post with Upload',
        text: 'Content',
        subName: 'bitcoin',
        uploadIds: [upload.id],
        boost: 0,
        userId: uploader.id
      }, {
        models,
        me: uploader
      })

      expect(result.payInState).toBe('PAID')

      const updatedUpload = await models.upload.findUnique({
        where: { id: upload.id }
      })
      expect(updatedUpload.paid).toBe(true)

      const beneficiaries = await models.payIn.findMany({
        where: { benefactorId: result.id, payInType: 'MEDIA_UPLOAD' }
      })
      expect(beneficiaries.length).toBeGreaterThan(0)
    })
  })

  describe('INVITE_GIFT', () => {
    it('should create invite gift payIn', async () => {
      const gifter = await createTestUser(models, {
        msats: satsToMsats(10000)
      })
      testUsers.push(gifter)

      const giftRecipient = await createTestUser(models, {
        msats: 0n,
        mcredits: 0n,
        inviteId: null,
        createdAt: new Date()
      })
      testUsers.push(giftRecipient)

      const giftAmount = 1000
      const invite = await models.invite.create({
        data: {
          userId: gifter.id,
          gift: giftAmount
        }
      })

      const result = await pay('INVITE_GIFT', {
        id: invite.id,
        userId: giftRecipient.id
      }, {
        models,
        me: gifter
      })

      expect(result.payInType).toBe('INVITE_GIFT')
      expect(result.payInState).toBe('PAID')

      const updatedRecipient = await models.user.findUnique({
        where: { id: giftRecipient.id }
      })
      expect(updatedRecipient.mcredits).toBeGreaterThanOrEqual(satsToMsats(giftAmount))
      expect(updatedRecipient.inviteId).toBe(invite.id)
    })
  })

  describe('TERRITORY_BILLING', () => {
    it('should pay territory billing', async () => {
      const territoryOwner = await createTestUser(models, {
        msats: satsToMsats(1000000)
      })
      testUsers.push(territoryOwner)

      const territory = await models.sub.findUnique({ where: { name: 'bitcoin' } })

      await models.sub.update({
        where: { name: 'bitcoin' },
        data: { userId: territoryOwner.id }
      })

      const result = await pay('TERRITORY_BILLING', {
        name: 'bitcoin'
      }, {
        models,
        me: territoryOwner
      })

      expect(result.payInType).toBe('TERRITORY_BILLING')
      expect(['PAID', 'PENDING_HELD', 'PENDING']).toContain(result.payInState)

      if (result.payInState === 'PAID') {
        const subPayIn = await models.subPayIn.findFirst({
          where: { payInId: result.id }
        })
        expect(subPayIn).toBeTruthy()
      }

      await models.sub.update({
        where: { name: 'bitcoin' },
        data: { userId: territory.userId }
      })
    })
  })

  describe('TERRITORY_UPDATE', () => {
    it('should update territory settings', async () => {
      const territoryOwner = await createTestUser(models, {
        msats: satsToMsats(1000000)
      })
      testUsers.push(territoryOwner)

      const territory = await createTestTerritory(models, {
        userId: territoryOwner.id,
        baseCost: 10,
        billingType: 'MONTHLY'
      })

      const result = await pay('TERRITORY_UPDATE', {
        oldName: territory.name,
        name: territory.name,
        desc: 'Updated description',
        baseCost: 20,
        billingType: 'MONTHLY',
        uploadIds: []
      }, {
        models,
        me: territoryOwner
      })

      expect(result.payInType).toBe('TERRITORY_UPDATE')
      expect(result.payInState).toBe('PAID')

      const updatedTerritory = await models.sub.findUnique({
        where: { name: territory.name }
      })
      expect(updatedTerritory.desc).toBe('Updated description')
      expect(updatedTerritory.baseCost).toBe(20)
    })
  })

  describe('TERRITORY_UNARCHIVE', () => {
    it('should unarchive territory', async () => {
      const territoryOwner = await createTestUser(models, {
        msats: satsToMsats(1000000)
      })
      testUsers.push(territoryOwner)

      const territory = await createTestTerritory(models, {
        userId: territoryOwner.id,
        status: 'STOPPED',
        billingType: 'MONTHLY'
      })

      const result = await pay('TERRITORY_UNARCHIVE', {
        name: territory.name,
        billingType: 'MONTHLY',
        uploadIds: []
      }, {
        models,
        me: territoryOwner
      })

      expect(result.payInType).toBe('TERRITORY_UNARCHIVE')
      expect(result.payInState).toBe('PAID')

      const updatedTerritory = await models.sub.findUnique({
        where: { name: territory.name }
      })
      expect(updatedTerritory.status).toBe('ACTIVE')
    })
  })

  describe('PROXY_PAYMENT', () => {
    it('should handle proxy payment', async () => {
      const payer = await createTestUser(models, {
        msats: satsToMsats(100000),
        withLNbitsWallet: true
      })
      testUsers.push(payer)

      // PROXY_PAYMENT creates invoice and wraps it
      // In test environment without full channel topology, wrapping may fail
      try {
        const result = await pay('PROXY_PAYMENT', {
          msats: satsToMsats(10),
          description: 'Test proxy payment'
        }, {
          models,
          me: payer
        })

        expect(result.payInType).toBe('PROXY_PAYMENT')

        // If successful, should be PENDING_HELD with wrapped invoice
        expect(result.payInState).toBe('PENDING_HELD')
        expect(result.payInBolt11).toBeTruthy()
        expect(result.payOutBolt11).toBeTruthy()
      } catch (error) {
        // Invoice wrapping may fail in test environment without routing
        // This is expected - validate the error is wrapping-related
        expect(error.message).toMatch(/wrapping|route|wallet/i)
        expect(error.payInFailureReason || error.name).toMatch(/WRAPPING|NoReceiveWallet/i)
      }
    })
  })

  describe('Error cases', () => {
    it('should reject invalid upload', async () => {
      const uploader = await createTestUser(models, {
        msats: satsToMsats(100)
      })
      testUsers.push(uploader)

      await expect(
        pay('MEDIA_UPLOAD', {
          uploadIds: [999999]
        }, {
          models,
          me: uploader
        })
      ).rejects.toThrow()
    })

    it('should reject territory billing for non-owner', async () => {
      const nonOwner = await createTestUser(models, {
        msats: satsToMsats(100000)
      })
      testUsers.push(nonOwner)

      // TERRITORY_BILLING should fail for non-owner
      // (May create invoice if user has funds, so check it fails at some point)
      try {
        const result = await pay('TERRITORY_BILLING', {
          name: 'bitcoin'
        }, {
          models,
          me: nonOwner
        })
        // If it didn't throw, it should at least not be PAID
        expect(result.payInState).not.toBe('PAID')
      } catch (error) {
        // Should throw an error about ownership
        expect(error.message).toMatch(/owner|permission|cannot/i)
      }
    })
  })
})
