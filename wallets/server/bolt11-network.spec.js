/* eslint-env jest */

import { assertSameBolt11Network, bolt11Network } from './bolt11-network'

const mainnetInvoice = 'lnbc1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w'
const testnetInvoice = 'lntb1500n1pdn4czkpp5ugdqer05qrrxuchrzkcue94th9w2xzasp9qm7d0yxcgp4uh4kn4qdpa2fjkzep6yprkcmmzv9kzqsmj09c8gmmrw4e8yetwvdujq5n9va6kcct5d9hkucqzysdlghdpua7uvjjkcfj49psxtlqzkp5pdncffdfk2cp3mp76thrl29qhqgzufm503pjj96586n5w6edgw3n66j4rxxs707y4zdjuhyt6qqe5weu4'
const regtestInvoice = 'lnbcrt1u1p0fmafmpp5ptazmjuehcr3dk5wxdqd9uxz4e857w0xwz5h9rnem98wx86dhk0qdqqcqzpgxq92fjuqsp5ulvng3vsa6spedynlxeaufjy76njua2ykvhdnjztshcg92lfd2kq9qy9qsqsf9ct3nsfmfjz9fz9jkh376txuse520jjyg9vmm4tchnd9rh7umzwwxz7em5wmfx0y2eudcjj98kmgryz9r9evrcp7e4c9rwkemnswsqgptmd9'

describe('bolt11Network', () => {
  test.each([
    [mainnetInvoice, 'bitcoin'],
    [testnetInvoice, 'testnet'],
    [regtestInvoice, 'regtest']
  ])('parses invoice network %p', (invoice, expected) => {
    expect(bolt11Network(invoice)).toBe(expected)
  })

  test('throws a wallet validation error for invalid invoices', () => {
    expect(() => bolt11Network('lnbcnotvalid')).toThrow('wallet returned invalid invoice')
  })
})

describe('assertSameBolt11Network', () => {
  test('accepts invoices from the same network', () => {
    expect(() => assertSameBolt11Network({
      actual: regtestInvoice,
      expected: regtestInvoice
    })).not.toThrow()
  })

  test('rejects invoices from different networks', () => {
    expect(() => assertSameBolt11Network({
      actual: mainnetInvoice,
      expected: regtestInvoice
    })).toThrow('wallet invoice network mismatch: expected regtest, got bitcoin')
  })
})
