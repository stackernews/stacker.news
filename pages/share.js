export function getServerSideProps ({ query }) {
  // used to redirect to appropriate post type if Web Share Target API was used
  const title = query.title
  const text = query.text
  let url = query.url
  // apps may share links as text
  if (text && /^https?:\/\//.test(text)) url = text

  let destination = '/post'
  if (url && title) {
    destination += `?type=link&url=${url}&title=${title}`
  } else if (title) {
    destination += `?type=discussion&title=${title}`
    if (text) destination += `&text=${text}`
  }

  return {
    redirect: {
      destination
    }
  }
}

export default () => null
