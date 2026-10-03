import { titleValidator, URI_SCHEME_REGEXP } from '../validate'

describe('titleValidator URI scheme rejection (issue #117)', () => {
  it('accepts a bare domain in the title', () => {
    expect(titleValidator.isValidSync('Crypto.com stadium hosts big game')).toBe(true)
  })

  it('accepts a normal title with no URL at all', () => {
    expect(titleValidator.isValidSync('Bitcoin hits a new all time high')).toBe(true)
  })

  it('rejects an https:// scheme in the title', () => {
    expect(titleValidator.isValidSync('check https://stacker.news for details')).toBe(false)
  })

  it('rejects a scheme anywhere and case-insensitively', () => {
    expect(URI_SCHEME_REGEXP.test('HTTPS://example.com')).toBe(true)
    expect(titleValidator.isValidSync('HTTP://example.com is down')).toBe(false)
    expect(titleValidator.isValidSync('read this ftp://files.example.com')).toBe(false)
  })

  it('still rejects an empty title', () => {
    expect(titleValidator.isValidSync('')).toBe(false)
  })
})