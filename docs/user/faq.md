---
title: Frequently Asked Questions
id: 349
sub: meta
---

# Stacker News FAQ

_To quickly browse through this FAQ page, click the chapters icon in the top-right corner. This will let you scroll through all chapters or search for a particular topic within this page._

last updated: February 7, 2025

---

## New Stackers Start Here

### What is Stacker News?

Stacker News is a forum similar to Reddit or Hacker News. Unlike on Reddit or Hacker News where you earn "upvotes" or "karma" that are not redeemable or transferable, on Stacker News you earn satoshis for creating and curating content.

### What are satoshis?

A satoshi is the smallest denomination of bitcoin. Just like there are 100 pennies in 1 dollar, there are 100,000,000 satoshis in 1 bitcoin. Satoshis are commonly abbreviated as "sats".

On Stacker News, all bitcoin payments are denominated in sats and use the Lightning Network.

### What are cowboy credits?

Stacker News never takes custody of stackers' money to send it to someone else.

To help new stackers get started without requiring them to [attach a lightning wallet](#how-do-i-attach-a-wallet), stackers without an attached wallet will earn cowboy credits (CCs) when other stackers zap their content. Stacker News will accept CCs instead of sats for any payment on the site at a 1:1 ratio. This means new stackers can use these earned CCs to pay for posts, comments, zaps, jobs, boosts, donations or even territories but cannot withdraw them.

If you need additional cowboy credits beyond what you've earned through zaps, you can always purchase them with sats at a 1:1 ratio [here](/credits).

### What are zaps?

Zaps are micropayments on the Lightning Network commonly used as tips.

### What are territories?

Every post on Stacker News belongs to a territory. Territories are communities where stackers gather to discuss shared interests and help them grow and thrive.

They are founded by stackers who pay us to receive the revenue they generate (some would call that a business model). Territories generate revenue because 70% of post, comment and boost fees and 21% of zaps go to the founder.

See the [section about territories](#territories) for details.

### Do I need bitcoin to use Stacker News?

No. Every new stacker can post or comment for free (with limited visibility) while they earn their first few CCs or sats. After a stacker has gained a balance, subsequent posts and comments will incur a small fee to prevent spam and to encourage quality contributions. Many stackers earn enough from their posts and comments to continue posting on the site indefinitely without ever buying CCs with sats.

[Post and comment fees vary depending on the territory](#why-does-it-cost-more-to-post-in-some-territories).

### How do I earn sats on Stacker News?

There are four ways to earn sats on Stacker News:

**1. Zaps**

To earn sats via [zaps](#zaps) from fellow stackers peer-to-peer, you need to [attach a wallet](#wallets) that can receive payments. Once you're setup, share interesting links, discussion prompts or simply engage with the community in comments. If another stacker finds value in what you shared and they also attached a wallet, you will receive real sats when they zap you.

**2. Daily rewards**

Stackers can also earn sats via daily rewards. Stacker News uses the revenue it generates from post, comment, zap and boost fees, the job board and donations to reward stackers that contributed to the site with even more sats beyond the zaps they already received. Contributions also include zapping content since they are used as a signal for ranking. **You do not need to attach a wallet to receive daily rewards in sats. They are automatically deposited into your account.** You can find and withdraw your reward sats balance [here](/credits).

**3. Referrals**

Another way to earn sats is via [referrals](/referrals/month). If a stacker signs up through one of your referral links, you will earn 10% of their rewards in perpetuity. A referral link is any link that ends with /r/\<your name\>. Additionally, if a stacker clicks your referral links more than anyone else's on a given day, you will also receive 10% of their rewards for that day.

Your posts, comments and profile are implicit referral links. They don't need to have the /r/\<your name\> suffix.

To make referring stackers easy, clicking on `...` next to a post or comment and selecting 'copy link' will copy it as a referral link by default. You can disable this in your [settings](/settings).

**4. Territories**

The last way to earn sats is by founding a territory since they generate revenue. However, this is not a recommended way to earn sats for new stackers since you need to pay for the territory in advance and it requires a lot of effort to just break even.

---

## Wallets

Stacker News is non-custodial. To send and receive sats, you need to attach a wallet. If you don't attach a wallet, you will send and receive [CCs](#what-are-cowboy-credits).

### How do I attach a wallet?

Click [here](/wallets) or click on your name and select 'wallets'. You should then see this:

![](https://m.stacker.news/75164)

We currently support the following wallets:

- [WebLN](https://www.webln.guide/ressources/webln-providers)
- [Blink](https://www.blink.sv/)
- [Core Lightning](https://docs.corelightning.org/) via [CLNRest](https://docs.corelightning.org/docs/rest)
- [Lightning Node Connect](https://docs.lightning.engineering/lightning-network-tools/lightning-terminal/lightning-node-connect) (LNC)
- [Lightning Network Daemon](https://github.com/lightningnetwork/lnd) (LND) via [gRPC](https://lightning.engineering/api-docs/api/lnd/)
- [LNbits](https://lnbits.com/)
- [Nostr Wallet Connect](https://nwc.dev/) (NWC)
- [lightning address](https://strike.me/learn/what-is-a-lightning-address/)
- [phoenixd](https://phoenix.acinq.co/server)

Click on the wallet you want to attach and complete the form.

### I can't find my wallet. Can I not attach one?

We currently don't list every wallet individually but [this is planned](https://github.com/stackernews/stacker.news/issues/1495).

If you can't find your wallet, there is still a high chance that you can attach one. Many wallets support Nostr Wallet Connect or provide lightning addresses. The following table shows how you can attach some common wallets:

| Wallet | Lightning Address | Nostr Wallet Connect |
| --- | --- | --- |
| [Strike](https://strike.me/) | ✅ | ❌ |
| [cashu.me](https://cashu.me/) | ✅ | ✅ |
| [Wallet of Satoshi](https://www.walletofsatoshi.com/) | ✅ | ❌ |
| [Zebedee](https://zbd.gg/) | ✅ | ❌ |
| [Coinos](https://coinos.io/) | ✅ | ✅ |

### What do the arrows mean?

Not every wallet supports both sending and receiving sats. For example, a lightning address can receive sats but not send them. This is indicated with an arrow to the bottom-left ↙️. A wallet that can send sats will have an arrow to the top-right ↗️.

If you still can't attach a wallet, you can reach out to us in the [saloon](/daily) or simply reply to this FAQ.

### I receive notifications about failed zaps. What do I do?

This means your wallet isn't working properly. You can retry the payment or check your [wallet logs](/wallets/logs) for errors. A retry usually works.

If the retry didn't work, you can't find an error or don't understand it, let us know in the [saloon](/daily) or reply to this FAQ.

The link to the wallet logs can be found on the [wallet page](/wallets).

### Why do I need to enter two strings for NWC?

For security reasons, we never store permissions to spend from your wallet on the server in plain text.

Since we however need to request invoices from your wallet when there is an incoming payment, we need to store the details to receive payments on the server in plaintext.

This means that the details for receiving cannot be mixed with the details for sending and is why we need two separate NWC strings for sending and receiving.

Other applications don't require two strings for one of the following reasons:

1. they only use NWC for sending but not for receiving
2. you can only receive while you are logged in
3. they (irresponsibly) store permissions to spend in plaintext on their server

### Why is my wallet not showing up on another device?

By default, permissions to spend from your wallet are only stored on your device.

However, you can enable [device sync](/settings/passphrase) in your settings to securely sync your wallets across devices. Once enabled, your wallets will show up on all devices you entered your passphrase.

### I have a wallet attached but I still receive CCs. Why?

This can happen for any of the following reasons:

1. The sender did not have a wallet attached
2. Sender's dust limit was too high for the outgoing zap amount ('send credits for zaps below' in [settings](/settings))
3. Your dust limit was too high for the incoming zap amount ('receive credits for zaps and deposits below' in [settings](/settings))
3. Sender's wallet was not able to pay
4. Routing the payment to you was too expensive for the zap amount (3% are reserved for network fees)
5. The zap was forwarded to you

### I have a wallet attached but I still send CCs. Why?

This can happen for any of the following reasons:

1. The receiver did not have a wallet attached
2. Your dust limit was too high for the outgoing zap amount ('send credits for zaps below' in [settings](/settings))
3. Receiver's dust limit was too high for the incoming zap amount ('receive credits for zaps and deposits below' in [settings](/settings))
4. Your wallet was not able to pay
5. Routing the payment to the sender was too expensive for the zap amount (3% are reserved for network fees)
6. The zap was forwarded to the receiver

### I don't want to receive CCs. How do I disable them?

You cannot disable receiving CCs but we might change that in the future. For now, you can donate any CCs you received [here](/rewards).

---

## Territories

Territories are communities on Stacker News. Each territory has a founder who acts as a steward of the community, and anyone can post content to the territory that best fits the topic of their post.

When Stacker News first launched without territories, much of the discussion focused exclusively on Bitcoin. However, since territories have been introduced, anyone can now create a thriving community on Stacker News to discuss any topic.

### How do I found a territory?

Click [here](/territory) or scroll to the bottom in the territory dropdown menu and click on 'create'.

### How much does it cost to found a territory?

Founding a territory costs either 50k sats/month, 500k sats/year, or 3m sats as a one-time payment.

If a territory founder chooses either the monthly or yearly payment options, they can select 'auto-renew' so that Stacker News is automatically paid the territory fee each month or year from your CC balance. If a territory founder doesn't select 'auto-renew' or they don't have enough CCs, they will get a notification to pay an invoice within 5 days after the end of their current billing period to keep their territory.

If you later change your mind, your payment for the current period is included in the new cost. This means that if you go from monthly to yearly payments for example, we will charge you 450k instead of 500k sats.

### Do I earn sats from territories?

Yes. Territory founders earn 70% of all posting and boost fees as well as 21% of all sats zapped within their territory. These earnings are paid out at the end of each day. You will receive a notification and you can withdraw your sats at any time [here](/credits).

The remaining 30% of posting and boost fees and 9% of zapped sats go to the Stacker News daily rewards pool, which rewards the best contributors each day.

### Why does it cost more to post in some territories?

Territory founders set the fees for posts and comments in their territories.

Additionally, fees increase by 10x for repetitive posts and self-reply comments to prevent spam.

As an example, if it costs 10 sats for a stacker to make a post in a territory, it will cost 100 sats if they make a second post within 10 minutes of their first post. If they post a third time within 10 minutes of their first one, it will cost 1,000 sats.

This 10x fee escalation continues until 10 minutes have elapsed, and will reset to a fee of 10 sats when the stacker goes 10 minutes or more without posting or replying to themselves in a comment thread.

This 10 minute fee escalation rule does not apply to stackers who are replying to other stackers, only those who repetitively post or reply to themselves within a single thread.

### Are media uploads free?

Your first 250 MB within 24 hours are free. After that, the following fees apply:

| uploaded within 24 hours | cost per upload |
| -------------------------| --------------- |
| up to 250 MB             | 0 sats          |
| 250-500 MB               | 10 sats         |
| 500-1 GB                 | 100 sats        |
| more than 1GB            | 1,000 sats      |

After 24 hours, you can upload 250 MB for free again.

Uploads without being logged in always cost 100 sats.

Upload fees are applied when you submit your post or comment.

### Are media uploads stored forever?

Yes, if it was used in a post or comment. **Uploads that haven't been used within 24 hours in a post or comment are deleted.**

### I no longer want to pay for my territory. What should I do?

Make sure 'auto-renew' is disabled in your territory settings. After that, simply ignore the new bill at the end of your current billing period.

After the grace period of 5 days, the territory will be archived. Stackers can still see archived posts and comments, but they will not be able to create new posts or comments until someone pays for that territory again.

### How do I bring back a territory?

Enter the name of the territory you want to bring back in the [territory form](/territory). If the territory indeed existed before, you will see a hint below the input field like this:

![](https://m.stacker.news/76254)

The info text mentions that you will inherit all existing content.

Other than that, the process to bring back an archived territory is the same as founding a new territory.

### I want to share the costs and revenue of a territory with someone. How do I do that?

You can't do that yet but this is planned. Currently, territories can only have a single founder.

### What do the territory stats in my profile mean?

![](https://m.stacker.news/76546)

The stats for each territory are the following:

- stacked: how many sats stackers stacked in this territory without the 30% sybil fee
- revenue: how much revenue went to the founder
- spent: how many sats have been spent in this territory on posts, comments, boosts, zaps, downzaps, jobs and poll votes
- posts: the total number of posts in the territory
- comments: the total number of comments in the territory

You can filter the same stats by different periods in [top territories](/top/territories/day).

---

## Zaps

### How do I zap on Stacker News?

To send a zap, click the lightning bolt next to a post or comment. Each click will automatically send your default zap amount to the creator of the post or comment. You can zap a post or comment an unlimited number of times.

### How do I change my default zap amount?

You can change your default zap amount in your [settings](/settings).

### How do I zap a custom amount?

To send a custom zap amount, long-press on the lightning bolt next to a post or comment until a textbox appears. Then type the number of sats you’d like to zap, and click 'zap'.

Your last five custom amounts are saved so you can quickly zap the same amount again.

### Do zaps help content rank higher?

Yes. The ranking of an item is affected by:

- the amount stackers zapped a post or comment
- the trust of the zappers
- the time elapsed since the creation of the item

Zapping an item with more sats gives you more influence on an item's ranking. However, the relationship between sats contributed and a stacker's influence on item ranking is not linear, it's logarithmic: the effect a stacker's zap has on an item's ranking is `trust*log10(total zap amount)`. This basically means that 10 sats equal 1 vote, 100 sats 2, 1000 sats 3, and so on ... all values in between and above 0 are valid as well.

To make this feature sybil-resistant, SN takes 30% of zaps and re-distributes them to territory founders and the SN community as part of the daily rewards.

### Why should I zap?

There are four reasons to zap posts on Stacker News:

1. To influence the ranking of content on the site

Every post and comment is ranked based on the number of people who zapped it and the trust level of each zapping stacker. More zaps from more trusted stackers means more people will see a particular piece of content.

2. To acknowledge the value of the content other people create (value for value)

Sending someone a like or an upvote incurs no cost to you, and therefore these metrics can easily be gamed by bots. Sending someone sats incurs a direct cost to you, which gives the recipient a meaningful reward and acts as a clear signal that you found a particular piece of content to be valuable.

3. To earn trust for identifying good content

On Stacker News, new stackers start with zero trust and either earn trust by zapping good content or lose trust by zapping bad content. Good and bad content is determined by overall consensus based on zaps.

4. To earn sats from the daily rewards pool

You can earn sats from the daily rewards pool by zapping content that ends up performing well. The amount you receive is proportional to your trust, the amount of sats you zapped and how early you zapped compared to others.

### Can I donate sats to Stacker News?

Yes. Every day, Stacker News distributes the revenue it collects from job listings, posting fees, boosts, and donations back to the stackers who made the best contributions on a given day.

To donate sats directly to the Stacker News rewards pool, or to view the rewards that will be distributed to stackers tomorrow, click [here](/rewards).

### Someone zapped me 100 sats but I only received 70 sats. Why?

SN takes 30% of zaps and re-distributes them to territory founders (21%) and the SN community as part of the daily rewards (9%).

So this means if someone zaps your post or comment 100 sats, 70 sats go to you, 21 sats go to the territory founder and the remaining 9 sats are distributed as part of the daily rewards.

### Is there an equivalent to downvotes?

Yes. If you see content that you think should not be on Stacker News, you can click the `...` next to the post or comment and select 'downzap'. You can then enter a custom amount to downzap the content.

Downzapping content is a form of negative feedback that reduces the visibility of the specific item for all stackers who don't have Wild West mode enabled in their [settings](/settings). If Wild West mode is not enabled, you are in Tenderfoot mode which is the default mode.

If an item gets flagged by stackers with enough combined trust, it is outlawed and hidden from view for stackers on Tenderfoot mode. If you wish to see this flagged content without any modifications, you can enable Wild West mode in your settings.

### What are turbo zaps?

Turbo zaps are an opt-in feature. They are a convenient way to modify your zap amounts on the go, rather than relying on a single default amount or a long-press of the lightning bolt for all your zapping.

When enabled in your [settings](/settings), every lightning bolt click on a specific post or comment raises your **total zap amount** to the next 10x of your default zap amount. For example, if your default zap amount is 1 sat:

- your first click: zap 1 sat for a total of 1 sat
- your second click: zap additional 9 sats for a total of 10 sats
- your third click: zap additional 90 sats for a total of 100 sats
- your fourth click: zap additional 900 sats for a total of 1000 sats
- and so on ...

Turbo zaps only escalate your zapping amount when you repeatedly click on the lightning bolt of a specific post or comment. Zapping a new post or comment will once again start at your default zap amount, and escalate by 10x with every additional click.

### What are random zaps?

Instead of zapping the same default amount on each press, the 'random zaps' [setting](/settings) allows you to select a range from which the zap amount will be randomly chosen on each press. This leads to greater privacy and a more fun zapping experience.

### I accidentally zapped too much! Can I prevent this from happening again?

Yes, you can enable zap undos in your [settings](/settings). Once enabled, any zap above your specified threshold will make the bolt pulse for 5 seconds. Clicking the bolt again while it's pulsing will undo the zap.

_In case you wonder how we can undo zaps when lightning transactions are final: it's because we don't actually "undo zaps". We simply delay the zap to give you a chance to abort it. We make them look like undos for UX reasons._

---

## Web of Trust

Stacker News relies on a [Web of Trust](https://en.wikipedia.org/wiki/Web_of_trust) between stackers to drive ranking and daily rewards.

### How does the Web of Trust work?

There are two trust scores: trust scores between stackers and global trust scores (trust scores assigned to individual stackers).

New accounts start without any trust and over time earn trust from other stackers by zapping content before them.

The only consideration that factors into a stacker's trust level is whether or not they are zapping good content. Zap amounts do not impact stackers' trust scores.

In addition, stackers do not lose or gain trust for making posts or comments. Instead, the post and comment fees are the mechanism that incentivizes stackers to only make high quality posts and comments.

A stacker’s trust is an important factor in determining how much influence their zaps have on the ranking of content, and how much they earn from the daily sat reward pool paid to zappers.

The trust scores are computed daily based on the zapping activity of stackers.

Your global trust score is basically how much stackers trust you on average.

### Can I see my trust scores?

No. All trust scores are private. We might make them public in the future but for now, they are kept private to protect the integrity of ranking and rewards.

### Is my feed personalized?

Yes. If someone zapped a post or comment before you, your trust in them to show you content you like increases. This means content that these early zappers zapped will rank higher in your feed.

A common misconception is that we show you more content of the stackers you zapped. This is not the case. Think of it this way: if you and a friend like the same band, you would ask that friend to show you more similar music and not ask the band to never change their music and produce more of it.

---

## Other FAQs

### Where should I submit feature requests?

Ideally on Github [here](https://github.com/stackernews/stacker.news/issues/new?template=feature_request.yml). The more background you give on your feature request the better. The hardest part of developing a feature is understanding the problem it solves, all the things that can wrong, etc.

### Will Stacker News pay for contributions?

Yes, we pay sats for PRs. See the section about contributing in our [README](https://github.com/stackernews/stacker.news?tab=readme-ov-file#contributing) for the details.

### Where should I submit bug reports?

You can submit bug reports on Github [here](https://github.com/stackernews/stacker.news/issues/new?template=bug_report.yml).

If you found a security or privacy issue, please consider a [responsible disclosure](#how-to-do-a-responsible-disclosure).

### How to do a responsible disclosure?

If you found a vulnerability on Stacker News, we would greatly appreciate it if you report it on Github [here](https://github.com/stackernews/stacker.news/security/advisories/new).

You can also contact us via security@stacker.news or [t.me/k00bideh](https://t.me/k00bideh). Our PGP key can be found [here](/pgp.txt).

### Where can I ask more questions?

Reply to this FAQ. It's like any other post on the site.
