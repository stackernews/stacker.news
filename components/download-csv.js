import Button from 'react-bootstrap/Button'

export function DownloadCsvButton ({ onClick }) {
  return (
    <Button
      variant='link'
      className='text-muted fw-bold ms-auto py-0 mb-2'
      size='sm'
      onClick={onClick}
    >
      download csv
    </Button>
  )
}
