import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 30, checkperiod: 30, deleteOnExpire: true });

export default async ({ query: { fiat } }, res) => {
  fiat ??= "USD";

  let price = cache.get(fiat);
  if (price) return res.status(200).json(price);

  const url = `https://api.coinbase.com/v2/prices/BTC-${fiat}/spot`;
  price = await fetch(url)
    .then((res) => res.json())
    .catch();
  cache.set(fiat, price);
  return res.status(200).json(price);
};
