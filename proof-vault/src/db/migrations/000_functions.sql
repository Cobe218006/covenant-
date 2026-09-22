-- Shared helper functions used by later migrations. Runs first (000_ prefix).

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Convenience read of the tenant context RLS policies key off. Returns NULL
-- (never an error) when app.current_tenant_id hasn't been set, so RLS
-- predicates fail closed (no tenant context => no rows) rather than throwing.
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
$$ LANGUAGE sql STABLE;
