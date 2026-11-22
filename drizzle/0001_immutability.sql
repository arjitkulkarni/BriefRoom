-- Custom SQL migration file, put your code below! --
-- Database-level guarantees for the agreement engine.
-- 1. A proposed version's frozen content can never change (only its lifecycle status may).
-- 2. Versions and approvals are never deleted — not even by a cascading order delete.
-- 3. Approvals are append-only.

CREATE OR REPLACE FUNCTION briefroom_versions_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.snapshot IS DISTINCT FROM OLD.snapshot
     OR NEW.snapshot_hash IS DISTINCT FROM OLD.snapshot_hash
     OR NEW.hash_algorithm IS DISTINCT FROM OLD.hash_algorithm
     OR NEW.number IS DISTINCT FROM OLD.number
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.proposed_by_role IS DISTINCT FROM OLD.proposed_by_role
     OR NEW.note IS DISTINCT FROM OLD.note
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'brief version % is immutable; propose a new version instead', OLD.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.status = 'agreed' AND NEW.status IS DISTINCT FROM 'agreed' THEN
    RAISE EXCEPTION 'agreed brief version % cannot change status', OLD.id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER brief_versions_immutable
  BEFORE UPDATE ON brief_versions
  FOR EACH ROW EXECUTE FUNCTION briefroom_versions_immutable();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION briefroom_forbid_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% rows are permanent records and cannot be deleted', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER brief_versions_no_delete
  BEFORE DELETE ON brief_versions
  FOR EACH ROW EXECUTE FUNCTION briefroom_forbid_delete();
--> statement-breakpoint
CREATE TRIGGER approvals_no_delete
  BEFORE DELETE ON approvals
  FOR EACH ROW EXECUTE FUNCTION briefroom_forbid_delete();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION briefroom_approvals_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'approvals are append-only' USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER approvals_append_only
  BEFORE UPDATE ON approvals
  FOR EACH ROW EXECUTE FUNCTION briefroom_approvals_append_only();
