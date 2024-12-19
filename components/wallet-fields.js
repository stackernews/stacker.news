import { ClientInput, PasswordInput, Checkbox, Select } from '@/components/form'
import Info from '@/components/info'
import { useIsClient } from '@/components/use-client'
import Text from '@/components/text'

export default function WalletFields ({ wallet: { config, fields, isConfigured } }) {
  const isClient = useIsClient()

  return fields
    .map(({ name, label = '', type, help, optional, editable, clientOnly, serverOnly, ...props }, i) => {
      const rawProps = {
        ...props,
        name,
        initialValue: config?.[name],
        readOnly: isClient && isConfigured && editable === false && !!config?.[name],
        groupClassName: props.hidden ? 'd-none' : undefined,
        label: label
          ? (
            <div className='d-flex align-items-center'>
              {label}
              {/* help can be a string or object to customize the label */}
              {help && (
                <Info label={help.label}>
                  <Text>{help.text || help}</Text>
                </Info>
              )}
              {optional && (
                <small className='text-muted ms-2'>
                  {typeof optional === 'boolean' ? 'optional' : <Text>{optional}</Text>}
                </small>
              )}
            </div>
            )
          : undefined,
        required: !optional,
        autoFocus: i === 0
      }
      if (type === 'text') {
        return <ClientInput key={i} {...rawProps} />
      }
      if (type === 'password') {
        return <PasswordInput key={i} {...rawProps} newPass />
      }
      if (type === 'checkbox') {
        return <Checkbox key={i} {...rawProps} />
      }
      if (type === 'select') {
        return <Select key={i} {...rawProps} />
      }
      return null
    })
}
