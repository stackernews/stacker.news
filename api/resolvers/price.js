import NodeCache from "node-cache";

const cache = new NodeCache({
  stdTTL: 30,
  checkperiod: 30,
  deleteOnExpire: true,
});

async function getPrice(fiat) {
  fiat ??= 'USD';
  let price = cache.get(fiat);
  if (price) return price;

  const url = `https://api.coinbase.com/v2/prices/BTC-${fiat}/spot`;
  price = await fetch(url)
    .then((res) => res.json())
    .then((body) => parseFloat(body.data.amount))
    .catch((err) => {
      console.error(err);
      return -1;
    });
  cache.set(fiat, price);
  return price;
}

export default {
  Query: {
    price: async (parent, { fiatCurrency }, ctx) => {
      const price = await getPrice(fiatCurrency);
      return price;
    },
  },
};
