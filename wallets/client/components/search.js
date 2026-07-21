import { inputClasses } from '@/components/form'

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
    <div className='flex justify-center mb-6 mt-6'>
      <div className='w-full' style={{ maxWidth: '400px' }}>
        <div className='relative'>
          <input
            type='text'
            placeholder='Search wallets...'
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            className={inputClasses()}
          />
        </div>
      </div>
    </div>
  )
}
