import ActionTooltip from '@/components/action-tooltip'
import { useState } from 'react'
import { Dropdown } from 'react-bootstrap'
import styles from '@/components/lexical/theme/theme.module.css'
import { Form, Input, SubmitButton, Checkbox, DatePicker, InputUserSuggest } from '@/components/form'
import { customMigrationSchema } from '@/lib/validate'
import { useShowModal } from '@/components/modal'
import { useFormikContext } from 'formik'
import InputGroup from 'react-bootstrap/InputGroup'
import { gql, useMutation, useQuery } from '@apollo/client'
import { useToast } from '@/components/toast'
import Moon from '@/svgs/moon-fill.svg'

export default function LexicalMigrationDashboard () {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const showModal = useShowModal()
  const [executeBatchConversion] = useMutation(gql`
    mutation executeBatchConversion($limit: Int) {
      executeBatchConversion(limit: $limit) {
        success
        message
      }
    }
  `)
  const { data } = useQuery(gql`
    query migratedItems {
      migratedItems {
        converted
        total
      }
    }
  `, { pollInterval: 5000, nextFetchPolicy: 'cache-and-network' })

  return (
    <ActionTooltip notForm overlayText='lexical migration helper' placement='bottom' noWrapper showDelay={500} transition disable={dropdownOpen}>
      <Dropdown onToggle={setDropdownOpen} show={dropdownOpen}>
        <Dropdown.Toggle
          id='dropdown-basic'
          as='a'
          onPointerDown={e => e.preventDefault()}
          className='pointer text-muted'
        >
          {data
            ? (
              <>
                {data?.migratedItems?.converted} / {data?.migratedItems?.total}
                <span className='text-muted ms-1'>
                  ({(data?.migratedItems?.converted / data?.migratedItems?.total * 100).toFixed(2)}%)
                </span>
              </>
              )
            : (
              <span className='text-muted'>
                <Moon className='spin fill-grey' />
              </span>
              )}
        </Dropdown.Toggle>
        <Dropdown.Menu className={styles.dropdownExtra}>
          <Dropdown.Header className='text-muted text-center fw-bold'>
            lexical migration helper
          </Dropdown.Header>
          <Dropdown.Item className={styles.dropdownExtraItem}>
            <span className={styles.tableActionMenuLabel}>
              {data?.migratedItems?.converted} / {data?.migratedItems?.total}
              <span className={styles.tableActionMenuItemShortcut}>
                migrated / total
              </span>
            </span>
            <span className='text-muted'>
              {(data?.migratedItems?.converted / data?.migratedItems?.total * 100).toFixed(2)}%
            </span>
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item className={styles.tableActionMenuItem} onClick={() => executeBatchConversion({ variables: { limit: 1000 } })}>
            <span className={styles.tableActionMenuLabel}>
              migrate every item
              <span className={styles.tableActionMenuItemShortcut}>
                in batches of 1000 items
              </span>
            </span>
          </Dropdown.Item>
          <Dropdown.Item
            className={styles.dropdownExtraItem}
            onClick={() => showModal(onClose => <CustomMigrationModal onClose={onClose} />)}
          >
            custom migration
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </ActionTooltip>
  )
}

function CustomMigrationModal ({ onClose }) {
  const toaster = useToast()
  const [executeBatchConversion] = useMutation(gql`
    mutation executeBatchConversion($limit: Int, $values: CustomMigrationInput!) {
      executeBatchConversion(limit: $limit, values: $values) {
        success
        message
      } 
    }
  `)
  return (
    <div>
      <h2>custom migration</h2>
      <p className='text-muted'>send a migration job with custom options</p>
      <Form
        initial={{
          fromId: 0,
          toId: 0,
          user: '',
          by: 'id',
          fromDate: undefined,
          toDate: undefined,
          migrateComments: true,
          checkMedia: false
        }}
        schema={customMigrationSchema}
        onSubmit={async (values) => {
          console.log(values)
          const { data } = await executeBatchConversion({
            variables: {
              values
            }
          })
          console.log(data)
          if (data.executeBatchConversion.success) {
            onClose()
          } else {
            toaster.danger(data.executeBatchConversion.message)
          }
        }}
      >
        <CustomMigrationForm />
      </Form>
    </div>
  )
}

function CustomMigrationForm () {
  const { values } = useFormikContext()
  return (
    <>
      <h4>by</h4>
      <Checkbox type='radio' label='id' name='by' value='id' id='id-checkbox' groupClassName='mb-0' />
      {values.by === 'id' && (
        <div className='d-flex gap-2'>
          <Input label='from ID' name='fromId' />
          <Input label='to ID' name='toId' />
        </div>
      )}
      <Checkbox type='radio' label='date' name='by' value='date' id='date-checkbox' groupClassName='mb-0' />
      {values.by === 'date' && (
        <>
          <DatePicker fromName='fromDate' toName='toDate' />
        </>
      )}
      <Checkbox type='radio' label='user' name='by' value='user' id='user-checkbox' groupClassName='mb-0' />
      {values.by === 'user' && (
        <>
          <InputUserSuggest
            name='user'
            prepend={<InputGroup.Text>@</InputGroup.Text>}
            showValid
          />
        </>
      )}
      <hr className='mt-2 mb-3' />
      <h4>options</h4>
      <div className='d-flex flex-column'>
        <Checkbox label='migrate comments' name='migrateComments' groupClassName='mb-0' />
        <Checkbox label='check media' name='checkMedia' groupClassName='mb-0' />
      </div>
      <SubmitButton variant='success' type='submit'>migrate now</SubmitButton>
    </>
  )
}
