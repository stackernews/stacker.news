// wrapper for ALL errors thrown from lib/deadbolt11
export class Bolt11SyntaxError extends Error {
  constructor (message, { bolt11, cause } = {}) {
    super(message)
    this.name = 'Bolt11SyntaxError'
    // kept so server/worker rejections can repeat the offending invoice in the log
    this.bolt11 = bolt11
    this.cause = cause
  }
}
