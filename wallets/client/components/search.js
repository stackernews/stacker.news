import { useCallback, useState } from 'react'
import { Form } from 'react-bootstrap'

function fuzzySearch (query) {
  return (text) => {
    const pattern = query.toLowerCase().split('').join('.*')
    const regex = new RegExp(pattern)
    return regex.test(text.toLowerCase())
  }
}

export function WalletSearch ({ setSearchFilter }) {
  const [searchQuery, setSearchQuery] = useState('')

  const onChange = useCallback((e) => {
    const query = e.target.value
    setSearchQuery(query)
    setSearchFilter(() => fuzzySearch(query))
  }, [setSearchFilter])

  return (
    <div className='d-flex justify-content-center mb-4 mt-4'>
      <div className='w-100' style={{ maxWidth: '400px' }}>
        <div className='position-relative'>
          <Form.Control
            type='text'
            placeholder='Search wallets...'
            value={searchQuery}
            onChange={onChange}
          />
        </div>
      </div>
    </div>
  )
}
