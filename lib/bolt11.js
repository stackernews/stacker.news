import { decode } from 'bolt11'

export function bolt11Tags (bolt11) {
  return decode(bolt11).tagsObject
}
