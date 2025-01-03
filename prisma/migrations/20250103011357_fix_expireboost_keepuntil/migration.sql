-- fix existing boost jobs
UPDATE pgboss.job
SET keepuntil = startafter + interval '10 days'
WHERE name = 'expireBoost' AND state = 'created';