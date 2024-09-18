CREATE OR REPLACE VIEW zap_rank_personal_constants AS
SELECT
10000.0 AS boost_per_vote,
1.2 AS vote_power,
1.3 AS vote_decay,
3.0 AS age_wait_hours,
0.5 AS comment_scaler,
1.2 AS boost_power,
1.6 AS boost_decay,
616 AS global_viewer_id,
interval '7 days' AS item_age_bound,
interval '7 days' AS user_last_seen_bound,
0.9 AS max_personal_viewer_vote_ratio,
0.1 AS min_viewer_votes;