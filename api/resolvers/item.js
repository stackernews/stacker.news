import { UserInputError, AuthenticationError } from 'apollo-server-micro'
import { ensureProtocol, removeTracking } from '../../lib/url'
import serialize from './serial'
import { decodeCursor, LIMIT, nextCursorEncoded } from '../../lib/cursor'
import { getMetadata, metadataRuleSets } from 'page-metadata-parser'
import domino from 'domino'
import {
  BOOST_MIN, ITEM_SPAM_INTERVAL, MAX_POLL_NUM_CHOICES,
  MAX_TITLE_LENGTH, ITEM_FILTER_THRESHOLD, DONT_LIKE_THIS_COST
} from '../../lib/constants'
import { msatsToSats } from '../../lib/format'

async function comments (me, models, id, sort) {
  let orderBy
  switch (sort) {
    case 'top':
      orderBy = `ORDER BY ${await orderByNumerator(me, models)} DESC, "Item".msats DESC, "Item".id DESC`
      break
    case 'recent':
      orderBy = 'ORDER BY "Item".created_at DESC, "Item".msats DESC, "Item".id DESC'
      break
    default:
      orderBy = `ORDER BY ${await orderByNumerator(me, models)}/POWER(GREATEST(3, EXTRACT(EPOCH FROM (now_utc() - "Item".created_at))/3600), 1.3) DESC NULLS LAST, "Item".msats DESC, "Item".id DESC`
      break
  }

  const flat = await models.$queryRaw(
    `
        WITH RECURSIVE base AS (
          ${SELECT}, ARRAY[row_number() OVER (${orderBy}, "Item".path)] AS sort_path
          FROM "Item"
          WHERE "parentId" = $1
          ${await filterClause(me, models)}
        UNION ALL
          ${SELECT}, p.sort_path || row_number() OVER (${orderBy}, "Item".path)
          FROM base p
          JOIN "Item" ON "Item"."parentId" = p.id
          WHERE true
          ${await filterClause(me, models)})
        SELECT * FROM base ORDER BY sort_path`, Number(id))
  return nestComments(flat, id)[0]
}

export async function getItem (parent, { id }, { me, models }) {
  const [item] = await models.$queryRaw(`
  ${SELECT}
  FROM "Item"
  WHERE id = $1`,
    Number(id)
  );
  return item;
}

function topClause(within) {
  let interval = ' AND "Item".created_at >= $1 - INTERVAL ';
  switch (within) {
    case 'forever':
      interval = ''
      break
    case 'week':
      interval += "'7 days'"
      break
    case 'month':
      interval += "'1 month'"
      break
    case 'year':
      interval += "'1 year'"
      break
    default:
      interval += "'1 day'"
      break
  }
  return interval;
}

async function topOrderClause (sort, me, models) {
  switch (sort) {
    case 'comments':
      return 'ORDER BY ncomments DESC'
    case 'sats':
      return 'ORDER BY msats DESC'
    default:
      return await topOrderByWeightedSats(me, models)
  }
}

export async function orderByNumerator (me, models) {
  if (me) {
    const user = await models.user.findUnique({ where: { id: me.id } })
    if (user.wildWestMode) {
      return 'GREATEST("Item"."weightedVotes", POWER("Item"."weightedVotes", 1.2))'
    }
  }

  return `(CASE WHEN "Item"."weightedVotes" > "Item"."weightedDownVotes"
                THEN 1
                ELSE -1 END
          * GREATEST(ABS("Item"."weightedVotes" - "Item"."weightedDownVotes"), POWER(ABS("Item"."weightedVotes" - "Item"."weightedDownVotes"), 1.2)))`
}

export async function filterClause (me, models) {
  // by default don't include freebies unless they have upvotes
  let clause = ' AND (NOT "Item".freebie OR "Item"."weightedVotes" - "Item"."weightedDownVotes" > 0'
  if (me) {
    const user = await models.user.findUnique({ where: { id: me.id } })
    // wild west mode has everything
    if (user.wildWestMode) {
      return ''
    }
    // greeter mode includes freebies if feebies haven't been flagged
    if (user.greeterMode) {
      clause = 'AND (NOT "Item".freebie OR ("Item"."weightedVotes" - "Item"."weightedDownVotes" >= 0 AND "Item".freebie)'
    }

    // always include if it's mine
    clause += ` OR "Item"."userId" = ${me.id})`
  } else {
    // close default freebie clause
    clause += ')'
  }

  // if the item is above the threshold or is mine
  clause += ` AND ("Item"."weightedVotes" - "Item"."weightedDownVotes" > -${ITEM_FILTER_THRESHOLD}`
  if (me) {
    clause += ` OR "Item"."userId" = ${me.id}`
  }
  clause += ')'

  return clause
}

function recentClause (type) {
  switch (type) {
    case 'links':
      return ' AND url IS NOT NULL'
    case 'discussions':
      return ' AND url IS NULL AND bio = false AND "pollCost"  IS NULL'
    case 'polls':
      return ' AND "pollCost" IS NOT NULL'
    case 'bios':
      return ' AND bio = true'
    default:
      return ''
  }
}

export default {
  Query: {
    itemRepetition: async (parent, { parentId }, { me, models }) => {
      if (!me) return 0;
      // how many of the parents starting at parentId belong to me
      const [{ item_spam: count }] = await models.$queryRaw(
        `SELECT item_spam($1, $2, '${ITEM_SPAM_INTERVAL}')`,
        Number(parentId),
        Number(me.id)
      );

      return count;
    },
    topItems: async (parent, { cursor, sort, when }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      const items = await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE "parentId" IS NULL AND "Item".created_at <= $1
        AND "pinId" IS NULL
        ${topClause(when)}
        ${await filterClause(me, models)}
        ${await topOrderClause(sort, me, models)}
        OFFSET $2
        LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    },
    topComments: async (parent, { cursor, sort, when }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      const comments = await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE "parentId" IS NOT NULL
        AND "Item".created_at <= $1
        ${topClause(when)}
        ${await filterClause(me, models)}
        ${await topOrderClause(sort, me, models)}
        OFFSET $2
        LIMIT ${LIMIT}`, decodedCursor.time, decodedCursor.offset)
      return {
        cursor: comments.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        comments
      }
    },
    items: async (parent, { sub, sort, type, cursor, name, within }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      let items; let user; let pins; let subFull

      const subClause = (num) => {
        return sub
          ? ` AND "subName" = $${num} `
          : ` AND ("subName" IS NULL OR "subName" = $${num}) `;
      };

      const activeOrMine = () => {
        return me
          ? ` AND (status <> 'STOPPED' OR "userId" = ${me.id}) `
          : " AND status <> 'STOPPED' ";
      };

      switch (sort) {
        case "user":
          if (!name) {
            throw new UserInputError("must supply name", {
              argumentName: "name",
            });
          }

          user = await models.user.findUnique({ where: { name } });
          if (!user) {
            throw new UserInputError("no user has that name", {
              argumentName: "name",
            });
          }

          items = await models.$queryRaw(
            `
            ${SELECT}
            FROM "Item"
            WHERE "userId" = $1 AND "parentId" IS NULL AND created_at <= $2
            AND "pinId" IS NULL
            ${activeOrMine()}
            ${await filterClause(me, models)}
            ORDER BY created_at DESC
            OFFSET $3
            LIMIT ${LIMIT}`,
            user.id,
            decodedCursor.time,
            decodedCursor.offset
          );
          break;
        case "recent":
          items = await models.$queryRaw(
            `
            ${SELECT}
            FROM "Item"
            WHERE "parentId" IS NULL AND created_at <= $1
            ${subClause(3)}
            ${activeOrMine()}
            ${await filterClause(me, models)}
            ${recentClause(type)}
            ORDER BY created_at DESC
            OFFSET $2
            LIMIT ${LIMIT}`,
            decodedCursor.time,
            decodedCursor.offset,
            sub || "NULL"
          );
          break;
        case "top":
          items = await models.$queryRaw(
            `
            ${SELECT}
            FROM "Item"
            WHERE "parentId" IS NULL AND "Item".created_at <= $1
            AND "pinId" IS NULL
            ${topClause(within)}
            ${await filterClause(me, models)}
            ${await topOrderByWeightedSats(me, models)}
            OFFSET $2
            LIMIT ${LIMIT}`,
            decodedCursor.time,
            decodedCursor.offset
          );
          break;
        default:
          // sub so we know the default ranking
          if (sub) {
            subFull = await models.sub.findUnique({ where: { name: sub } });
          }

          switch (subFull?.rankingType) {
            case 'AUCTION':
              items = await models.$queryRaw(`
                SELECT *
                FROM (
                  (${SELECT}
                  FROM "Item"
                  WHERE "parentId" IS NULL AND created_at <= $1
                  AND "pinId" IS NULL
                  ${subClause(3)}
                  AND status = 'ACTIVE' AND "maxBid" > 0
                  ORDER BY "maxBid" DESC, created_at ASC)
                  UNION ALL
                  (${SELECT}
                  FROM "Item"
                  WHERE "parentId" IS NULL AND created_at <= $1
                  AND "pinId" IS NULL
                  ${subClause(3)}
                  AND ((status = 'ACTIVE' AND "maxBid" = 0) OR status = 'NOSATS')
                  ORDER BY created_at DESC)
                ) a
                OFFSET $2
                LIMIT ${LIMIT}`,
                decodedCursor.time,
                decodedCursor.offset,
                sub
              );
              break;
            default:
              // HACK we can speed hack the first hot page, by limiting our query to only
              // the most recently created items so that the tables doesn't have to
              // fully be computed
              // if the offset is 0, we limit our search to posts from the last week
              // if there are 21 items, return them ... if not do the unrestricted query
              // instead of doing this we should materialize a view ... but this is easier for now
              if (decodedCursor.offset === 0) {
                items = await models.$queryRaw(
                  `
                  ${SELECT}
                  FROM "Item"
                  WHERE "parentId" IS NULL AND "Item".created_at <= $1 AND "Item".created_at > $3
                  AND "pinId" IS NULL AND NOT bio
                  ${subClause(4)}
                  ${await filterClause(me, models)}
                  ${await newTimedOrderByWeightedSats(me, models, 1)}
                  OFFSET $2
                  LIMIT ${LIMIT}`,
                  decodedCursor.time,
                  decodedCursor.offset,
                  new Date(new Date().setDate(new Date().getDate() - 5)),
                  sub || "NULL"
                );
              }

              if (decodedCursor.offset !== 0 || items?.length < LIMIT) {
                items = await models.$queryRaw(
                  `
                  ${SELECT}
                  FROM "Item"
                  WHERE "parentId" IS NULL AND "Item".created_at <= $1
                  AND "pinId" IS NULL AND NOT bio
                  ${subClause(3)}
                  ${await filterClause(me, models)}
                  ${await newTimedOrderByWeightedSats(me, models, 1)}
                  OFFSET $2
                  LIMIT ${LIMIT}`,
                  decodedCursor.time,
                  decodedCursor.offset,
                  sub || "NULL"
                );
              }

              if (decodedCursor.offset === 0) {
                // get pins for the page and return those separately
                pins = await models.$queryRaw(`SELECT rank_filter.*
                  FROM (
                    ${SELECT},
                    rank() OVER (
                        PARTITION BY "pinId"
                        ORDER BY created_at DESC
                    )
                    FROM "Item"
                    WHERE "pinId" IS NOT NULL
                ) rank_filter WHERE RANK = 1`);
              }
              break;
          }
          break;
      }
      return {
        cursor:
          items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items,
        pins,
      };
    },
    allItems: async (parent, { cursor }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      const items = await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        ORDER BY created_at DESC
        OFFSET $1
        LIMIT ${LIMIT}`, decodedCursor.offset)
      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    },
    outlawedItems: async (parent, { cursor }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      const notMine = () => {
        return me ? ` AND "userId" <> ${me.id} ` : ''
      }

      const items = await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE "Item"."weightedVotes" - "Item"."weightedDownVotes" <= -${ITEM_FILTER_THRESHOLD}
        ${notMine()}
        ORDER BY created_at DESC
        OFFSET $1
        LIMIT ${LIMIT}`, decodedCursor.offset)
      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    },
    borderlandItems: async (parent, { cursor }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)
      const notMine = () => {
        return me ? ` AND "userId" <> ${me.id} ` : ''
      }

      const items = await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE "Item"."weightedVotes" - "Item"."weightedDownVotes" < 0
        AND "Item"."weightedVotes" - "Item"."weightedDownVotes" > -${ITEM_FILTER_THRESHOLD}
        ${notMine()}
        ORDER BY created_at DESC
        OFFSET $1
        LIMIT ${LIMIT}`, decodedCursor.offset)
      return {
        cursor: items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items
      }
    },
    freebieItems: async (parent, { cursor }, { me, models }) => {
      const decodedCursor = decodeCursor(cursor)

      const items = await models.$queryRaw(`
        ${SELECT}
        FROM "Item"
        WHERE "Item".freebie
        ORDER BY created_at DESC
        OFFSET $1
        LIMIT ${LIMIT}`,
        decodedCursor.offset
      );
      return {
        cursor:
          items.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        items,
      };
    },
    getBountiesByUser: async (parent, { id }, { models }) => {
      const items = await models.$queryRaw(
        `
        ${SELECT}
        FROM "Item"
        WHERE "userId" = $1
        AND "bounty" IS NOT NULL
        ORDER BY created_at DESC`,
        id
      );
      return items
    },
    getBountiesByUserName: async (parent, { name }, { models }) => {
      const user = await models.user.findUnique({ where: { name } });
      if (!user) {
        throw new UserInputError("user not found", {
          argumentName: "name",
        });
      }
      const items = await models.$queryRaw(
        `
        ${SELECT}
        FROM "Item"
        WHERE "userId" = $1
        AND "bounty" IS NOT NULL
        ORDER BY created_at DESC`,
        user.id
      );
      return items
    },
    moreFlatComments: async (
      parent,
      { cursor, name, sort, within },
      { me, models }
    ) => {
      const decodedCursor = decodeCursor(cursor);

      let comments, user;
      switch (sort) {
        case "recent":
          comments = await models.$queryRaw(
            `
            ${SELECT}
            FROM "Item"
            WHERE "parentId" IS NOT NULL AND created_at <= $1
            ${await filterClause(me, models)}
            ORDER BY created_at DESC
            OFFSET $2
            LIMIT ${LIMIT}`,
            decodedCursor.time,
            decodedCursor.offset
          );
          break;
        case "user":
          if (!name) {
            throw new UserInputError("must supply name", {
              argumentName: "name",
            });
          }

          user = await models.user.findUnique({ where: { name } });
          if (!user) {
            throw new UserInputError("no user has that name", {
              argumentName: "name",
            });
          }

          comments = await models.$queryRaw(
            `
            ${SELECT}
            FROM "Item"
            WHERE "userId" = $1 AND "parentId" IS NOT NULL
            AND created_at <= $2
            ${await filterClause(me, models)}
            ORDER BY created_at DESC
            OFFSET $3
            LIMIT ${LIMIT}`,
            user.id,
            decodedCursor.time,
            decodedCursor.offset
          );
          break;
        case "top":
          comments = await models.$queryRaw(
            `
          ${SELECT}
          FROM "Item"
          WHERE "parentId" IS NOT NULL
          AND "Item".created_at <= $1
          ${topClause(within)}
          ${await filterClause(me, models)}
          ${await topOrderByWeightedSats(me, models)}
          OFFSET $2
          LIMIT ${LIMIT}`,
            decodedCursor.time,
            decodedCursor.offset
          );
          break;
        default:
          throw new UserInputError("invalid sort type", {
            argumentName: "sort",
          });
      }

      return {
        cursor:
          comments.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        comments,
      };
    },
    item: getItem,
    pageTitle: async (parent, { url }, { models }) => {
      try {
        const response = await fetch(ensureProtocol(url), {
          redirect: "follow",
        });
        const html = await response.text();
        const doc = domino.createWindow(html).document;
        const metadata = getMetadata(doc, url, {
          title: metadataRuleSets.title,
        });
        return metadata?.title;
      } catch (e) {
        return null;
      }
    },
    dupes: async (parent, { url }, { models }) => {
      const urlObj = new URL(ensureProtocol(url));
      let uri = urlObj.hostname + urlObj.pathname;
      uri = uri.endsWith("/") ? uri.slice(0, -1) : uri;
      let similar = `(http(s)?://)?${uri}/?`;

      const whitelist = [
        "news.ycombinator.com/item",
        "bitcointalk.org/index.php",
      ];
      const youtube = ["www.youtube.com", "youtu.be"];
      if (whitelist.includes(uri)) {
        similar += `\\${urlObj.search}`;
      } else if (youtube.includes(urlObj.hostname)) {
        // extract id and create both links
        const matches = url.match(
          /(https?:\/\/)?((www\.)?(youtube(-nocookie)?|youtube.googleapis)\.com.*(v\/|v=|vi=|vi\/|e\/|embed\/|user\/.*\/u\/\d+\/)|youtu\.be\/)(?<id>[_0-9a-z-]+)/i
        );
        similar = `(http(s)?://)?(www.youtube.com/watch\\?v=${matches?.groups?.id}|youtu.be/${matches?.groups?.id})`;
      } else {
        similar += "((\\?|#)%)?";
      }

      return await models.$queryRaw(
        `
        ${SELECT}
        FROM "Item"
        WHERE url SIMILAR TO $1
        ORDER BY created_at DESC
        LIMIT 3`,
        similar
      );
    },
    comments: async (parent, { id, sort }, { me, models }) => {
      return comments(me, models, id, sort)
    },
    auctionPosition: async (parent, { id, sub, bid }, { models, me }) => {
      const createdAt = id ? (await getItem(parent, { id }, { models, me })).createdAt : new Date()
      let where
      if (bid > 0) {
        // if there's a bid
        // it's ACTIVE and has a larger bid than ours, or has an equal bid and is older
        // count items: (bid > ours.bid OR (bid = ours.bid AND create_at < ours.created_at)) AND status = 'ACTIVE'
        where = {
          status: 'ACTIVE',
          OR: [
            { maxBid: { gt: bid } },
            { maxBid: bid, createdAt: { lt: createdAt } }
          ]
        }
      } else {
        // else
        // it's an active with a bid gt ours, or its newer than ours and not STOPPED
        // count items: ((bid > ours.bid AND status = 'ACTIVE') OR (created_at > ours.created_at AND status <> 'STOPPED'))
        where = {
          OR: [
            { maxBid: { gt: 0 }, status: 'ACTIVE' },
            { createdAt: { gt: createdAt }, status: { not: 'STOPPED' } }
          ]
        }
      }

      where.subName = sub
      if (id) {
        where.id = { not: Number(id) }
      }

      return await models.item.count({ where }) + 1
    }
  },

  Mutation: {
    upsertLink: async (parent, args, { me, models }) => {
      const { id, ...data } = args
      data.url = ensureProtocol(data.url)
      data.url = removeTracking(data.url)

      if (id) {
        return await updateItem(parent, { id, data }, { me, models });
      } else {
        return await createItem(parent, data, { me, models });
      }
    },
    upsertDiscussion: async (parent, args, { me, models }) => {
      const { id, ...data } = args;

      if (id) {
        return await updateItem(parent, { id, data }, { me, models });
      } else {
        return await createItem(parent, data, { me, models });
      }
    },
    upsertBounty: async (parent, args, { me, models }) => {
      const { id, ...data } = args;
      if (id) {
        return await updateItem(parent, { id, data }, { me, models });
      } else {
        return await createItem(parent, data, { me, models });
      }
    },
    upsertPoll: async (
      parent,
      { id, forward, boost, title, text, options },
      { me, models }
    ) => {
      if (!me) {
        throw new AuthenticationError("you must be logged in");
      }

      if (boost && boost < BOOST_MIN) {
        throw new UserInputError(`boost must be at least ${BOOST_MIN}`, {
          argumentName: "boost",
        });
      }

      let fwdUser;
      if (forward) {
        fwdUser = await models.user.findUnique({ where: { name: forward } });
        if (!fwdUser) {
          throw new UserInputError("forward user does not exist", {
            argumentName: "forward",
          });
        }
      }

      if (id) {
        const optionCount = await models.pollOption.count({
          where: {
            itemId: Number(id),
          },
        });

        if (options.length + optionCount > MAX_POLL_NUM_CHOICES) {
          throw new UserInputError(
            `total choices must be <${MAX_POLL_NUM_CHOICES}`,
            { argumentName: "options" }
          );
        }

        const [item] = await serialize(models,
          models.$queryRaw(`${SELECT} FROM update_poll($1, $2, $3, $4, $5, $6) AS "Item"`,
            Number(id), title, text, Number(boost || 0), options, Number(fwdUser?.id)))

        return item
      } else {
        if (options.length < 2 || options.length > MAX_POLL_NUM_CHOICES) {
          throw new UserInputError(
            `choices must be >2 and <${MAX_POLL_NUM_CHOICES}`,
            { argumentName: "options" }
          );
        }

        const [item] = await serialize(models,
          models.$queryRaw(`${SELECT} FROM create_poll($1, $2, $3, $4, $5, $6, $7, '${ITEM_SPAM_INTERVAL}') AS "Item"`,
            title, text, 1, Number(boost || 0), Number(me.id), options, Number(fwdUser?.id)))

        await createMentions(item, models)

        item.comments = []
        return item
      }
    },
    upsertJob: async (
      parent,
      {
        id,
        sub,
        title,
        company,
        location,
        remote,
        text,
        url,
        maxBid,
        status,
        logo,
      },
      { me, models }
    ) => {
      if (!me) {
        throw new AuthenticationError("you must be logged in to create job");
      }

      const fullSub = await models.sub.findUnique({ where: { name: sub } });
      if (!fullSub) {
        throw new UserInputError("not a valid sub", { argumentName: "sub" });
      }

      if (maxBid < 0) {
        throw new UserInputError('bid must be at least 0', { argumentName: 'maxBid' })
      }

      if (!location && !remote) {
        throw new UserInputError("must specify location or remote", {
          argumentName: "location",
        });
      }

      location = location.toLowerCase() === 'remote' ? undefined : location

      let item
      if (id) {
        const old = await models.item.findUnique({ where: { id: Number(id) } })
        if (Number(old.userId) !== Number(me?.id)) {
          throw new AuthenticationError("item does not belong to you");
        }
        ([item] = await serialize(models,
          models.$queryRaw(
            `${SELECT} FROM update_job($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) AS "Item"`,
            Number(id), title, url, text, Number(maxBid), company, location, remote, Number(logo), status)))
      } else {
        ([item] = await serialize(models,
          models.$queryRaw(
            `${SELECT} FROM create_job($1, $2, $3, $4, $5, $6, $7, $8, $9) AS "Item"`,
            title, url, text, Number(me.id), Number(maxBid), company, location, remote, Number(logo))))
      }

      await createMentions(item, models)

      return item
    },
    createComment: async (parent, { text, parentId }, { me, models }) => {
      return await createItem(parent, { text, parentId }, { me, models });
    },
    updateComment: async (parent, { id, text }, { me, models }) => {
      return await updateItem(parent, { id, data: { text } }, { me, models });
    },
    pollVote: async (parent, { id }, { me, models }) => {
      if (!me) {
        throw new AuthenticationError("you must be logged in");
      }

      await serialize(
        models,
        models.$queryRaw(
          `${SELECT} FROM poll_vote($1, $2) AS "Item"`,
          Number(id),
          Number(me.id)
        )
      );

      return id;
    },
    act: async (parent, { id, sats }, { me, models }) => {
      // need to make sure we are logged in
      if (!me) {
        throw new AuthenticationError("you must be logged in");
      }

      if (sats <= 0) {
        throw new UserInputError("sats must be positive", {
          argumentName: "sats",
        });
      }

      // disallow self tips
      const [item] = await models.$queryRaw(
        `
      ${SELECT}
      FROM "Item"
      WHERE id = $1 AND "userId" = $2`,
        Number(id),
        me.id
      );
      if (item) {
        throw new UserInputError("cannot tip your self");
      }

      const [{ item_act: vote }] = await serialize(
        models,
        models.$queryRaw`SELECT item_act(${Number(id)}, ${
          me.id
        }, 'TIP', ${Number(sats)})`
      );

      return {
        vote,
        sats
      }
    },
    dontLikeThis: async (parent, { id }, { me, models }) => {
      // need to make sure we are logged in
      if (!me) {
        throw new AuthenticationError('you must be logged in')
      }

      // disallow self down votes
      const [item] = await models.$queryRaw(`
            ${SELECT}
            FROM "Item"
            WHERE id = $1 AND "userId" = $2`, Number(id), me.id)
      if (item) {
        throw new UserInputError('cannot downvote your self')
      }

      await serialize(models, models.$queryRaw`SELECT item_act(${Number(id)}, ${me.id}, 'DONT_LIKE_THIS', ${DONT_LIKE_THIS_COST})`)

      return true
    }
  },
  Item: {
    sats: async (item, args, { models }) => {
      return msatsToSats(item.msats)
    },
    commentSats: async (item, args, { models }) => {
      return msatsToSats(item.commentMsats)
    },
    isJob: async (item, args, { models }) => {
      return item.subName === 'jobs'
    },
    sub: async (item, args, { models }) => {
      if (!item.subName) {
        return null;
      }

      return await models.sub.findUnique({ where: { name: item.subName } });
    },
    position: async (item, args, { models }) => {
      if (!item.pinId) {
        return null;
      }

      const pin = await models.pin.findUnique({ where: { id: item.pinId } });
      if (!pin) {
        return null;
      }

      return pin.position;
    },
    prior: async (item, args, { models }) => {
      if (!item.pinId) {
        return null;
      }

      const prior = await models.item.findFirst({
        where: {
          pinId: item.pinId,
          createdAt: {
            lt: item.createdAt,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!prior) {
        return null;
      }

      return prior.id;
    },
    poll: async (item, args, { models, me }) => {
      if (!item.pollCost) {
        return null;
      }

      const options = await models.$queryRaw`
        SELECT "PollOption".id, option, count("PollVote"."userId") as count,
          coalesce(bool_or("PollVote"."userId" = ${me?.id}), 'f') as "meVoted"
        FROM "PollOption"
        LEFT JOIN "PollVote" on "PollVote"."pollOptionId" = "PollOption".id
        WHERE "PollOption"."itemId" = ${item.id}
        GROUP BY "PollOption".id
        ORDER BY "PollOption".id ASC
      `;
      const poll = {};
      poll.options = options;
      poll.meVoted = options.some((o) => o.meVoted);
      poll.count = options.reduce((t, o) => t + o.count, 0);

      return poll;
    },
    user: async (item, args, { models }) =>
      await models.user.findUnique({ where: { id: item.userId } }),
    fwdUser: async (item, args, { models }) => {
      if (!item.fwdUserId) {
        return null;
      }
      return await models.user.findUnique({ where: { id: item.fwdUserId } });
    },
    comments: async (item, args, { me, models }) => {
      if (item.comments) {
        return item.comments;
      }
      return comments(me, models, item.id, 'hot')
    },
    upvotes: async (item, args, { models }) => {
      const [{ count }] = await models.$queryRaw(`
        SELECT COUNT(DISTINCT "userId") as count
        FROM "ItemAct"
        WHERE act = 'TIP' AND "itemId" = $1`, Number(item.id))

      return count
    },
    boost: async (item, args, { models }) => {
      const { sum: { msats } } = await models.itemAct.aggregate({
        sum: {
          msats: true
        },
        where: {
          itemId: Number(item.id),
          act: "BOOST",
        },
      });

      return (msats && msatsToSats(msats)) || 0
    },
    wvotes: async (item) => {
      return item.weightedVotes - item.weightedDownVotes
    },
    meSats: async (item, args, { me, models }) => {
      if (!me) return 0;

      const { sum: { msats } } = await models.itemAct.aggregate({
        sum: {
          msats: true
        },
        where: {
          itemId: Number(item.id),
          userId: me.id,
          OR: [
            {
              act: "TIP",
            },
            {
              act: 'FEE'
            }
          ]
        }
      })

      return (msats && msatsToSats(msats)) || 0
    },
    bountyPaid: async (item, args, { models }) => {
      if (!item.bounty) {
        return null;
      }

      const paid = await models.$queryRaw`
      -- Sum up the sats and if they are greater than or equal to item.bounty than return true, else return false
      SELECT coalesce(sum("ItemAct"."msats"), 0) >= ${item.bounty} as "bountyPaid"
      FROM "ItemAct"
      INNER JOIN "Item" ON "ItemAct"."itemId" = "Item"."id"
      WHERE "ItemAct"."userId" = ${item.userId}
      AND "Item"."parentId" = ${item.id}
      `;

      return paid[0].bountyPaid;
    },
    bountyPaidTo: async (item, args, { models }) => {
      if (!item.bounty) {
        return null;
      }
    
      const paidTo = await models.$queryRaw`
      SELECT "Item"."id" as "itemId", coalesce(sum("ItemAct"."msats"), 0) as "totalMsats"
      FROM "ItemAct"
      INNER JOIN "Item" ON "ItemAct"."itemId" = "Item"."id"
      WHERE "ItemAct"."userId" = ${item.userId}
      AND "Item"."parentId" = ${item.id}
      GROUP BY "Item"."id"
      `;

      if (paidTo.length === 0) {
        return null;
      }

      return paidTo[0].itemId;
    },
    meDontLike: async (item, args, { me, models }) => {
      if (!me) return false

      const dontLike = await models.itemAct.findFirst({
        where: {
          itemId: Number(item.id),
          userId: me.id,
          act: 'DONT_LIKE_THIS'
        }
      })

      return !!dontLike
    },
    outlawed: async (item, args, { me, models }) => {
      if (me && Number(item.userId) === Number(me.id)) {
        return false
      }
      return item.weightedVotes - item.weightedDownVotes <= -ITEM_FILTER_THRESHOLD
    },
    mine: async (item, args, { me, models }) => {
      return me?.id === item.userId;
    },
    root: async (item, args, { models }) => {
      if (!item.parentId) {
        return null;
      }
      return (
        await models.$queryRaw(
          `
        ${SELECT}
        FROM "Item"
        WHERE id = (
          SELECT ltree2text(subltree(path, 0, 1))::integer
          FROM "Item"
          WHERE id = $1)`,
          Number(item.id)
        )
      )[0];
    },
    parent: async (item, args, { models }) => {
      if (!item.parentId) {
        return null;
      }
      return await models.item.findUnique({ where: { id: item.parentId } });
    },
  },
};

const namePattern = /\B@[\w_]+/gi;

export const createMentions = async (item, models) => {
  // if we miss a mention, in the rare circumstance there's some kind of
  // failure, it's not a big deal so we don't do it transactionally
  // ideally, we probably would
  if (!item.text) {
    return;
  }

  try {
    const mentions = item.text.match(namePattern)?.map((m) => m.slice(1));
    if (mentions?.length > 0) {
      const users = await models.user.findMany({
        where: {
          name: { in: mentions },
        },
      });

      users.forEach(async (user) => {
        const data = {
          itemId: item.id,
          userId: user.id,
        };

        await models.mention.upsert({
          where: {
            itemId_userId: data,
          },
          update: data,
          create: data,
        });
      });
    }
  } catch (e) {
    console.log("mention failure", e);
  }
};

export const updateItem = async (
  parent,
  { id, data: { title, url, text, boost, forward, bounty, parentId } },
  { me, models }
) => {
  // update iff this item belongs to me
  const old = await models.item.findUnique({ where: { id: Number(id) } });
  if (Number(old.userId) !== Number(me?.id)) {
    throw new AuthenticationError("item does not belong to you");
  }

  // if it's not the FAQ, not their bio, and older than 10 minutes
  const user = await models.user.findUnique({ where: { id: me.id } })
  if (![349, 76894, 78763, 81862].includes(old.id) && user.bioId !== id && Date.now() > new Date(old.createdAt).getTime() + 10 * 60000) {
    throw new UserInputError('item can no longer be editted')
  }

  if (boost && boost < BOOST_MIN) {
    throw new UserInputError(`boost must be at least ${BOOST_MIN}`, {
      argumentName: "boost",
    });
  }

  if (!old.parentId && title.length > MAX_TITLE_LENGTH) {
    throw new UserInputError("title too long");
  }

  let fwdUser;
  if (forward) {
    fwdUser = await models.user.findUnique({ where: { name: forward } });
    if (!fwdUser) {
      throw new UserInputError("forward user does not exist", {
        argumentName: "forward",
      });
    }
  }

  const [item] = await serialize(models,
    models.$queryRaw(
      `${SELECT} FROM update_item($1, $2, $3, $4, $5, $6, $7) AS "Item"`,
      Number(id), title, url, text, Number(boost || 0), Number(bounty || 0), Number(fwdUser?.id)))

  await createMentions(item, models)

  return item
}

export const createItem = async (parent, { title, url, text, boost, forward, parentId, bounty }, { me, models }) => {
  if (!me) {
    throw new AuthenticationError("you must be logged in");
  }
  
  if (boost && boost < BOOST_MIN) {
    throw new UserInputError(`boost must be at least ${BOOST_MIN}`, {
      argumentName: "boost",
    });
  }
  
  if (!parentId && title.length > MAX_TITLE_LENGTH) {
    throw new UserInputError("title too long");
  }
  
  let fwdUser;
  if (forward) {
    fwdUser = await models.user.findUnique({ where: { name: forward } });
    if (!fwdUser) {
      throw new UserInputError("forward user does not exist", {
        argumentName: "forward",
      });
    }
  }
  
  if (typeof bounty !== "undefined") {
    const [item] = await serialize(
      models,
      models.$queryRaw(
        `${SELECT} FROM create_item($1, $2, $3, $4, $5, $6, $7, $8, '${ITEM_SPAM_INTERVAL}') AS "Item"`,
        title,
        url,
        text,
        Number(boost || 0),
        Number(bounty || 0),
        Number(parentId),
        Number(me.id),
        Number(fwdUser?.id)
      )
    )

    await createMentions(item, models);

    item.comments = [];
    return item;
  }

  const [item] = await serialize(models,
    models.$queryRaw(
      `${SELECT} FROM create_item($1, $2, $3, $4, $5, $6, $7, '${ITEM_SPAM_INTERVAL}') AS "Item"`,
      title, url, text, Number(boost || 0), Number(parentId), Number(me.id),
      Number(fwdUser?.id)))

  await createMentions(item, models)

  item.comments = []
  return item
}

function nestComments (flat, parentId) {
  const result = []
  let added = 0
  for (let i = 0; i < flat.length;) {
    if (!flat[i].comments) flat[i].comments = []
    if (Number(flat[i].parentId) === Number(parentId)) {
      result.push(flat[i]);
      added++;
      i++;
    } else if (result.length > 0) {
      const item = result[result.length - 1];
      const [nested, newAdded] = nestComments(flat.slice(i), item.id);
      if (newAdded === 0) {
        break;
      }
      item.comments.push(...nested);
      i += newAdded;
      added += newAdded;
    } else {
      break;
    }
  }
  return [result, added];
}

// we have to do our own query because ltree is unsupported
export const SELECT = `SELECT "Item".id, "Item".created_at as "createdAt", "Item".updated_at as "updatedAt", "Item".title,
  "Item".text, "Item".url, "Item"."bounty", "Item"."userId", "Item"."fwdUserId", "Item"."parentId", "Item"."pinId", "Item"."maxBid",
  "Item".company, "Item".location, "Item".remote,
  "Item"."subName", "Item".status, "Item"."uploadId", "Item"."pollCost",
  "Item".msats, "Item".ncomments, "Item"."commentMsats", "Item"."lastCommentAt", "Item"."weightedVotes",
  "Item"."weightedDownVotes", "Item".freebie, ltree2text("Item"."path") AS "path"`

async function newTimedOrderByWeightedSats (me, models, num) {
  return `
    ORDER BY (${await orderByNumerator(me, models)}/POWER(GREATEST(3, EXTRACT(EPOCH FROM ($${num} - "Item".created_at))/3600), 1.3) +
              ("Item".boost/${BOOST_MIN}::float)/POWER(EXTRACT(EPOCH FROM ($${num} - "Item".created_at))/3600+2, 2.6)) DESC NULLS LAST, "Item".id DESC`
}

async function topOrderByWeightedSats (me, models) {
  return `ORDER BY ${await orderByNumerator(me, models)} DESC NULLS LAST, "Item".id DESC`
}
