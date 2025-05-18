import useDarkMode from '@/components/dark-mode'
import { useCallback } from 'react'
import { walletNameToImage } from '@/wallets/json'

export function useWalletNameToImage (wallet) {
  const [darkMode] = useDarkMode()

  return useCallback((name) => {
    const image = walletNameToImage(name)
    if (!image) return null
    if (darkMode && image.darkMode === false) return null

    const src = darkMode ? image?.src.replace(/\.([a-z]{3})$/, '-dark.$1') : image?.src
    return { ...image, src }
  }, [darkMode])
}
