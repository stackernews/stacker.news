// https://github.com/getAlby/js-sdk/blob/master/src/webln/NostrWeblnProvider.ts

export default {
  storageKey: 'webln:provider:nwc',
  _nwcUrl: null,
  enabled: false,
  async load () {
    const config = window.localStorage.getItem(this.storageKey)
    if (!config) return null
    const configJSON = JSON.parse(config)
    this._nwcUrl = configJSON.nwcUrl
    try {
      await this._updateEnabled()
    } catch (err) {
      console.error(err)
    }
    return configJSON
  },
  async save (config) {
    this._nwcUrl = config.nwcUrl
    await this._updateEnabled()
    window.localStorage.setItem(this.storageKey, JSON.stringify(config))
  },
  clear () {
    window.localStorage.removeItem(this.storageKey)
    this._nwcUrl = null
    this.enabled = false
  },
  async _updateEnabled () {
    // TODO: use proper check, for example relay connection
    this.enabled = !!this._nwcUrl
  }
}
