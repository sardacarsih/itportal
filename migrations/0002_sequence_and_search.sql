CREATE FUNCTION next_portal_ticket_number() RETURNS text LANGUAGE plpgsql AS $$
DECLARE n text;
BEGIN
 n := nextval('ticket_number_seq')::text;
 RETURN 'IT-' || extract(year FROM now() AT TIME ZONE 'Asia/Jakarta')::text || '-' || CASE WHEN length(n)>=6 THEN n ELSE lpad(n,6,'0') END;
END $$;
ALTER TABLE tickets ALTER COLUMN number SET DEFAULT next_portal_ticket_number();
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX tickets_subject_trigram ON tickets USING gin(subject gin_trgm_ops);
CREATE INDEX tickets_number_trigram ON tickets USING gin(number gin_trgm_ops);
