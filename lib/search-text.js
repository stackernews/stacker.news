import removeMd from 'remove-markdown'

export function pollOptionsText (pollOptions = []) {
  return pollOptions
    .map(option => typeof option === 'string' ? option : option?.option)
    .filter(Boolean)
    .join('\n')
}

export function searchableText (text, pollOptions = []) {
  return [
    text ? removeMd(text) : '',
    pollOptionsText(pollOptions)
  ].filter(Boolean).join('\n\n')
}

function normalizeRelatedText (text = '') {
  return typeof text === 'string' ? removeMd(text).trim() : ''
}

function joinTitleAndText (title = '', text = '') {
  const normalizedTitle = title.trim()
  const normalizedText = text.trim()
  if (normalizedTitle && normalizedText) return `${normalizedTitle}\n\n${normalizedText}`
  return normalizedTitle || normalizedText
}

export function buildRelatedSource ({ title, text, pollOptions }) {
  const normalizedTitle = title?.trim() || ''
  const normalizedText = [
    normalizeRelatedText(text),
    normalizeRelatedText(pollOptionsText(pollOptions))
  ].filter(Boolean).join('\n\n')

  return {
    title: normalizedTitle,
    hasBody: normalizedText.length > 0,
    textQuery: joinTitleAndText(normalizedTitle, normalizedText)
  }
}
