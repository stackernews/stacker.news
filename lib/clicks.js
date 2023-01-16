export function ignoreClick (e) {
  return e.target.onclick || // the target has a click handler
    // the target has an interactive parent
    e.target.matches(':where(.upvoteParent, .pointer, form, textarea, button, a, input) :scope') ||
    // the target is an interactive element
    ['TEXTAREA', 'BUTTON', 'A', 'INPUT', 'FORM'].includes(e.target.tagName.toUpperCase()) ||
    // the target is an interactive element
    e.target.class === 'upvoteParent' || e.target.class === 'pointer'
}
