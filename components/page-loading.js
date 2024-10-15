import Moon from '@/svgs/moon-fill.svg'

export default function PageLoading () {
  return (
    <div className='d-flex justify-content-center mt-3 mb-1'>
      <Moon className='spin fill-grey' />
    </div>
  )
}
