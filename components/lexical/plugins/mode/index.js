import ModeStatusPlugin from './status'
import SwitchPlugin from './switch'

export default function ModePlugins () {
  return (
    <>
      <SwitchPlugin />
      <ModeStatusPlugin />
    </>
  )
}
