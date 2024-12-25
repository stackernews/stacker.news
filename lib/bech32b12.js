// bech32 without the checksum
//   used for bolt12

const ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

export function decode (str) {
  if (str.length > 2048) throw new Error('input is too long')
  const b5s = []
  for (const char of str) {
    const i = ALPHABET.indexOf(char)
    if (i === -1) throw new Error('invalid bech32 character')
    b5s.push(i)
  }
  const b8s = Buffer.from(convertBits(b5s, 5, 8, false))
  return b8s
}

export function encode (b8s) {
  if (b8s.length > 2048) throw new Error('input is too long')
  const b5s = convertBits(b8s, 8, 5, true)
  return b5s.map(b5 => ALPHABET[b5]).join('')
}

function convertBits (data, frombits, tobits, pad) {
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
