import { useCallback, useState } from 'react'
import { Form, InputGroup, Button } from 'react-bootstrap'
import SearchIcon from '@/svgs/search-line.svg'

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
  }, [])

  return (
    <div className='d-flex justify-content-center mb-4 mt-4'>
      <div className='w-100' style={{ maxWidth: '400px' }}>
        <div className='position-relative'>
          <InputGroup>
            <Form.Control
              type='text'
              placeholder='Search wallets...'
              value={searchQuery}
              onChange={onChange}
            />
            <Button variant='primary' className='border-start-0'>
              <SearchIcon width='16' height='16' />
            </Button>
          </InputGroup>
        </div>
      </div>
    </div>
  )
}
