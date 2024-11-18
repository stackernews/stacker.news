import { isInvoicableMacaroon, isInvoiceMacaroon } from '@/lib/macaroon'
import { string } from '@/lib/yup'

export const name = 'lnd'
export const walletType = 'LND'
export const walletField = 'walletLND'

export const fields = [
  {
    name: 'socket',
    label: 'grpc host and port',
    type: 'text',
    placeholder: '55.5.555.55:10001',
    hint: 'tor or clearnet',
    clear: true,
    serverOnly: true,
    validate: string().socket()
  },
  {
    name: 'macaroon',
    label: 'invoice macaroon',
    help: {
      label: 'privacy tip',
      text: 'We accept a prebaked ***invoice.macaroon*** for your convenience. To gain better privacy, generate a new macaroon as follows:\n\n```lncli bakemacaroon invoices:write invoices:read```'
    },
    type: 'text',
    placeholder: 'AgEDbG5kAlgDChCn7YgfWX7uTkQQgXZ2uahNEgEwGhYKB2FkZHJlc3MSBHJlYWQSBXdyaXRlGhcKCGludm9pY2VzEgRyZWFkEgV3cml0ZRoPCgdvbmNoYWluEgRyZWFkAAAGIJkMBrrDV0npU90JV0TGNJPrqUD8m2QYoTDjolaL6eBs',
    hint: 'hex or base64 encoded',
    clear: true,
    serverOnly: true,
    validate: string().hexOrBase64().test({
      name: 'macaroon',
      test: v => isInvoiceMacaroon(v) || isInvoicableMacaroon(v),
      message: 'not an invoice macaroon or an invoicable macaroon'
    })
  },
  {
    name: 'cert',
    label: 'cert',
    type: 'text',
    placeholder: 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUNNVENDQWRpZ0F3SUJBZ0lRSHBFdFdrcGJwZHV4RVF2eVBPc3NWVEFLQmdncWhrak9QUVFEQWpBdk1SOHcKSFFZRFZRUUtFeFpzYm1RZ1lYVjBiMmRsYm1WeVlYUmxaQ0JqWlhKME1Rd3dDZ1lEVlFRREV3TmliMkl3SGhjTgpNalF3TVRBM01qQXhORE0wV2hjTk1qVXdNekF6TWpBeE5ETTBXakF2TVI4d0hRWURWUVFLRXhac2JtUWdZWFYwCmIyZGxibVZ5WVhSbFpDQmpaWEowTVF3d0NnWURWUVFERXdOaWIySXdXVEFUQmdjcWhrak9QUUlCQmdncWhrak8KUFFNQkJ3TkNBQVJUS3NMVk5oZnhqb1FLVDlkVVdDbzUzSmQwTnBuL1BtYi9LUE02M1JxbU52dFYvdFk4NjJJZwpSbE41cmNHRnBEajhUeFc2OVhIK0pTcHpjWDdlN3N0Um80SFZNSUhTTUE0R0ExVWREd0VCL3dRRUF3SUNwREFUCkJnTlZIU1VFRERBS0JnZ3JCZ0VGQlFjREFUQVBCZ05WSFJNQkFmOEVCVEFEQVFIL01CMEdBMVVkRGdRV0JCVDAKMnh3V25GeHRUNzI0MWxwZlNoNm9FWi9UMWpCN0JnTlZIUkVFZERCeWdnTmliMktDQ1d4dlkyRnNhRzl6ZElJRApZbTlpZ2d4d2IyeGhjaTF1TVMxaWIyS0NGR2h2YzNRdVpHOWphMlZ5TG1sdWRHVnlibUZzZ2dSMWJtbDRnZ3AxCmJtbDRjR0ZqYTJWMGdnZGlkV1pqYjI1dWh3Ui9BQUFCaHhBQUFBQUFBQUFBQUFBQUFBQUFBQUFCaHdTc0VnQUQKTUFvR0NDcUdTTTQ5QkFNQ0EwY0FNRVFDSUEwUTlkRXdoNXpPRnpwL3hYeHNpemh5SkxNVG5yazU1VWx1NHJPRwo4WW52QWlBVGt4U3p3Y3hZZnFscGx0UlNIbmd0NUJFcDBzcXlHL05nenBzb2pmMGNqQT09Ci0tLS0tRU5EIENFUlRJRklDQVRFLS0tLS0K',
    optional: 'optional if from [CA](https://en.wikipedia.org/wiki/Certificate_authority) (e.g. voltage)',
    hint: 'hex or base64 encoded',
    clear: true,
    serverOnly: true,
    validate: string().hexOrBase64()
  }
]

export const card = {
  title: 'LND',
  subtitle: 'autowithdraw to your Lightning Labs node',
  image: { src: '/wallets/lnd.png' }
}
