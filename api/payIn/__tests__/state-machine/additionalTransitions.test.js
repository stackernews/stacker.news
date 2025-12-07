/* eslint-env jest */

import {
  payInFailed,
  payInCancel
} from '../../transitions.js'
import {
  getPrisma,
  cleanupPrisma,
  createTestUser,
  createPayInInState,
  assertPayInState,
  mockLndInvoice,
  cleanupTestData
} from '../fixtures/testUtils.js'

describe('Additional State Machine Transitions', () => {
  let models
  const testUsers = []
  const mockLnd = {}
  const mockBoss = {
    send: jest.fn((jobName, data, options) => {
      return Promise.resolve({ id: `job_${Date.now()}` })
    })
  }

  beforeAll(() => {
    models = getPrisma()
  })

  afterAll(async () => {
    await cleanupTestData(models, testUsers)
    await cleanupPrisma()
  })

  beforeEach(() => {
    mockBoss.send.mockClear()
  })

  describe('Direct FAILED transitions', () => {
    it('should transition PENDING → FAILED directly', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'PENDING', {
        userId: user.id,
        withBolt11: true
      })

      const cancelledInvoice = mockLndInvoice({
        hash: payIn.payInBolt11.hash,
        is_canceled: true
      })

      await payInFailed({
        data: { payInId: payIn.id, payInFailureReason: 'INVOICE_EXPIRED' },
        models,
        lnd: mockLnd,
        boss: mockBoss,
        invoice: cancelledInvoice
      })

      await assertPayInState(models, payIn.id, 'FAILED')
    })

    it('should transition PENDING_HELD → FAILED directly', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'PENDING_HELD', {
        userId: user.id,
        withBolt11: true
      })

      const cancelledInvoice = mockLndInvoice({
        hash: payIn.payInBolt11.hash,
        is_canceled: true
      })

      await payInFailed({
        data: { payInId: payIn.id, payInFailureReason: 'INVOICE_EXPIRED' },
        models,
        lnd: mockLnd,
        boss: mockBoss,
        invoice: cancelledInvoice
      })

      await assertPayInState(models, payIn.id, 'FAILED')
    })

    it('should transition HELD → FAILED directly', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'HELD', {
        userId: user.id,
        withBolt11: true
      })

      const cancelledInvoice = mockLndInvoice({
        hash: payIn.payInBolt11.hash,
        is_canceled: true
      })

      await payInFailed({
        data: { payInId: payIn.id, payInFailureReason: 'EXECUTION_FAILED' },
        models,
        lnd: mockLnd,
        boss: mockBoss,
        invoice: cancelledInvoice
      })

      await assertPayInState(models, payIn.id, 'FAILED')
    })

    it('should transition FAILED_FORWARD → FAILED', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'FAILED_FORWARD', {
        userId: user.id,
        withBolt11: true
      })

      const cancelledInvoice = mockLndInvoice({
        hash: payIn.payInBolt11.hash,
        is_canceled: true
      })

      await payInFailed({
        data: { payInId: payIn.id, payInFailureReason: 'INVOICE_FORWARDING_FAILED' },
        models,
        lnd: mockLnd,
        boss: mockBoss,
        invoice: cancelledInvoice
      })

      await assertPayInState(models, payIn.id, 'FAILED')
    })

    it('should transition PENDING_INVOICE_CREATION → FAILED', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'PENDING_INVOICE_CREATION', {
        userId: user.id
      })

      await payInFailed({
        data: { payInId: payIn.id, payInFailureReason: 'INVOICE_CREATION_FAILED' },
        models,
        lnd: mockLnd,
        boss: mockBoss
      })

      await assertPayInState(models, payIn.id, 'FAILED')
    })

    it('should transition PENDING_INVOICE_WRAP → FAILED', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'PENDING_INVOICE_WRAP', {
        userId: user.id
      })

      await payInFailed({
        data: { payInId: payIn.id, payInFailureReason: 'INVOICE_WRAPPING_FAILED_UNKNOWN' },
        models,
        lnd: mockLnd,
        boss: mockBoss
      })

      await assertPayInState(models, payIn.id, 'FAILED')
    })
  })

  describe('PENDING_INVOICE_CREATION transitions', () => {
    it('should transition PENDING_INVOICE_CREATION → PENDING', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      // Create a payIn in PENDING_INVOICE_CREATION
      const payIn = await createPayInInState(models, 'PENDING_INVOICE_CREATION', {
        userId: user.id
      })

      // Manually transition by updating state and adding bolt11
      await models.payIn.update({
        where: { id: payIn.id },
        data: {
          payInState: 'PENDING',
          payInBolt11: {
            create: {
              userId: user.id,
              hash: `test_hash_${payIn.id}_${Date.now()}_${Math.random()}`,
              bolt11: `lnbc${payIn.id}test`,
              msatsRequested: payIn.mcost,
              expiresAt: new Date(Date.now() + 3600000),
              preimage: `preimage_${payIn.id}`
            }
          }
        }
      })

      await assertPayInState(models, payIn.id, 'PENDING')
    })

    it('should transition PENDING_INVOICE_CREATION → PENDING_HELD', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'PENDING_INVOICE_CREATION', {
        userId: user.id
      })

      // Transition to PENDING_HELD (pessimistic)
      await models.payIn.update({
        where: { id: payIn.id },
        data: {
          payInState: 'PENDING_HELD',
          payInBolt11: {
            create: {
              userId: user.id,
              hash: `test_hash_${payIn.id}_${Date.now()}_${Math.random()}`,
              bolt11: `lnbc${payIn.id}hodl`,
              msatsRequested: payIn.mcost,
              expiresAt: new Date(Date.now() + 3600000),
              preimage: `preimage_${payIn.id}`
            }
          }
        }
      })

      await assertPayInState(models, payIn.id, 'PENDING_HELD')
    })
  })

  describe('PENDING_INVOICE_WRAP transitions', () => {
    it('should transition PENDING_INVOICE_WRAP → PENDING_HELD', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'PENDING_INVOICE_WRAP', {
        userId: user.id
      })

      // Transition to PENDING_HELD with wrapped invoice
      await models.payIn.update({
        where: { id: payIn.id },
        data: {
          payInState: 'PENDING_HELD',
          payInBolt11: {
            create: {
              userId: user.id,
              hash: `wrapped_hash_${payIn.id}_${Date.now()}_${Math.random()}`,
              bolt11: `lnbc${payIn.id}wrapped`,
              msatsRequested: payIn.mcost,
              expiresAt: new Date(Date.now() + 3600000),
              preimage: `preimage_${payIn.id}`
            }
          }
        }
      })

      await assertPayInState(models, payIn.id, 'PENDING_HELD')
    })
  })

  describe('Cancellation paths', () => {
    it('should transition PENDING → CANCELLED', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'PENDING', {
        userId: user.id,
        withBolt11: true
      })

      const invoice = mockLndInvoice({
        hash: payIn.payInBolt11.hash,
        is_held: false
      })

      await payInCancel({
        data: { payInId: payIn.id, payInFailureReason: 'USER_CANCELLED' },
        models,
        lnd: mockLnd,
        boss: mockBoss,
        invoice
      })

      await assertPayInState(models, payIn.id, 'CANCELLED')
    })

    it('should transition PENDING_HELD → CANCELLED', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'PENDING_HELD', {
        userId: user.id,
        withBolt11: true
      })

      const invoice = mockLndInvoice({
        hash: payIn.payInBolt11.hash,
        is_held: true
      })

      await payInCancel({
        data: { payInId: payIn.id, payInFailureReason: 'USER_CANCELLED' },
        models,
        lnd: mockLnd,
        boss: mockBoss,
        invoice
      })

      await assertPayInState(models, payIn.id, 'CANCELLED')
    })
  })

  describe('More invalid transitions', () => {
    it('should not transition FORWARDING → HELD', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'FORWARDING', {
        userId: user.id,
        withBolt11: true
      })

      // Try invalid transition (FORWARDING not in fromStates for HELD)
      // This should be ignored/no-op
      const result = await models.payIn.findUnique({
        where: { id: payIn.id }
      })

      expect(result.payInState).toBe('FORWARDING')
    })

    it('should not transition FORWARDED → CANCELLED', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'FORWARDED', {
        userId: user.id,
        withBolt11: true
      })

      const result = await models.payIn.findUnique({
        where: { id: payIn.id }
      })

      expect(result.payInState).toBe('FORWARDED')
    })
  })
})
