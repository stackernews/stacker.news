import { findAndReplace } from 'mdast-util-find-and-replace';

const emailRegex = new RegExp(
  '(^|\\s)(?!@)[\\w\\-\\.]+@([\\w-]+\\.)+[\\w-]{2,}',
  'gi'
);

export default function email(options) {
  return function transformer(tree) {
    findAndReplace(
      tree,
      [
        [emailRegex, replaceEmail]
      ],
      { ignore: ['link', 'linkReference'] }
    );
  }

  function replaceEmail(value, emailAddress, match) {
    const node = { type: 'text', value };
    return {
      type: 'link',
      title: null,
      url: 'mailto:' + value.trim(),
      children: [node]
    };
  }
}
