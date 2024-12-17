import { withTimeout } from '@/lib/time'
export * from '@/wallets/bolt12'

export async function testCreateInvoice ({ offer }) {
  const timeout = 15_000
  return await withTimeout(createInvoice({ msats: 1000, expiry: 1 }, { offer }), timeout)
}

export async function createInvoice ({ msats, description, expiry }, { offer }) {
  return offer
}
