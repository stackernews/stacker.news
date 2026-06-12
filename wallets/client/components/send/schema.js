import { satsToMsats } from '@/lib/format'
import { intValidator, lnAddrAmountError, lnAddrCommentError, lnAddrField, lnAddrPayerError } from '@/lib/validate'
import { lazy, mixed, object, string } from '@/lib/yup'
import { DestinationType, isLnAddrActive, isLnAddrSubmittable, lnAddrStatus, parseDestination } from './destination'

const maxFeeSchema = intValidator.required('required').min(0, 'must be at least 0')

// The `lazy` callback assembles only the fields that apply to the current
// destination. Most fields need only the lookup's `service`, so it's passed
// directly rather than the whole lookup object.
//   spendableSats — optional balance ceiling the send must stay under
export function sendFormSchema ({ spendableSats, enforcesMaxFee, lnAddrLookup }) {
  const { service } = lnAddrLookup
  const destination = destinationField(lnAddrLookup, spendableSats, enforcesMaxFee)
  const lnAddrFields = {
    amount: amountField(service, spendableSats),
    ...(service.commentAllowed ? { comment: lnAddrField('comment', value => lnAddrCommentError(value, service)) } : null),
    identifier: lnAddrField('identifier', value => lnAddrPayerError('identifier', value, service)),
    name: lnAddrField('name', value => lnAddrPayerError('name', value, service)),
    email: lnAddrField('email', value => lnAddrPayerError('email', value, service))
  }

  return lazy(values => {
    const dest = parseDestination(values.destination)
    const showLnAddr = isLnAddrActive(dest, lnAddrLookup)
    const showMaxFee = enforcesMaxFee && (dest.type === DestinationType.BOLT11 || showLnAddr)
    return object({
      destination,
      ...(showLnAddr ? lnAddrFields : null),
      ...(showMaxFee ? { maxFee: maxFeeSchema } : null)
    })
  })
}

// Bolt11 must carry an amount within any ceiling; a lightning address must
// finish its check before we can submit.
function destinationField (lnAddrLookup, spendableSats, enforcesMaxFee) {
  return string()
    .required('required')
    .test('destination', function (value) {
      const dest = parseDestination(value)

      if (dest.type === DestinationType.BOLT11) {
        if (dest.invoiceMsats == null) return this.createError({ message: 'invoice must specify an amount' })
        if (dest.invoiceMsats % 1000n !== 0n) return this.createError({ message: 'invoice amount must be a whole number of sats' })
        if (spendableSats == null) return true
        const maxFee = this.parent.maxFee
        if (enforcesMaxFee && !maxFeeSchema.isValidSync(maxFee)) return true
        if (dest.invoiceMsats <= satsToMsats(spendableAfterMaxFee(spendableSats, enforcesMaxFee ? maxFee : null))) return true
        return this.createError({ message: 'invoice amount exceeds available balance' })
      }

      if (dest.type === DestinationType.LN_ADDR) {
        if (isLnAddrSubmittable(dest, lnAddrLookup)) return true
        const status = lnAddrStatus(dest, lnAddrLookup)
        if (status === 'error') {
          return this.createError({ message: lnAddrLookup.error || 'lightning address check failed' })
        }
        return this.createError({ message: 'wait for lightning address check' })
      }

      return true
    })
}

// Amount is the one lightning-address field that also answers to the balance
// ceiling, so it takes spendableSats on top of the provider service.
function amountField (service, spendableSats) {
  return mixed().test('amount', function (value) {
    const error = lnAddrAmountError(value, service)
    if (error) return this.createError({ message: error })
    if (spendableSats != null && value != null && Number(value) > spendableAfterMaxFee(spendableSats, this.parent.maxFee)) {
      return this.createError({ message: 'amount exceeds available balance' })
    }
    return true
  })
}

function spendableAfterMaxFee (spendableSats, maxFee) {
  return (spendableSats ?? 0) - (Number(maxFee) || 0)
}
