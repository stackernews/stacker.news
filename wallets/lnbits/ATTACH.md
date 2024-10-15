For testing LNbits, you need to create a LNbits account first via the web interface.

By default, you can access it at `localhost:5001` (see `LNBITS_WEB_PORT` in .env.development).

After you created a wallet, you should find the invoice and admin key under `Node URL, API keys and API docs`.

> [!IMPORTANT]
>
> Since your browser is running on your host machine but the server is running inside a docker container, the server will not be able to reach LNbits with `localhost:5001` to create invoices. This makes it hard to test send+receive at the same time.
>
> For now, you need to patch the `_createInvoice` function in wallets/lnbits/server.js to always use `lnbits:5000` as the URL:
>
> ```diff
> diff --git a/wallets/lnbits/server.js b/wallets/lnbits/server.js
> index 39949775..e3605c45 100644
> --- a/wallets/lnbits/server.js
> +++ b/wallets/lnbits/server.js
> @@ -11,6 +11,7 @@ async function _createInvoice ({ url, invoiceKey, amount, expiry }, { me }) {
>    const memo = me.hideInvoiceDesc ? undefined : 'autowithdraw to LNbits from SN'
>    const body = JSON.stringify({ amount, unit: 'sat', expiry, memo, out: false })
>
> +  url = 'http://lnbits:5000'
>    const res = await fetch(url + path, { method: 'POST', headers, body })
>    if (!res.ok) {
>      const errBody = await res.json()
> ```
>
