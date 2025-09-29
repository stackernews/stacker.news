import ModeStatusPlugin from './status'

export default function ModePlugins ({ switchModes = true }) {
  return (
    <>
      {switchModes && <ModeStatusPlugin />}
    </>
  )
}
