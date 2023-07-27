-- multiple create_polls
DROP FUNCTION IF EXISTS create_poll(title text, poll_cost integer, boost integer, user_id integer, options text[]);
DROP FUNCTION IF EXISTS create_poll(title text, text text, poll_cost integer, boost integer, user_id integer, options text[]);

-- multiple create_items
DROP FUNCTION IF EXISTS create_item(title text, url text, text text, boost integer, parent_id integer, user_id integer);
DROP FUNCTION IF EXISTS create_item(title text, url text, text text, boost integer, parent_id integer, user_id integer, fwd_user_id integer, spam_within interval);

-- multiple earn
DROP FUNCTION IF EXISTS earn(user_id integer, earn_msats int);

-- multiple run_auction
DROP FUNCTION IF EXISTS run_auction(item_id integer, bid integer);

-- multiple update_items
DROP FUNCTION IF EXISTS update_item(item_id integer, item_title text, item_url text, item_text text, boost integer, fwd_user_id integer);

-- multiple update_polls
DROP FUNCTION IF EXISTS update_poll(id integer, title text, text text, boost integer, options text[], fwd_user_id integer);

-- unused vote
DROP FUNCTION IF EXISTS vote(item_id integer, username text, vote_sats integer);