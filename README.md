# contributing
We pay sats for PRs. Sats will be proportional to the impact of the PR. If there's something you'd like to work on, suggest how much you'd do it for on the issue. If there's something you'd like to work on that isn't already an issue, whether its a bug fix or a new feature, create one.

# responsible disclosure

If you found a vulnerability, we would greatly appreciate it if you contact us via [kk@stacker.news](mailto:kk@stacker.news) or t.me/k00bideh.

# stacker.news
[Stacker News](https://stacker.news) is like Hacker News but we pay you Bitcoin. We use Bitcoin and the Lightning Network to provide Sybil resistance and any karma earned is withdrawable as Bitcoin.

# wen decentralization
We're experimenting with providing an SN-like service on nostr in [Outer Space](https://outer.space). It's our overarching goal to align SN with Bitcoin's ethos yet still make a product the average bitcoiner loves to use.

# local development
1. [Install docker-compose](https://docs.docker.com/compose/install/) and deps if you don't already have it installed
2. `git clone git@github.com:stackernews/stacker.news.git sn && cd sn`
3. `docker-compose up --build`

You should then be able to access the site at `localhost:3000` and any changes you make will hot reload. If you want to login locally or use lnd you'll need to modify `.env.sample` appropriately. More details [here](./docs/local-auth.md). If you have trouble please open an issue so I can help and update the README for everyone else.

# stack
The site is written in javascript using Next.js, a React framework. The backend API is provided via graphql. The database is postgresql modelled with prisma. The job queue is also maintained in postgresql. We use lnd for our lightning node. A customized Bootstrap theme is used for styling.

# processes
There are two. 1. the web app and 2. the worker, which dequeues jobs sent to it by the web app, e.g. polling lnd for invoice/payment status

# wallet transaction safety
To ensure user balances are kept sane, all wallet updates are run in serializable transactions at the database level. Because prisma has relatively poor support for transactions all wallet touching code is written in plpgsql stored procedures and can be found in the prisma/migrations folder.

# code
The code is linted with standardjs.

# license
[MIT](https://choosealicense.com/licenses/mit/)
