import { bech32 } from 'bech32'

export function encodeLNUrl (url) {
  const words = bech32.toWords(new TextEncoder().encode(url.toString()))
  return bech32.encode('lnurl', words, 1023)
}
