import { certValidator, runeValidator, socketValidator } from '@/wallets/lib//validate'

// Core Lightning REST API
// https://docs.corelightning.org/docs/rest

export default [
  {
    name: 'CLN_REST',
    displayName: 'CLNRest',
    send: false,
    fields: [
      {
        name: 'socket',
        label: 'rest host and port',
        type: 'text',
        placeholder: '55.5.555.55:3010',
        hint: 'tor or clearnet',
        required: true,
        validate: socketValidator(),
        share: true
      },
      {
        name: 'rune',
        label: 'invoice only rune',
        type: 'password',
        help: [
          'We only accept runes that *only* allow `method=invoice`.',
          'Run this to generate one if you are on v24.11 or later:',
          '```lightning-cli createrune restrictions=\'[["method=invoice"]]\'```',
          'Or this if you are on an earlier version:',
          '```lightning-cli createrune restrictions=\'["method=invoice"]\'```',
          '[see `createrune` documentation](https://docs.corelightning.org/reference/createrune#restriction-format)'
        ],
        placeholder: 'S34KtUW-6gqS_hD_9cc_PNhfF-NinZyBOCgr1aIrark9NCZtZXRob2Q9aW52b2ljZQ==',
        validate: runeValidator({ method: 'invoice' }),
        required: true,
        hint: 'must be restricted to method=invoice'
      },
      {
        name: 'cert',
        label: 'certificate',
        type: 'password',
        placeholder: 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUNNVENDQWRpZ0F3SUJBZ0lRSHBFdFdrcGJwZHV4RVF2eVBPc3NWVEFLQmdncWhrak9QUVFEQWpBdk1SOHcKSFFZRFZRUUtFeFpzYm1RZ1lYVjBiMmRsYm1WeVlYUmxaQ0JqWlhKME1Rd3dDZ1lEVlFRREV3TmliMkl3SGhjTgpNalF3TVRBM01qQXhORE0wV2hjTk1qVXdNekF6TWpBeE5ETTBXakF2TVI4d0hRWURWUVFLRXhac2JtUWdZWFYwCmIyZGxibVZ5WVhSbFpDQmpaWEowTVF3d0NnWURWUVFERXdOaWIySXdXVEFUQmdjcWhrak9QUUlCQmdncWhrak8KUFFNQkJ3TkNBQVJUS3NMVk5oZnhqb1FLVDlkVVdDbzUzSmQwTnBuL1BtYi9LUE02M1JxbU52dFYvdFk4NjJJZwpSbE41cmNHRnBEajhUeFc2OVhIK0pTcHpjWDdlN3N0Um80SFZNSUhTTUE0R0ExVWREd0VCL3dRRUF3SUNwREFUCkJnTlZIU1VFRERBS0JnZ3JCZ0VGQlFjREFUQVBCZ05WSFJNQkFmOEVCVEFEQVFIL01CMEdBMVVkRGdRV0JCVDAKMnh3V25GeHRUNzI0MWxwZlNoNm9FWi9UMWpCN0JnTlZIUkVFZERCeWdnTmliMktDQ1d4dlkyRnNhRzl6ZElJRApZbTlpZ2d4d2IyeGhjaTF1TVMxaWIyS0NGR2h2YzNRdVpHOWphMlZ5TG1sdWRHVnlibUZzZ2dSMWJtbDRnZ3AxCmJtbDRjR0ZqYTJWMGdnZGlkV1pqYjI1dWh3Ui9BQUFCaHhBQUFBQUFBQUFBQUFBQUFBQUFBQUFCaHdTc0VnQUQKTUFvR0NDcUdTTTQ5QkFNQ0EwY0FNRVFDSUEwUTlkRXdoNXpPRnpwL3hYeHNpemh5SkxNVG5yazU1VWx1NHJPRwo4WW52QWlBVGt4U3p3Y3hZZnFscGx0UlNIbmd0NUJFcDBzcXlHL05nenBzb2pmMGNqQT09Ci0tLS0tRU5EIENFUlRJRklDQVRFLS0tLS0K',
        hint: 'hex or base64 encoded',
        help: [
          'CLN generates self-signed TLS certificates on startup.',
          'The certificate of the certificate authority (CA) is needed to use them.',
          'By default, it is saved at $HOME/.lightning/bitcoin/ca.pem.',
          'This is optional if you are using a common certificate authority (e.g. cloud-hosted platform like Voltage).',
          '[see documentation](https://docs.corelightning.org/docs/grpc#generating-the-certificates)'
        ],
        validate: certValidator(),
        required: false
      }
    ],
    relationName: 'walletRecvCLNRest'
  },
  {
    name: 'CLN_REST',
    displayName: 'CLNRest',
    send: true,
    fields: [
      {
        name: 'socket',
        label: 'rest host and port',
        type: 'text',
        placeholder: '55.5.555.55:3010',
        required: true,
        validate: socketValidator(),
        share: true
      },
      {
        name: 'rune',
        label: 'pay only rune',
        type: 'password',
        help: [
          'We only accept runes that *only* allow `method=pay`.',
          'Run this to generate one if you are on v24.11 or later:',
          '```lightning-cli createrune restrictions=\'[["method=pay"]]\'```',
          'Or this if you are on an earlier version:',
          '```lightning-cli createrune restrictions=\'["method=pay"]\'```',
          '[see `createrune` documentation](https://docs.corelightning.org/reference/createrune#restriction-format)'
        ],
        placeholder: 'S34KtUW-6gqS_hD_9cc_PNhfF-NinZyBOCgr1aIrark9NCZtZXRob2Q9aW52b2ljZQ==',
        validate: runeValidator({ method: 'pay' }),
        required: true,
        encrypt: true,
        hint: 'must be restricted to method=pay'
      }
      // XXX we don't ask for the CA certificate because the browser's fetch API doesn't support http agents to override it.
      // Therefore, CLNRest send will only work with common CA certificates.
    ],
    relationName: 'walletSendCLNRest'
  }
]
