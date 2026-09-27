// wrapper for ALL errors thrown from lib/deadbolt11
export class Bolt11SyntaxError extends Error {
  constructor (message, { bolt11, cause } = {}) {
    super(message)
    this.name = 'Bolt11SyntaxError'
    this.cause = cause

    // kept so server/worker rejections can repeat the offending invoice in the log
    // but URLEncoded to make sure we escape nasty characters
    if (typeof bolt11 === 'string') {
      let encodedBolt11
      try {
        encodedBolt11 = encodeURIComponent(bolt11)
        this.bolt11 = encodedBolt11.length > 7100 ? encodedBolt11.slice(0, 7100) + '...' : encodedBolt11
      } catch (encodeErr) {
        // do not supply any bolt11 if an encoding error occurs
      }
    }
  }
}
