import { createImgproxySrc } from '@/lib/imgproxy'

// image sizes of an embed card, keep them in sync with components/embed-card.js and styles/text.css:
// 40px avatars, pictures as wide as the card (max-width: 550px)
export const embedAvatar = url => createImgproxySrc({ url, size: 40, resize: 'fill' })
export const embedPicture = url => createImgproxySrc({ url, size: 550 })
