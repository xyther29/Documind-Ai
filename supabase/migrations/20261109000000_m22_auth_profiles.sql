-- DocuMind AI - Milestone 2.2 Phase 2: Supabase Auth Profiles Migration
-- Migration: 20261109000000_m22_auth_profiles.sql
-- Description: Creates public.profiles table, triggers for auto-provisioning and sync,
--              column-level access control, and strict Row Level Security (RLS).

-- ============================================================================
-- 1. Table: public.profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- Unique index on email
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

-- ============================================================================
-- 2. Functions & Triggers
-- ============================================================================

-- Function: update timestamp on row update
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = pg_catalog.now();
    RETURN NEW;
END;
$$;

-- Function: auto-provision profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data->>'display_name'), ''),
            pg_catalog.split_part(NEW.email, '@', 1)
        ),
        pg_catalog.now(),
        pg_catalog.now()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Function: sync email changes from auth.users
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.email IS DISTINCT FROM OLD.email THEN
        UPDATE public.profiles
        SET email = NEW.email,
            updated_at = pg_catalog.now()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

-- Triggers (Idempotent drops first)
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
    AFTER UPDATE OF email ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_email_change();

-- ============================================================================
-- 3. Function Ownership & Privileges
-- ============================================================================

ALTER FUNCTION public.handle_updated_at() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO postgres, service_role;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;

ALTER FUNCTION public.handle_user_email_change() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_user_email_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_user_email_change() TO postgres, service_role;

-- ============================================================================
-- 4. Table Ownership & Privileges (Column-Level Restrictions)
-- ============================================================================

ALTER TABLE public.profiles OWNER TO postgres;

-- Revoke all default table privileges
REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.profiles FROM anon;

-- Grant administrative access to postgres and service_role
GRANT ALL ON TABLE public.profiles TO postgres, service_role;

-- Authenticated users: SELECT allowed on all columns, UPDATE restricted strictly to display_name
-- (INSERT and DELETE are deliberately NOT granted to authenticated users)
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (display_name) ON TABLE public.profiles TO authenticated;

-- ============================================================================
-- 5. Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (((SELECT auth.uid()) = id));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (((SELECT auth.uid()) = id))
    WITH CHECK (((SELECT auth.uid()) = id));

DROP POLICY IF EXISTS "Deny direct profile insertion" ON public.profiles;
CREATE POLICY "Deny direct profile insertion"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct profile deletion" ON public.profiles;
CREATE POLICY "Deny direct profile deletion"
    ON public.profiles
    FOR DELETE
    TO authenticated
    USING (false);
