LNbits' database is seeded with a superuser (see https://docs.lnbits.org/guide/admin_ui.html).

The following credentials were used:

- username: `stackernews`
- password: `stackernews`

To get access to the superuser, you need to visit the admin UI:

http://localhost:5001/wallet?usr=e46288268b67457399a5fca81809573e

After that, the cookies will be set to access this wallet:

http://localhost:5001/wallet?&wal=15ffe06c74cc4082a91f528d016d9028

Or simply copy the keys from here:

* admin key: `640cc7b031eb427c891eeaa4d9c34180`

* invoice key: `5deed7cd634e4306bb5e696f4a03cdac`

( These keys can be found under `Node URL, API keys and API docs`. )

To use the same URL to connect to LNbits in the browser and server during local development, `localhost:<port>` is mapped to `lnbits:5000` on the server.
