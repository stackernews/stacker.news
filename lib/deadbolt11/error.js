// wrapper for ALL errors thrown from lib/deadbolt11
export class Bolt11SyntaxError extends Error {
  constructor (message, { bolt11, cause } = {}) {
    super(message)
    this.name = 'Bolt11SyntaxError'

    // kept so server/worker rejections can repeat the offending invoice in the log
    // but URLEncoded to make sure we escape nasty characters
    const encodedBolt11 = encodeURIComponent(bolt11)
    this.bolt11 = encodedBolt11.length > 7100 ? encodedBolt11.slice(0, 7100) + '...' : encodedBolt11
    this.cause = cause
  }
}
