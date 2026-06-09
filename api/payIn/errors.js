export class PayInFailureReasonError extends Error {
  constructor (message, payInFailureReason) {
    super(message)
    this.name = 'PayInFailureReasonError'
    this.payInFailureReason = payInFailureReason
  }
}
