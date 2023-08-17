CREATE OR REPLACE VIEW zap_rank_constants AS
SELECT
5000.0 AS boost_per_vote,
1.2 AS vote_power,
1.3 AS vote_decay,
3.0 AS age_wait_hours,
0.5 AS comment_scaler,
1.2 AS boost_power,
2.6 AS boost_decay,
2100 AS row_limit;