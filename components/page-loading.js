import Moon from '@/svgs/moon-fill.svg'

export default function PageLoading () {
  return (
    <div className='flex justify-center mt-4 mb-1'>
      <Moon className='spin fill-grey' />
    </div>
  )
}
