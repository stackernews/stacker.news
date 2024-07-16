import { CLNAutowithdrawSchema } from '@/lib/validate'
import { ensureB64 } from '@/lib/format'

export const name = 'cln'

export const fields = [
  {
    name: 'socket',
    label: 'rest host and port',
    type: 'text',
    placeholder: '55.5.555.55:3010',
    hint: 'tor or clearnet',
    clear: true
  },
  {
    name: 'rune',
    label: 'invoice only rune',
    help: {
      text: 'We only accept runes that *only* allow `method=invoice`.\nRun this to generate one:\n\n```lightning-cli createrune restrictions=\'["method=invoice"]\'```'
    },
    type: 'text',
    placeholder: 'S34KtUW-6gqS_hD_9cc_PNhfF-NinZyBOCgr1aIrark9NCZtZXRob2Q9aW52b2ljZQ==',
    hint: 'must be restricted to method=invoice',
    clear: true
  },
  {
    name: 'cert',
    label: 'cert',
    type: 'text',
    placeholder: 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUNNVENDQWRpZ0F3SUJBZ0lRSHBFdFdrcGJwZHV4RVF2eVBPc3NWVEFLQmdncWhrak9QUVFEQWpBdk1SOHcKSFFZRFZRUUtFeFpzYm1RZ1lYVjBiMmRsYm1WeVlYUmxaQ0JqWlhKME1Rd3dDZ1lEVlFRREV3TmliMkl3SGhjTgpNalF3TVRBM01qQXhORE0wV2hjTk1qVXdNekF6TWpBeE5ETTBXakF2TVI4d0hRWURWUVFLRXhac2JtUWdZWFYwCmIyZGxibVZ5WVhSbFpDQmpaWEowTVF3d0NnWURWUVFERXdOaWIySXdXVEFUQmdjcWhrak9QUUlCQmdncWhrak8KUFFNQkJ3TkNBQVJUS3NMVk5oZnhqb1FLVDlkVVdDbzUzSmQwTnBuL1BtYi9LUE02M1JxbU52dFYvdFk4NjJJZwpSbE41cmNHRnBEajhUeFc2OVhIK0pTcHpjWDdlN3N0Um80SFZNSUhTTUE0R0ExVWREd0VCL3dRRUF3SUNwREFUCkJnTlZIU1VFRERBS0JnZ3JCZ0VGQlFjREFUQVBCZ05WSFJNQkFmOEVCVEFEQVFIL01CMEdBMVVkRGdRV0JCVDAKMnh3V25GeHRUNzI0MWxwZlNoNm9FWi9UMWpCN0JnTlZIUkVFZERCeWdnTmliMktDQ1d4dlkyRnNhRzl6ZElJRApZbTlpZ2d4d2IyeGhjaTF1TVMxaWIyS0NGR2h2YzNRdVpHOWphMlZ5TG1sdWRHVnlibUZzZ2dSMWJtbDRnZ3AxCmJtbDRjR0ZqYTJWMGdnZGlkV1pqYjI1dWh3Ui9BQUFCaHhBQUFBQUFBQUFBQUFBQUFBQUFBQUFCaHdTc0VnQUQKTUFvR0NDcUdTTTQ5QkFNQ0EwY0FNRVFDSUEwUTlkRXdoNXpPRnpwL3hYeHNpemh5SkxNVG5yazU1VWx1NHJPRwo4WW52QWlBVGt4U3p3Y3hZZnFscGx0UlNIbmd0NUJFcDBzcXlHL05nenBzb2pmMGNqQT09Ci0tLS0tRU5EIENFUlRJRklDQVRFLS0tLS0K',
    optional: 'optional if from [CA](https://en.wikipedia.org/wiki/Certificate_authority) (e.g. voltage)',
    hint: 'hex or base64 encoded',
    clear: true
  }
]

export const card = {
  title: 'CLN',
  subtitle: 'autowithdraw to your Core Lightning node via [CLNRest](https://docs.corelightning.org/docs/rest)',
  badges: ['receive only', 'non-custodialish']
}

export const schema = CLNAutowithdrawSchema

export const server = {
  walletType: 'CLN',
  walletField: 'walletCLN',
  resolverName: 'upsertWalletCLN',
  testConnect: async (
    { socket, rune, cert },
    { me, models, addWalletLog, cln: { createInvoice } }
  ) => {
    cert = ensureB64(cert)
    const inv = await createInvoice({
      socket,
      rune,
      cert,
      description: 'SN connection test',
      msats: 'any',
      expiry: 0
    })
    await addWalletLog({ wallet: { type: 'CLN' }, level: 'SUCCESS', message: 'connected to CLN' }, { me, models })
    return inv
  },
  createInvoice: async (
    { amount },
    { socket, rune, cert },
    { me, models, lnd, cln: { createInvoice } }
  ) => {
    cert = ensureB64(cert)

    const inv = await createInvoice({
      socket,
      rune,
      cert,
      description: me.hideInvoiceDesc ? undefined : 'autowithdraw to CLN from SN',
      msats: amount + 'sat',
      expiry: 360
    })
    return inv.bolt11
  }
}
