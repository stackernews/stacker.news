const ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

export function decode (str) {
  const b5s = []
  for (const char of str) {
    const i = ALPHABET.indexOf(char)
    if (i === -1) throw new Error('Invalid bech32 character')
    b5s.push(i)
  }
  const b8s = Buffer.from(converBits(b5s, 5, 8, false))
  return b8s
}

export function encode (b8s) {
  const b5s = converBits(b8s, 8, 5, true)
  const str = []
  for (const b5 of b5s) str.push(ALPHABET[b5])
  return str.join('')
}

function converBits (data, frombits, tobits, pad) {
  let acc = 0
  let bits = 0
  const ret = []
  const maxv = (1 << tobits) - 1
  for (let p = 0; p < data.length; ++p) {
    const value = data[p]
    if (value < 0 || (value >> frombits) !== 0) {
      throw new RangeError('input value is outside of range')
    }
    acc = (acc << frombits) | value
    bits += frombits
    while (bits >= tobits) {
      bits -= tobits
      ret.push((acc >> bits) & maxv)
    }
  }
  if (pad) {
    if (bits > 0) {
      ret.push((acc << (tobits - bits)) & maxv)
    }
  } else if (bits >= frombits || ((acc << (tobits - bits)) & maxv)) {
    throw new RangeError('could not convert bits')
  }
  return ret
}
