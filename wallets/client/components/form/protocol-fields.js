import { useMemo } from 'react'
import { InputGroup } from 'react-bootstrap'
import classNames from 'classnames'
import { Input, PasswordInput } from '@/components/form'
import Text from '@/components/text'
import Info from '@/components/info'
import { parseNwcUrl } from '@/wallets/lib/validate'
import { appendLightningAddressDomain, protocolKey, stripLightningAddressDomain, walletLud16Domain } from '@/wallets/lib/util'
import { useFormikContext } from 'formik'
import { useWallet } from './hooks/context'
import { fieldSchema } from './hooks/validation'

// Fields live under the protocol's key in the single form (e.g. `NWC-send.url`),
// so every input name and Formik mutation is prefixed by it.
export function WalletProtocolFormField ({ protocol, type, onNwcLud16, ...props }) {
  const wallet = useWallet()
  const formik = useFormikContext()
  const key = protocolKey(protocol)
  // encrypt/share are field-descriptor metadata, not DOM props — strip them.
  const { validate: fieldValidate, encrypt, editable, help, share, ...fieldProps } = props
  const [upperHint, bottomHint] = Array.isArray(fieldProps.hint) ? fieldProps.hint : [null, fieldProps.hint]
  const parsedHelp = normalizeHelp(help)
  const readOnly = !!protocol.config?.[fieldProps.name] && editable === false
  const name = `${key}.${fieldProps.name}`
  const validate = useMemo(
    () => makeFieldValidator(fieldSchema({ name: fieldProps.name, required: fieldProps.required, validate: fieldValidate })),
    [fieldProps.name, fieldProps.required, fieldValidate])
  const label = (
    <div className='d-flex align-items-center'>
      {fieldProps.label}
      {parsedHelp && (
        <Info label={parsedHelp.label}>
          <Text>{parsedHelp.text}</Text>
        </Info>
      )}
      <small className={classNames('text-muted', !help && 'ms-2')}>
        {upperHint
          ? <Text>{upperHint}</Text>
          : (!fieldProps.required ? 'optional' : null)}
      </small>
    </div>
  )

  let append, onChange, onBlur, value
  // The LN_ADDR address is stored in full (domain included), like every other
  // value. This is the ONE place that knows the domain: it renders the address
  // domain-stripped with an @domain adornment and re-appends on input.
  const lnAddrDomain = protocol.name === 'LN_ADDR' && fieldProps.name === 'address'
    ? walletLud16Domain(wallet?.name)
    : undefined
  if (lnAddrDomain) {
    append = <InputGroup.Text className='text-monospace'>@{lnAddrDomain}</InputGroup.Text>
    value = stripLightningAddressDomain(formik.values[key]?.[fieldProps.name] ?? '', lnAddrDomain)
    onChange = (_formik, e) => formik.setFieldValue(name, appendLightningAddressDomain(e.target.value, lnAddrDomain))
  }

  if (protocol.name === 'NWC' && protocol.send && fieldProps.name === 'url') {
    // Input calls onChange as (formik, e); we only need the event here.
    onChange = (_formik, e) => {
      try {
        const { lud16 } = parseNwcUrl(e.target.value)
        if (lud16) onNwcLud16?.(lud16)
      } catch {
        // Ignore partial NWC strings while the user is still typing.
      }
    }
  }

  // Seed the complementary card's copy of a shared field (e.g. the lnbits url
  // used by both sides) when the user moves on — but only while that side is
  // still empty.
  if (share) {
    const siblingKey = protocolKey({ name: protocol.name, send: !protocol.send })
    onBlur = (e) => {
      if (!formik.values[siblingKey]?.[fieldProps.name]) {
        formik.setFieldValue(`${siblingKey}.${fieldProps.name}`, e.target.value)
      }
    }
  }

  const inputProps = { ...fieldProps, name, validate, hint: bottomHint, label, readOnly, append, onChange, onBlur, ...(value !== undefined && { value }) }
  switch (type) {
    case 'text': {
      return <Input {...inputProps} />
    }
    case 'password':
      return <PasswordInput {...inputProps} />
    default:
      return null
  }
}

// Adapt a field schema into a Formik validate fn: first error message, or
// undefined when valid. The schema already has `required` and any codec folded in.
function makeFieldValidator (schema) {
  if (!schema) return undefined
  return (value) => {
    try {
      schema.validateSync(value)
      return undefined
    } catch (err) {
      return err.message
    }
  }
}

function normalizeHelp (help) {
  if (!help) return null
  const parseHelpText = text => Array.isArray(text) ? text.join('\n\n') : text
  if (typeof help === 'string') return { label: null, text: help }
  if (Array.isArray(help)) return { label: null, text: parseHelpText(help) }
  return { label: help.label, text: parseHelpText(help.text) }
}
