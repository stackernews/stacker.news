import { findAndReplace } from 'mdast-util-find-and-replace';

const urlRegex = new RegExp(
  '\\b(^|\\s)(?:https?:\\/\\/)?(?:www\\.)?(?:localhost|(?:[a-zA-Z0-9-]+\\.){1,}[a-zA-Z]{2,})(?::\\d+)?(?:\\/[-a-zA-Z0-9@:%_\\+.~#?&//=]*)?\\b',
  'gi'
)


export default function url(options) {
  return function transformer(tree) {
    findAndReplace(
      tree,
      [
        [urlRegex, replaceUrl]
      ],
      { ignore: ['link', 'linkReference'] }
    );
  }

  function replaceUrl(value, url, match) {
    const node = { type: 'text', value };

    return {
      type: 'link',
      title: null,
      url: value.trim(),
      children: [node]
    };
  }
}

