export function shouldTrackNewComment ({ hasNavigator, viewerId, item }) {
  return Boolean(
    hasNavigator &&
    viewerId !== item.user?.id &&
    !item.user?.meMute
  )
}
