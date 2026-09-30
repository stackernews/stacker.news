import classNames from 'classnames'

export default function LoopVideo ({ src, width, height, className }) {
  return (
    <video width={width} height={height} loop autoPlay muted preload='auto' playsInline className={classNames('max-w-full', className)}>
      <source src={src} type='video/mp4' />
    </video>
  )
}
