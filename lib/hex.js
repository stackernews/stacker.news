/**
 * Convert a buffer to a hex string
 * @param {*} buffer - the buffer to convert
 * @returns {string} - the hex string
 */
export function toHex (buffer) {
  const byteArray = new Uint8Array(buffer)
  const hexString = Array.from(byteArray, byte => byte.toString(16).padStart(2, '0')).join('')
  return hexString
}

/**
 * Convert a hex string to a buffer
 * @param {string} hex - the hex string to convert
 * @returns {ArrayBuffer} - the buffer
 */
export function fromHex (hex) {
  const byteArray = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
  return byteArray.buffer
}
