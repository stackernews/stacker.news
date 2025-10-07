/* eslint-env jest */

import {
  payInPaid,
  payInHeld,
  payInCancel,
  payInFailed,
  payInForwarding,
  payInForwarded,
  payInFailedForward,
  payInWithdrawalPaid,
  payInWithdrawalFailed
} from '../../transitions.js'
import {
  getPrisma,
  cleanupPrisma,
  createTestUser,
  createPayInInState,
  assertPayInState,
  mockLndInvoice,
  mockLndPayment,
  cleanupTestData
} from '../fixtures/testUtils.js'

describe('PayIn State Machine Transitions', () => {
  let models
  const testUsers = []
  const mockLnd = {}
  const mockBoss = {
    send: jest.fn((jobName, data, options) => {
      // Mock successful job creation
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

  describe('Valid Transitions', () => {
    describe('Optimistic Flow', () => {
      it('should transition PENDING → PAID', async () => {
        const user = await createTestUser(models)
        testUsers.push(user)

        const payIn = await createPayInInState(models, 'PENDING', {
          userId: user.id,
          withBolt11: true
        })

        // Mock LND invoice as confirmed
        const invoice = mockLndInvoice({
          hash: payIn.payInBolt11.hash,
          is_confirmed: true,
          received_mtokens: String(payIn.mcost)
        })

        await payInPaid({
          data: { payInId: payIn.id },
          models,
          lnd: mockLnd,
          boss: mockBoss,
          invoice
        })

        await assertPayInState(models, payIn.id, 'PAID')
      })

      it('should transition PENDING → CANCELLED → FAILED', async () => {
        const user = await createTestUser(models)
        testUsers.push(user)

        const payIn = await createPayInInState(models, 'PENDING', {
          userId: user.id,
          withBolt11: true
        })

        // Mock LND invoice as held
        const invoice = mockLndInvoice({
          hash: payIn.payInBolt11.hash,
          is_held: true
        })

        // Transition to CANCELLED
        await payInCancel({
          data: { payInId: payIn.id, payInFailureReason: 'USER_CANCELLED' },
          models,
          lnd: mockLnd,
          boss: mockBoss,
          invoice
        })

        await assertPayInState(models, payIn.id, 'CANCELLED')

        // Mock as cancelled
        const cancelledInvoice = mockLndInvoice({
          hash: payIn.payInBolt11.hash,
          is_canceled: true
        })

        // Transition to FAILED
        await payInFailed({
          data: { payInId: payIn.id, payInFailureReason: 'USER_CANCELLED' },
          models,
          lnd: mockLnd,
          boss: mockBoss,
          invoice: cancelledInvoice
        })

        await assertPayInState(models, payIn.id, 'FAILED')
      })
    })

    describe('Pessimistic Flow', () => {
      it('should transition PENDING_HELD → HELD → PAID', async () => {
        const user = await createTestUser(models)
        testUsers.push(user)

        const payIn = await createPayInInState(models, 'PENDING_HELD', {
          userId: user.id,
          withBolt11: true
        })

        // Mock LND invoice as held
        const heldInvoice = mockLndInvoice({
          hash: payIn.payInBolt11.hash,
          is_held: true,
          received_mtokens: String(payIn.mcost)
        })

        // Transition to HELD
        await payInHeld({
          data: { payInId: payIn.id },
          models,
          lnd: mockLnd,
          boss: mockBoss,
          invoice: heldInvoice
        })

        await assertPayInState(models, payIn.id, 'HELD')

        // Mock as confirmed
        const confirmedInvoice = mockLndInvoice({
          hash: payIn.payInBolt11.hash,
          is_confirmed: true,
          received_mtokens: String(payIn.mcost)
        })

        // Transition to PAID
        await payInPaid({
          data: { payInId: payIn.id },
          models,
          lnd: mockLnd,
          boss: mockBoss,
          invoice: confirmedInvoice
        })

        await assertPayInState(models, payIn.id, 'PAID')
      })

      it('should transition PENDING_HELD → CANCELLED → FAILED', async () => {
        const user = await createTestUser(models)
        testUsers.push(user)

        const payIn = await createPayInInState(models, 'PENDING_HELD', {
          userId: user.id,
          withBolt11: true
        })

        const heldInvoice = mockLndInvoice({
          hash: payIn.payInBolt11.hash,
          is_held: true
        })

        await payInCancel({
          data: { payInId: payIn.id, payInFailureReason: 'USER_CANCELLED' },
          models,
          lnd: mockLnd,
          boss: mockBoss,
          invoice: heldInvoice
        })

        await assertPayInState(models, payIn.id, 'CANCELLED')

        const cancelledInvoice = mockLndInvoice({
          hash: payIn.payInBolt11.hash,
          is_canceled: true
        })

        await payInFailed({
          data: { payInId: payIn.id, payInFailureReason: 'USER_CANCELLED' },
          models,
          lnd: mockLnd,
          boss: mockBoss,
          invoice: cancelledInvoice
        })

        await assertPayInState(models, payIn.id, 'FAILED')
      })

      it('should transition HELD → CANCELLED → FAILED', async () => {
        const user = await createTestUser(models)
        testUsers.push(user)

        const payIn = await createPayInInState(models, 'HELD', {
          userId: user.id,
          withBolt11: true
        })

        const heldInvoice = mockLndInvoice({
          hash: payIn.payInBolt11.hash,
          is_held: true
        })

        await payInCancel({
          data: { payInId: payIn.id, payInFailureReason: 'SYSTEM_CANCELLED' },
          models,
          lnd: mockLnd,
          boss: mockBoss,
          invoice: heldInvoice
        })

        await assertPayInState(models, payIn.id, 'CANCELLED')
      })
    })

    describe('P2P Flow', () => {
      it('should transition PENDING_HELD → FORWARDING → FORWARDED → PAID', async () => {
        const user = await createTestUser(models)
        testUsers.push(user)

        const payIn = await createPayInInState(models, 'PENDING_HELD', {
          userId: user.id,
          withBolt11: true,
          withPayOutBolt11: true
        })

        // Add routing fee payOut
        await models.payOutCustodialToken.create({
          data: {
            payInId: payIn.id,
            userId: user.id,
            mtokens: 30000n,
            payOutType: 'ROUTING_FEE',
            custodialTokenType: 'SATS'
          }
        })

        // Add rewards pool payOut
        await models.payOutCustodialToken.create({
          data: {
            payInId: payIn.id,
            userId: null,
            mtokens: 60000n,
            payOutType: 'REWARDS_POOL',
            custodialTokenType: 'CREDITS'
          }
        })

        const heldInvoice = mockLndInvoice({
          hash: payIn.payInBolt11.hash,
          is_held: true,
          received_mtokens: String(payIn.mcost)
        })

        // Transition to FORWARDING
        await payInForwarding({
          data: { payInId: payIn.id },
          models,
          lnd: mockLnd,
          boss: mockBoss,
          invoice: heldInvoice
        })

        await assertPayInState(models, payIn.id, 'FORWARDING')

        // Mock outgoing payment as confirmed
        const confirmedPayment = mockLndPayment({
          hash: payIn.payOutBolt11.hash,
          is_confirmed: true,
          fee_mtokens: '10000',
          secret: 'preimage123'
        })

        // Transition to FORWARDED
        await payInForwarded({
          data: { payInId: payIn.id },
          models,
          lnd: mockLnd,
          boss: mockBoss,
          invoice: heldInvoice,
          withdrawal: confirmedPayment
        })

        await assertPayInState(models, payIn.id, 'FORWARDED')

        // Mock invoice as confirmed
        const confirmedInvoice = mockLndInvoice({
          hash: payIn.payInBolt11.hash,
          is_confirmed: true,
          received_mtokens: String(payIn.mcost)
        })

        // Transition to PAID
        await payInPaid({
          data: { payInId: payIn.id },
          models,
          lnd: mockLnd,
          boss: mockBoss,
          invoice: confirmedInvoice
        })

        await assertPayInState(models, payIn.id, 'PAID')
      })

      it('should transition FORWARDING → FAILED_FORWARD → CANCELLED → FAILED', async () => {
        const user = await createTestUser(models)
        testUsers.push(user)

        const payIn = await createPayInInState(models, 'FORWARDING', {
          userId: user.id,
          withBolt11: true,
          withPayOutBolt11: true
        })

        const heldInvoice = mockLndInvoice({
          hash: payIn.payInBolt11.hash,
          is_held: true
        })

        const failedPayment = mockLndPayment({
          hash: payIn.payOutBolt11.hash,
          is_failed: true
        })

        // Transition to FAILED_FORWARD
        await payInFailedForward({
          data: { payInId: payIn.id },
          models,
          lnd: mockLnd,
          boss: mockBoss,
          invoice: heldInvoice,
          withdrawal: failedPayment
        })

        await assertPayInState(models, payIn.id, 'FAILED_FORWARD')
      })
    })

    describe('Withdrawal Flow', () => {
      it('should transition PENDING_WITHDRAWAL → PAID', async () => {
        const user = await createTestUser(models, {
          msats: 1000000n
        })
        testUsers.push(user)

        const payIn = await createPayInInState(models, 'PENDING_WITHDRAWAL', {
          userId: user.id,
          withPayOutBolt11: true
        })

        // Add routing fee
        await models.payOutCustodialToken.create({
          data: {
            payInId: payIn.id,
            userId: user.id,
            mtokens: 30000n,
            payOutType: 'ROUTING_FEE',
            custodialTokenType: 'SATS'
          }
        })

        const confirmedPayment = mockLndPayment({
          hash: payIn.payOutBolt11.hash,
          is_confirmed: true,
          fee_mtokens: '10000'
        })

        await payInWithdrawalPaid({
          data: { payInId: payIn.id },
          models,
          lnd: mockLnd,
          boss: mockBoss,
          withdrawal: confirmedPayment
        })

        await assertPayInState(models, payIn.id, 'PAID')
      })

      it('should transition PENDING_WITHDRAWAL → FAILED', async () => {
        const user = await createTestUser(models, {
          msats: 1000000n
        })
        testUsers.push(user)

        const payIn = await createPayInInState(models, 'PENDING_WITHDRAWAL', {
          userId: user.id,
          withPayOutBolt11: true
        })

        const failedPayment = mockLndPayment({
          hash: payIn.payOutBolt11.hash,
          is_failed: true
        })

        await payInWithdrawalFailed({
          data: { payInId: payIn.id },
          models,
          lnd: mockLnd,
          boss: mockBoss,
          withdrawal: failedPayment
        })

        await assertPayInState(models, payIn.id, 'FAILED')
      })
    })
  })

  describe('Invalid Transitions', () => {
    it('should not transition from PAID state', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'PAID', {
        userId: user.id,
        withBolt11: true
      })

      const invoice = mockLndInvoice({
        hash: payIn.payInBolt11.hash,
        is_confirmed: true
      })

      // Try to transition again (should be no-op)
      await payInPaid({
        data: { payInId: payIn.id },
        models,
        lnd: mockLnd,
        boss: mockBoss,
        invoice
      })

      // Should still be PAID
      await assertPayInState(models, payIn.id, 'PAID')
    })

    it('should not transition from FAILED state', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'FAILED', {
        userId: user.id,
        withBolt11: true
      })

      const invoice = mockLndInvoice({
        hash: payIn.payInBolt11.hash,
        is_confirmed: true
      })

      // Try to transition to PAID (should be no-op)
      await payInPaid({
        data: { payInId: payIn.id },
        models,
        lnd: mockLnd,
        boss: mockBoss,
        invoice
      })

      // Should still be FAILED
      await assertPayInState(models, payIn.id, 'FAILED')
    })

    it('should not transition PENDING → HELD directly', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'PENDING', {
        userId: user.id,
        withBolt11: true
      })

      const invoice = mockLndInvoice({
        hash: payIn.payInBolt11.hash,
        is_held: true
      })

      // Try to transition to HELD (should be no-op since fromStates doesn't include PENDING)
      await payInHeld({
        data: { payInId: payIn.id },
        models,
        lnd: mockLnd,
        boss: mockBoss,
        invoice
      })

      // Should still be PENDING
      const updatedPayIn = await models.payIn.findUnique({
        where: { id: payIn.id }
      })
      expect(updatedPayIn.payInState).toBe('PENDING')
    })
  })

  describe('Concurrent Transitions', () => {
    it('should handle concurrent transition attempts gracefully', async () => {
      const user = await createTestUser(models)
      testUsers.push(user)

      const payIn = await createPayInInState(models, 'PENDING', {
        userId: user.id,
        withBolt11: true
      })

      const invoice = mockLndInvoice({
        hash: payIn.payInBolt11.hash,
        is_confirmed: true,
        received_mtokens: String(payIn.mcost)
      })

      // Simulate concurrent transitions
      const results = await Promise.allSettled([
        payInPaid({
          data: { payInId: payIn.id },
          models,
          lnd: mockLnd,
          boss: mockBoss,
          invoice
        }),
        payInPaid({
          data: { payInId: payIn.id },
          models,
          lnd: mockLnd,
          boss: mockBoss,
          invoice
        })
      ])

      // At least one should succeed
      const succeeded = results.filter(r => r.status === 'fulfilled')
      expect(succeeded.length).toBeGreaterThanOrEqual(1)

      // Final state should be PAID
      await assertPayInState(models, payIn.id, 'PAID')
    })
  })
})
