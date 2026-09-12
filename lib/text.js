// Invisible line/paragraph separators that some editors (macOS Notes is the
// reported one) insert instead of plain newlines: U+2028 LINE SEPARATOR,
// U+2029 PARAGRAPH SEPARATOR and U+0085 NEXT LINE.
//
// They are invisible in browsers, survive JSON/database/relay round-trips
// (JSON.stringify does not escape them), and other clients — e.g. Nostr
// clients rendering a crossposted post — give them their own interpretation,
// which turns a correctly formatted post into a garbled one. See #546.
const LINE_SEPARATORS = /[\u2028\u2029\u0085]/g

/**
 * Replace invisible line/paragraph separators with a plain newline so every
 * consumer of the text agrees on where the line breaks are.
 *
 * Idempotent, and deliberately leaves `\n`, `\r\n` and other whitespace alone —
 * this is a normalisation of one specific class of characters, not a general
 * whitespace cleanup.
 *
 * @param {string} text
 * @returns {string} the same string with U+2028/U+2029/U+0085 replaced by "\n"
 */
export function normalizeLineSeparators (text) {
  if (typeof text !== 'string' || text.length === 0) return text
  return text.replace(LINE_SEPARATORS, '\n')
}
