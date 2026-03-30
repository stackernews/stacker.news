import useDarkMode from '@/components/dark-mode'
import { walletDisplayName, walletImage } from '@/wallets/lib/util'

export function useWalletImage (name) {
  const [darkMode] = useDarkMode()

  const image = walletImage(name)
  if (!image) return null

  let src = typeof image === 'string' ? image : image.src
  const alt = typeof image === 'string' ? walletDisplayName(name) : image.alt
  const hasDarkMode = typeof image === 'string' ? true : image.darkMode

  if (darkMode && hasDarkMode === false) return null
  if (darkMode) src = src.replace(/\.([a-z]{3,4})$/, '-dark.$1')

  return { src, alt }
}
