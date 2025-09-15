import styles from './theme.module.css'

const theme = {
  paragraph: styles.paragraph,
  quote: styles.quote,
  heading: {
    h1: styles.heading1,
    h2: styles.heading2,
    h3: styles.heading3,
    h4: styles.heading4,
    h5: styles.heading5,
    h6: styles.heading6
  },
  image: styles.image,
  link: styles.link,
  code: styles.code,
  list: {
    nested: {
      listitem: styles.nestedListItem
    },
    ol: styles.listOl,
    ul: styles.listUl,
    listitem: styles.listItem
  },
  text: {
    bold: styles.textBold,
    italic: styles.textItalic,
    // overflowed: 'editor-text-overflowed',
    // hashtag: 'editor-text-hashtag',
    underline: styles.textUnderline,
    strikethrough: styles.textStrikethrough,
    underlineStrikethrough: styles.underlineStrikethrough,
    code: styles.textCode
  }
}

export default theme
