-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_name_trgm_idx"
ON users USING GIN (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION search_users_by_name(search_q text, similarity_threshold real, result_limit integer)
RETURNS SETOF users
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM set_config('pg_trgm.similarity_threshold', similarity_threshold::text, true);

  RETURN QUERY
    SELECT u.*
    FROM users u
    WHERE (
      u.id > 615 OR u.id IN (27, 106)
    )
    AND u.name % search_q
    ORDER BY similarity(u.name, search_q) DESC, u.name ASC
    LIMIT result_limit;
END;
$function$;
