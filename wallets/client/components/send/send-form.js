import { useCallback, useState } from 'react'
import { Form } from '@/components/form'
import Bolt11Info from '@/components/payIn/bolt11-info'
import { useWalletLogger } from '@/wallets/client/hooks/logger'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import sendStyles from './send.module.css'
import classNames from 'classnames'
import { useFormikContext } from 'formik'
import { DestinationInput } from './destination-input'
import { useDestinationLookup } from './use-destination-lookup'
import { DestinationType, isLnAddrActive, parseDestination } from './destination'
import { LightningAddressFields } from './lightning-address-fields'
import { FeeControl } from './max-fee-field'
import { SendFooter } from './send-footer'
import { SendSuccess } from './send-success'
import { WalletSendError, sendErrorDisplay } from './send-error'
import { useExternalSubmit, useRewardSatsSubmit } from './send-submit'
import { sendFormSchema } from './schema'
const styles = { ...sharedStyles, ...sendStyles }

const MAX_FEE = 10

const INITIAL_VALUES = {
  destination: '',
  amount: 1,
  maxFee: MAX_FEE,
  comment: '',
  identifier: false,
  name: '',
  email: ''
}

// Two sibling forms over one presentational core. The reward-sats/external axis
// lives here, including whether a lightning address can fall back to the server.

export function RewardSatsSendForm ({ rewardSatsAvailable }) {
  const submit = useRewardSatsSubmit()
  const controller = useSendFormController({ submit, allowLnAddrServerFallback: true })
  const schema = sendFormSchema({
    spendableSats: rewardSatsAvailable,
    enforcesMaxFee: true,
    lnAddrLookup: controller.lnAddrLookup
  })

  return (
    <Form initial={INITIAL_VALUES} schema={schema} onSubmit={controller.handleSubmit}>
      <SendFormFields
        controller={controller}
        enforcesMaxFee
      />
    </Form>
  )
}

export function ExternalSendForm ({ wallet, protocol }) {
  const [sent, setSent] = useState(null)
  const logger = useWalletLogger(protocol)
  const submit = useExternalSubmit({ protocol, logger, onSent: setSent })
  const controller = useSendFormController({ submit })
  const enforcesMaxFee = !!protocol?.enforcesMaxFee
  const backHref = `/wallets/${wallet.id}`

  if (sent) return <SendSuccess sent={sent} backHref={backHref} />

  const schema = sendFormSchema({ enforcesMaxFee, lnAddrLookup: controller.lnAddrLookup })

  return (
    <Form initial={INITIAL_VALUES} schema={schema} onSubmit={controller.handleSubmit}>
      <SendFormFields
        controller={controller}
        enforcesMaxFee={enforcesMaxFee}
      />
    </Form>
  )
}

// Everything both modes do identically: the lookup, the inline error state, and
// the three handlers that clear that error before delegating.
function useSendFormController ({ submit, allowLnAddrServerFallback = false }) {
  const [sendError, setSendError] = useState(null)
  const { lnAddrLookup, checkDestination, onDestinationChange } = useDestinationLookup({
    allowServerFallback: allowLnAddrServerFallback
  })

  const handleSubmit = useCallback(async (values) => {
    setSendError(null)
    try {
      await submit(values, { lnAddrService: lnAddrLookup.service })
    } catch (err) {
      console.warn('failed to send wallet payment:', err)
      setSendError(sendErrorDisplay(err))
    }
  }, [lnAddrLookup.service, submit])

  const handleDestinationChange = useCallback((formik, event) => {
    setSendError(null)
    return onDestinationChange(formik, event)
  }, [onDestinationChange])

  const handleCheckDestination = useCallback((value) => {
    setSendError(null)
    return checkDestination(value)
  }, [checkDestination])

  return {
    lnAddrLookup,
    sendError,
    setSendError,
    handleSubmit,
    onDestinationChange: handleDestinationChange,
    checkDestination: handleCheckDestination
  }
}

function SendFormFields ({ controller, enforcesMaxFee }) {
  const { lnAddrLookup, sendError, setSendError, onDestinationChange, checkDestination } = controller
  const { values } = useFormikContext()
  const destination = parseDestination(values.destination)
  const showLnAddrFields = isLnAddrActive(destination, lnAddrLookup)
  const feeControl = (
    <FeeControl
      enforcesMaxFee={enforcesMaxFee}
      destination={destination}
      lnAddrPendingOrReady={showLnAddrFields}
    />
  )

  return (
    <>
      <div className={classNames(styles.fields, styles.formResponsiveReset, 'd-flex flex-column')}>
        <DestinationInput
          destination={destination}
          lnAddrLookup={lnAddrLookup}
          onDestinationChange={onDestinationChange}
          checkDestination={checkDestination}
        />
        {destination.type === DestinationType.LN_ADDR && showLnAddrFields && (
          <LightningAddressFields service={lnAddrLookup.service} maxFee={feeControl} />
        )}
        {destination.type === DestinationType.BOLT11 && (
          <>
            <Bolt11Info bolt11={destination.value} />
            {feeControl}
          </>
        )}
      </div>
      <WalletSendError error={sendError} onDismiss={() => setSendError(null)} />
      <SendFooter destination={destination} lnAddrLookup={lnAddrLookup} />
    </>
  )
}
