export function deserializeTLVStream (buff) {
  const tlvs = []
  let bytePos = 0
  while (bytePos < buff.length) {
    const [type, typeLength] = readBigSize(buff, bytePos)
    bytePos += typeLength

    let [length, lengthLength] = readBigSize(buff, bytePos)
    length = Number(length)
    bytePos += lengthLength

    if (bytePos + length > buff.length) {
      throw new Error('invalid tlv stream')
    }

    const value = buff.subarray(bytePos, bytePos + length)
    bytePos += length

    tlvs.push({ type, length, value })
  }
  return tlvs
}

function readBigSize (buf, offset) {
  if (buf[offset] <= 252) {
    return [BigInt(buf[offset]), 1]
  } else if (buf[offset] === 253) {
    return [BigInt(buf.readUInt16BE(offset + 1)), 3]
  } else if (buf[offset] === 254) {
    return [BigInt(buf.readUInt32BE(offset + 1)), 5]
  } else if (buf[offset] === 255) {
    return [buf.readBigUInt64BE(offset + 1), 9]
  } else {
    throw new Error('Invalid bigsize')
  }
}
