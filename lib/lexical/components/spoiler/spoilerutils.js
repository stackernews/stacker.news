// from lexical playground
export function setDomHiddenUntilFound (dom) {
  dom.hidden = 'until-found'
}

export function domOnBeforeMatch (dom, callback) {
  dom.onbeforematch = callback
}
