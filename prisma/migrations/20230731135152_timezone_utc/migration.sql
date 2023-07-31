-- prod is set to utc by default but dev might not be
CREATE OR REPLACE FUNCTION set_timezone_utc_currentdb()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    EXECUTE 'ALTER DATABASE '||current_database()||' SET TIMEZONE TO ''UTC''';
    return 0;
EXCEPTION WHEN OTHERS THEN
    return 0;
END;
$$;

SELECT set_timezone_utc_currentdb();