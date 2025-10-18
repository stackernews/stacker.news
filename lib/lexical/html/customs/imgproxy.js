export function addSrcSetToMediaAndVideoNodes (doc, imgproxyUrls, topLevel) {
  const body = doc.body

  body.querySelectorAll('img[src]').forEach(img => {
    const src = img.getAttribute('src')
    const srcSetInitial = imgproxyUrls?.[src]
    const { dimensions, video, format, ...srcSetObj } = srcSetInitial || {}
    if (srcSetObj && Object.keys(srcSetObj).length > 0) {
      // srcSetObj shape: { [widthDescriptor]: <imgproxyUrl>, ... }
      const srcSet = Object.entries(srcSetObj).reduce((acc, [wDescriptor, url], i, arr) => {
        console.log('url', url)
        console.log('wDescriptor', wDescriptor)
        // backwards compatibility: we used to replace image urls with imgproxy urls rather just storing paths
        if (!url.startsWith('http')) {
          url = new URL(url, process.env.NEXT_PUBLIC_IMGPROXY_URL).toString()
        }
        return acc + `${url} ${wDescriptor}` + (i < arr.length - 1 ? ', ' : '')
      }, '')
      img.setAttribute('srcset', srcSet)
      img.setAttribute('sizes', topLevel ? '100vw' : '66vw')
    }
  })

  body.querySelectorAll('video[src]').forEach(videoEl => {
    const src = videoEl.getAttribute('src')
    const srcSetInitial = imgproxyUrls?.[src]
    const { dimensions, video, format, ...srcSetObj } = srcSetInitial || {}
    if (srcSetObj && Object.keys(srcSetObj).length > 0) {
      const bestResSrc = Object.entries(srcSetObj).reduce((acc, [wDescriptor, url]) => {
        if (!url.startsWith('http')) {
          url = new URL(url, process.env.NEXT_PUBLIC_IMGPROXY_URL).toString()
        }
        const w = Number(wDescriptor.replace(/w$/, ''))
        return w > acc.w ? { w, url } : acc
      }, { w: 0, url: undefined }).url
      videoEl.setAttribute('poster', bestResSrc !== src ? bestResSrc : undefined)
      videoEl.setAttribute('preload', bestResSrc !== src ? 'metadata' : undefined)
    }
  })
}
