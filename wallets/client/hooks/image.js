import useDarkMode from '@/components/dark-mode'
import { walletImage } from '@/wallets/client/util'

export function useWalletImage (name) {
  const [darkMode] = useDarkMode()

  const image = walletImage(name)
  if (!image) return null
  if (darkMode && image.darkMode === false) return null

  const src = darkMode ? image?.src.replace(/\.([a-z]{3})$/, '-dark.$1') : image?.src
  return { ...image, src }
}
