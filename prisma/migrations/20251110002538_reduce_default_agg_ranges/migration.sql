CREATE OR REPLACE FUNCTION refresh_agg_payin_hour(
    p_from timestamptz DEFAULT now() - interval '1 hours',
    p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
    SELECT refresh_agg_payin('hour', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_payin_day(
    p_from timestamptz DEFAULT now() - interval '1 days',
    p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
    SELECT refresh_agg_payin('day', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_payin_month(
    p_from timestamptz DEFAULT now() - interval '1 months',
    p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
    SELECT refresh_agg_payin('month', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_payout_hour(
  p_from timestamptz DEFAULT now() - interval '1 hours',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_payout('hour', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_payout_day(
  p_from timestamptz DEFAULT now() - interval '1 days',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_payout('day', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_payout_month(
  p_from timestamptz DEFAULT now() - interval '1 months',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_payout('month', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_registrations_hour(
  p_from timestamptz DEFAULT now() - interval '1 hours',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_registrations('hour', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_registrations_day(
  p_from timestamptz DEFAULT now() - interval '1 days',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_registrations('day', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_registrations_month(
  p_from timestamptz DEFAULT now() - interval '1 months',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_registrations('month', p_from, p_to);
$$;

-- Optional wrappers
CREATE OR REPLACE FUNCTION refresh_agg_rewards_hour(
  p_from timestamptz DEFAULT now() - interval '1 hours',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_rewards('hour', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_rewards_day(
  p_from timestamptz DEFAULT now() - interval '1 days',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_rewards('day', p_from, p_to);
$$;

CREATE OR REPLACE FUNCTION refresh_agg_rewards_month(
  p_from timestamptz DEFAULT now() - interval '1 months',
  p_to   timestamptz DEFAULT now()
) RETURNS void LANGUAGE sql AS $$
  SELECT refresh_agg_rewards('month', p_from, p_to);
$$;