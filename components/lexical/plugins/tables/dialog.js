import { INSERT_TABLE_COMMAND } from '@lexical/table'
import { Form, Input, SubmitButton } from '@/components/form'
import { tableSchema } from '@/lib/validate'

export function InsertTableDialog ({ editor, onClose }) {
  const onSubmit = (values) => {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows: values.rows, columns: values.columns })
    onClose?.()
  }

  return (
    <>
      <Form
        initial={{
          rows: '5',
          columns: '5'
        }}
        schema={tableSchema}
        onSubmit={onSubmit}
      >
        <Input
          label='rows'
          name='rows'
          required
          autoFocus
          clear
          maxLength={3}
        />
        <Input
          label='columns'
          name='columns'
          required
          clear
          maxLength={2}
        />
        <SubmitButton variant='success' className='ms-auto mt-1 px-4' value='insert'>
          insert
        </SubmitButton>
      </Form>
    </>
  )
}
