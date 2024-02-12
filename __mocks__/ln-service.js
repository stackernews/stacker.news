module.exports = {
  getIdentity: jest.fn().mockResolvedValue({ publicKey: '123' }),
  createHodlInvoice: jest.fn().mockResolvedValue(),
  createInvoice: jest.fn().mockResolvedValue(),
  decodePaymentRequest: jest.fn().mockResolvedValue(),
  payViaPaymentRequest: jest.fn().mockResolvedValue(),
  cancelHodlInvoice: jest.fn().mockResolvedValue(),
  getInvoice: jest.fn().mockResolvedValue(),
  getNode: jest.fn().mockResolvedValue(),
  authenticatedLndGrpc: jest.fn().mockResolvedValue({
    lnd: {}
  }),
  getHeight: jest.fn().mockResolvedValue({ current_block_height: 0 }),
  getChainFeeRate: jest.fn().mockResolvedValue({ tokens_per_vbyte: 0 }),
  getWalletInfo: jest.fn().mockResolvedValue({}),
  settleHodlInvoice: jest.fn().mockResolvedValue({})
}
