# attach lnbits

To test sending from an attached wallet, it's easiest to use [lnbits](https://lnbits.com/) hooked up to a [local lnd node](./local-lnd.md) in your regtest network.

This will attempt to walk you through setting up lnbits with docker and connecting it to your local lnd node.

🚨 this a dev guide. do not use this guide for real funds 🚨

From [this guide](https://docs.lnbits.org/guide/installation.html#option-3-docker):

## 1. pre-configuration

Create a directory for lnbits, get the sample environment file, and create a shared data directory for lnbits to use:

```bash
mkdir lnbits
cd lnbits
wget https://raw.githubusercontent.com/lnbits/lnbits/main/.env.example -O .env
mkdir data
```

## 2. configure

To configure lnbits to use a [local lnd node](./local-lnd.md) in your regtest network, go to [polar](https://lightningpolar.com/) and click on the LND node you want to use as a funding source. Then click on `Connect`.

In the `Connect` tab, click the `File paths` tab and copy the `TLS cert` and `Admin macaroon` files to the `data` directory you created earlier.

```bash
cp /path/to/tls.cert /path/to/admin.macaroon data/
```

Then, open the `.env` file you created and override the following values:

```bash
LNBITS_ADMIN_UI=true
LNBITS_BACKEND_WALLET_CLASS=LndWallet
LND_GRPC_ENDPOINT=host.docker.internal
LND_GRPC_PORT=${Port from the polar connect page}
LND_GRPC_CERT=data/tls.cert
LND_GRPC_MACAROON=data/admin.macaroon
```

## 2. Install and run lnbits

Pull the latest image:

```bash
docker pull lnbitsdocker/lnbits-legend
docker run --detach --publish 5001:5000 --name lnbits --volume ${PWD}/.env:/app/.env --volume ${PWD}/data/:/app/data lnbitsdocker/lnbits-legend
```

Note: we make lnbits available on the host's port 5001 here (on Mac, 5000 is used by AirPlay), but you can change that to whatever you want.

## 3. Accessing the admin wallet

By enabling the [Admin UI](https://docs.lnbits.org/guide/admin_ui.html), lnbits creates a so called super_user. Get this super_user id by running:

```bash
cat data/.super_user
```

Open your browser and go to `http://localhost:5001/wallet?usr=${super_user id from above}`. LNBits will redirect you to a default wallet we will use called `LNBits wallet`.

## 4. Fund the wallet

To fund `LNBits wallet`, click the `+` next the wallet balance. Enter the number of sats you want to credit the wallet and hit enter.

## 5. Attach the wallet to stackernews

Open up your local stackernews, go to `http://localhost:3000/settings/wallets` and click on `attach` in the `lnbits` card.

In the form, fill in `lnbits url` with `http://localhost:5001`.

Back in lnbits click on `API Docs` in the right pane. Copy the Admin key and paste it into the `admin key` field in the form.

Click `attach` and you should be good to go.

## Debugging

- you can view lnbits logs with `docker logs lnbits` or in `data/logs/` in the `data` directory you created earlier
- with the [Admin UI](https://docs.lnbits.org/guide/admin_ui.html), you can modify LNBits in the GUI by clicking `Server` in left pane