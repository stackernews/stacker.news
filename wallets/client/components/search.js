import { Form } from 'react-bootstrap'

function searchKey (value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function searchTokens (value) {
  return value.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean)
}

function fuzzyMatch (needle, haystack) {
  let index = 0
  for (const char of haystack) {
    if (char === needle[index]) index += 1
    if (index === needle.length) return true
  }

  return false
}

export function fuzzySearch (query) {
  const needles = searchTokens(query)

  return (text) => {
    if (needles.length === 0) return true

    const haystack = searchKey(text)
    return needles.every(needle => fuzzyMatch(needle, haystack))
  }
}

export function WalletSearch ({ query, onQueryChange }) {
  return (
    <div className='d-flex justify-content-center mb-4 mt-4'>
      <div className='w-100' style={{ maxWidth: '400px' }}>
        <div className='position-relative'>
          <Form.Control
            type='text'
            placeholder='Search wallets...'
            value={query}
            onChange={e => onQueryChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
