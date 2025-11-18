import { setMarkdown$, markdown$, realmPlugin } from '@mdxeditor/editor'

export const localDraftPlugin = realmPlugin({
  init (realm, params) {
    const storageKey = params?.storageKey
    if (!storageKey) return

    // subscribes (realm.sub) to the editor realm and updates the local storage
    // dev notes: markdown$ is the markdown value published by the editor realm
    realm.sub(markdown$, (md) => {
      console.log('localDraftPlugin: markdown$', md)
      const text = (md || '').trim()
      if (!text) {
        window.localStorage.removeItem(storageKey)
      } else {
        window.localStorage.setItem(storageKey, text)
      }
    })
  },
  postInit (realm, params) {
    const storageKey = params?.storageKey
    if (!storageKey) return

    const draft = window.localStorage.getItem(storageKey)
    if (draft) {
      console.log('localDraftPlugin: setting draft', draft)
      // publishes (realm.pub) the draft to the editor realm
      // dev notes: setMarkdown$ is the action to set the markdown value in the editor realm
      realm.pub(setMarkdown$, draft)
    }
  }
})
