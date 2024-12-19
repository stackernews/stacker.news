import { decodeRune } from '@/lib/cln'
import { B64_URL_REGEX } from '@/lib/format'
import { string } from '@/lib/yup'

export const name = 'cln'
export const walletType = 'CLN'
export const walletField = 'walletCLN'

export const fields = [
  {
    name: 'socket',
    label: 'rest host and port',
    type: 'text',
    placeholder: '55.5.555.55:3010',
    hint: 'tor or clearnet',
    clear: true,
    serverOnly: true,
    validate: string().socket()
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
    clear: true,
    serverOnly: true,
    validate: string().matches(B64_URL_REGEX, { message: 'invalid rune' })
      .test({
        name: 'rune',
        test: (v, context) => {
          const decoded = decodeRune(v)
          if (!decoded) return context.createError({ message: 'invalid rune' })
          if (decoded.restrictions.length === 0) {
            return context.createError({ message: 'rune must be restricted to method=invoice' })
          }
          if (decoded.restrictions.length !== 1 || decoded.restrictions[0].alternatives.length !== 1) {
            return context.createError({ message: 'rune must be restricted to method=invoice only' })
          }
          if (decoded.restrictions[0].alternatives[0] !== 'method=invoice') {
            return context.createError({ message: 'rune must be restricted to method=invoice only' })
          }
          return true
        }
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
  title: 'CLN',
  subtitle: 'autowithdraw to your Core Lightning node via [CLNRest](https://docs.corelightning.org/docs/rest)',
  image: { src: '/wallets/cln.svg' }
}
