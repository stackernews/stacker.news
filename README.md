# stacker.news
(Stacker News)[https://stacker.news] is a Lightning powered Bitcoin news site modelled after Hacker News (which is modelled after Reddit). The intent is to create a better place to discuss Bitcoin.

# stack
The site is written in javascript using Next.js, a React framework. The backend API is provided via graphql. The database is postgresql modelled with prisma. We use lnd for the lightning node which we connect to through a tor http tunnel. A customized Bootstrap theme is used for styling.

# processes
There are two. 1. the web app and 2. walletd, which checks and polls lnd for all pending invoice/withdrawl statuses in case the web process dies.

# wallet transaction safety
To ensure user balances are kept sane, all wallet updates are run in serializable transactions at the database level. Because prisma has relatively poor support for transactions all wallet touching code is written in plpgsql stored procedures and can be found in the prisma/migrations folder.

# code
The code is linted with standardjs.

# contributing
Pull requests are welcome. Please submit feature requests and bug reports through issues.

# license
[MIT](https://choosealicense.com/licenses/mit/)