// https://en.wikipedia.org/wiki/Normal_distribution#Quantile_function
// const z = 1.281551565545 // 80% confidence
// const z = 1.644853626951 // 90% confidence
// const z = 1.959963984540 // 95% confidence
const z = 3.090232306168 // 98% confidence

function confidence (s, n) {
  if (n === 0) {
    return 0
  }

  const p = s / n
  const left = p + 1 / (2 * n) * z * z
  const right = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
  const under = 1 + 1 / n * z * z

  return (left - right) / under
}

console.log(confidence(process.argv[2], process.argv[3]))

/*
  Need to describe how they'll earn
  If we trust upvotes how can we use that to determine the best
*/
