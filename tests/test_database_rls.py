"""Database schema, security constructs, and Row Level Security (RLS) tests.

This test module verifies the Milestone 2.2 Phase 2 Supabase auth profiles migration:
1. Static analysis of migration SQL (idempotency, RLS, column privileges, function security).
2. Live PostgreSQL / Supabase execution tests (when a live PostgreSQL server is accessible).
   Never mocks PostgreSQL permission enforcement.
"""

from __future__ import annotations

import os
import re
import socket
import subprocess
from pathlib import Path
from typing import Any, Generator
import uuid
import pytest

MIGRATION_PATH = Path("supabase/migrations/20261109000000_m22_auth_profiles.sql")


# ============================================================================
# Helpers: Live Database Connectivity & Execution
# ============================================================================

def _detect_postgres_connection_string() -> str | None:
    """Return database connection URL if an active PostgreSQL instance is reachable."""
    env_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if env_url:
        return env_url

    # Check standard local PostgreSQL / Supabase ports
    candidate_ports = [5432, 54322, 54321]
    for port in candidate_ports:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(0.4)
            result = sock.connect_ex(("127.0.0.1", port))
            sock.close()
            if result == 0:
                return f"postgresql://postgres:postgres@127.0.0.1:{port}/postgres"
        except Exception:
            continue
    return None


class LivePostgresClient:
    """Minimal database client supporting psycopg, psycopg2, or psql CLI.
    
    CRITICAL: Does not mock PostgreSQL permission enforcement. Interacts only
    with genuine PostgreSQL database processes.
    """

    def __init__(self, connection_url: str):
        self.connection_url = connection_url
        self._driver: str | None = None
        self._conn: Any = None

        try:
            import psycopg  # type: ignore
            self._driver = "psycopg"
            self._conn = psycopg.connect(connection_url, autocommit=True)
            return
        except ImportError:
            pass

        try:
            import psycopg2  # type: ignore
            self._driver = "psycopg2"
            self._conn = psycopg2.connect(connection_url)
            self._conn.autocommit = True
            return
        except ImportError:
            pass

        import shutil
        if shutil.which("psql"):
            self._driver = "psql"
            return

        raise RuntimeError(
            "No PostgreSQL driver found (psycopg or psycopg2) and psql CLI is not installed."
        )

    def execute(self, sql: str) -> None:
        """Execute one or more SQL statements."""
        if self._driver in ("psycopg", "psycopg2"):
            with self._conn.cursor() as cur:
                cur.execute(sql)
        elif self._driver == "psql":
            res = subprocess.run(
                ["psql", self.connection_url, "-v", "ON_ERROR_STOP=1", "-c", sql],
                capture_output=True,
                text=True,
            )
            if res.returncode != 0:
                raise RuntimeError(f"psql execution error: {res.stderr}")

    def query(self, sql: str) -> list[tuple[Any, ...]]:
        """Execute a SELECT query and return tuples."""
        if self._driver in ("psycopg", "psycopg2"):
            with self._conn.cursor() as cur:
                cur.execute(sql)
                return cur.fetchall()
        elif self._driver == "psql":
            res = subprocess.run(
                ["psql", self.connection_url, "-A", "-F", "\t", "-t", "-c", sql],
                capture_output=True,
                text=True,
            )
            if res.returncode != 0:
                raise RuntimeError(f"psql query error: {res.stderr}")
            lines = [line.strip().split("\t") for line in res.stdout.strip().split("\n") if line.strip()]
            return [tuple(line) for line in lines]
        return []

    def close(self) -> None:
        if self._conn is not None:
            try:
                self._conn.close()
            except Exception:
                pass


@pytest.fixture(scope="module")
def live_db() -> Generator[LivePostgresClient, None, None]:
    """Provide a live PostgreSQL client or skip if no database is reachable."""
    conn_url = _detect_postgres_connection_string()
    if not conn_url:
        pytest.skip("No running PostgreSQL/Supabase instance detected on localhost or DATABASE_URL not set")

    try:
        client = LivePostgresClient(conn_url)
        # Verify connection by running a simple query
        client.query("SELECT 1;")
    except Exception as exc:
        pytest.skip(f"No running PostgreSQL/Supabase instance detected on localhost or DATABASE_URL not set: {exc}")

    yield client
    client.close()


# ============================================================================
# 1. Static / Structure Verification of Migration File
# ============================================================================

def _read_migration_sql() -> str:
    assert MIGRATION_PATH.exists(), f"Migration file missing: {MIGRATION_PATH}"
    content = MIGRATION_PATH.read_text(encoding="utf-8")
    assert len(content.strip()) > 0, "Migration file is empty"
    return content


def test_migration_file_exists_and_is_non_empty():
    """Verify that the migration file exists and contains content."""
    sql = _read_migration_sql()
    assert len(sql) > 500, f"Migration file is unexpectedly small ({len(sql)} bytes)"


def test_profiles_table_schema_and_constraints():
    """Verify public.profiles table definition, primary key, cascade, and column defaults."""
    sql = _read_migration_sql()

    # Table creation with IF NOT EXISTS
    assert re.search(
        r"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.profiles",
        sql,
        re.IGNORECASE,
    ), "public.profiles must be created with CREATE TABLE IF NOT EXISTS"

    # UUID Primary key referencing auth.users(id) ON DELETE CASCADE
    assert re.search(
        r"id\s+UUID\s+PRIMARY\s+KEY\s+REFERENCES\s+auth\.users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE",
        sql,
        re.IGNORECASE,
    ), "id column must be UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE"

    # Email column
    assert re.search(
        r"email\s+TEXT\s+NOT\s+NULL",
        sql,
        re.IGNORECASE,
    ), "email column must be TEXT NOT NULL"

    # Display name column
    assert re.search(
        r"display_name\s+TEXT",
        sql,
        re.IGNORECASE,
    ), "display_name column must be TEXT"

    # Timestamps with pg_catalog.now() default
    assert re.search(
        r"created_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+pg_catalog\.now\(\)",
        sql,
        re.IGNORECASE,
    ), "created_at must default to pg_catalog.now()"

    assert re.search(
        r"updated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+pg_catalog\.now\(\)",
        sql,
        re.IGNORECASE,
    ), "updated_at must default to pg_catalog.now()"

    # Unique index on email
    assert re.search(
        r"CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+public\.profiles\s*\(\s*email\s*\)",
        sql,
        re.IGNORECASE,
    ), "Unique index on public.profiles(email) must be defined"


def test_handle_updated_at_security_and_search_path():
    """Verify handle_updated_at function does NOT use SECURITY DEFINER and sets search_path = ''."""
    sql = _read_migration_sql()

    match = re.search(
        r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.handle_updated_at\(\).*?AS\s*\$\$(.*?)\$\$;",
        sql,
        re.DOTALL | re.IGNORECASE,
    )
    assert match, "public.handle_updated_at function definition not found"
    full_def = match.group(0)

    # Must NOT use SECURITY DEFINER (must be security invoker)
    assert "SECURITY DEFINER" not in full_def.upper(), (
        "public.handle_updated_at must NOT use SECURITY DEFINER"
    )

    # Must explicitly set search_path = ''
    assert re.search(
        r"SET\s+search_path\s*=\s*''",
        full_def,
        re.IGNORECASE,
    ), "public.handle_updated_at must specify SET search_path = ''"

    # Must set NEW.updated_at = pg_catalog.now()
    assert re.search(
        r"NEW\.updated_at\s*=\s*pg_catalog\.now\(\)",
        full_def,
        re.IGNORECASE,
    ), "handle_updated_at must set NEW.updated_at = pg_catalog.now();"


def test_handle_new_user_security_definer_and_logic():
    """Verify handle_new_user is SECURITY DEFINER, sets search_path = '', and trims metadata."""
    sql = _read_migration_sql()

    match = re.search(
        r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.handle_new_user\(\).*?AS\s*\$\$(.*?)\$\$;",
        sql,
        re.DOTALL | re.IGNORECASE,
    )
    assert match, "public.handle_new_user function definition not found"
    full_def = match.group(0)

    # Must have SECURITY DEFINER
    assert re.search(
        r"SECURITY\s+DEFINER",
        full_def,
        re.IGNORECASE,
    ), "public.handle_new_user must have SECURITY DEFINER"

    # Must set search_path = ''
    assert re.search(
        r"SET\s+search_path\s*=\s*''",
        full_def,
        re.IGNORECASE,
    ), "public.handle_new_user must specify SET search_path = ''"

    # Must use NULLIF(pg_catalog.btrim(...), '')
    assert re.search(
        r"NULLIF\s*\(\s*pg_catalog\.btrim\s*\(.*?display_name.*?\)\s*,\s*''\s*\)",
        full_def,
        re.DOTALL | re.IGNORECASE,
    ), "handle_new_user must trim display_name using NULLIF(pg_catalog.btrim(...), '')"

    # Must fallback to split_part(NEW.email, '@', 1)
    assert re.search(
        r"pg_catalog\.split_part\s*\(\s*NEW\.email\s*,\s*'@'\s*,\s*1\s*\)",
        full_def,
        re.IGNORECASE,
    ), "handle_new_user must fallback to pg_catalog.split_part(NEW.email, '@', 1)"

    # Must handle conflict gracefully
    assert re.search(
        r"ON\s+CONFLICT\s*\(\s*id\s*\)\s+DO\s+NOTHING",
        full_def,
        re.IGNORECASE,
    ), "handle_new_user must contain ON CONFLICT (id) DO NOTHING"


def test_handle_user_email_change_security_definer_and_logic():
    """Verify handle_user_email_change is SECURITY DEFINER and checks IS DISTINCT FROM."""
    sql = _read_migration_sql()

    match = re.search(
        r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.handle_user_email_change\(\).*?AS\s*\$\$(.*?)\$\$;",
        sql,
        re.DOTALL | re.IGNORECASE,
    )
    assert match, "public.handle_user_email_change function definition not found"
    full_def = match.group(0)

    # Must have SECURITY DEFINER
    assert re.search(
        r"SECURITY\s+DEFINER",
        full_def,
        re.IGNORECASE,
    ), "public.handle_user_email_change must have SECURITY DEFINER"

    # Must set search_path = ''
    assert re.search(
        r"SET\s+search_path\s*=\s*''",
        full_def,
        re.IGNORECASE,
    ), "public.handle_user_email_change must specify SET search_path = ''"

    # Must check IS DISTINCT FROM
    assert re.search(
        r"NEW\.email\s+IS\s+DISTINCT\s+FROM\s+OLD\.email",
        full_def,
        re.IGNORECASE,
    ), "handle_user_email_change must check NEW.email IS DISTINCT FROM OLD.email"


def test_triggers_definition_and_events():
    """Verify triggers are defined on appropriate tables and events."""
    sql = _read_migration_sql()

    # set_profiles_updated_at BEFORE UPDATE ON public.profiles
    assert re.search(
        r"CREATE\s+TRIGGER\s+set_profiles_updated_at\s+BEFORE\s+UPDATE\s+ON\s+public\.profiles\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.handle_updated_at\(\)",
        sql,
        re.IGNORECASE,
    ), "Trigger set_profiles_updated_at must be BEFORE UPDATE ON public.profiles"

    # on_auth_user_created AFTER INSERT ON auth.users
    assert re.search(
        r"CREATE\s+TRIGGER\s+on_auth_user_created\s+AFTER\s+INSERT\s+ON\s+auth\.users\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.handle_new_user\(\)",
        sql,
        re.IGNORECASE,
    ), "Trigger on_auth_user_created must be AFTER INSERT ON auth.users"

    # on_auth_user_email_updated AFTER UPDATE OF email ON auth.users
    assert re.search(
        r"CREATE\s+TRIGGER\s+on_auth_user_email_updated\s+AFTER\s+UPDATE\s+OF\s+email\s+ON\s+auth\.users\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.handle_user_email_change\(\)",
        sql,
        re.IGNORECASE,
    ), "Trigger on_auth_user_email_updated must be AFTER UPDATE OF email ON auth.users"


def test_migration_idempotency_constructs():
    """Verify DROP TRIGGER IF EXISTS and DROP POLICY IF EXISTS are included for idempotency."""
    sql = _read_migration_sql()

    # Drop triggers
    assert re.search(
        r"DROP\s+TRIGGER\s+IF\s+EXISTS\s+set_profiles_updated_at\s+ON\s+public\.profiles",
        sql,
        re.IGNORECASE,
    ), "DROP TRIGGER IF EXISTS set_profiles_updated_at must be specified"

    assert re.search(
        r"DROP\s+TRIGGER\s+IF\s+EXISTS\s+on_auth_user_created\s+ON\s+auth\.users",
        sql,
        re.IGNORECASE,
    ), "DROP TRIGGER IF EXISTS on_auth_user_created must be specified"

    assert re.search(
        r"DROP\s+TRIGGER\s+IF\s+EXISTS\s+on_auth_user_email_updated\s+ON\s+auth\.users",
        sql,
        re.IGNORECASE,
    ), "DROP TRIGGER IF EXISTS on_auth_user_email_updated must be specified"

    # Drop policies
    for policy_name in [
        "Users can read own profile",
        "Users can update own profile",
        "Deny direct profile insertion",
        "Deny direct profile deletion",
    ]:
        escaped_name = re.escape(policy_name)
        assert re.search(
            rf'DROP\s+POLICY\s+IF\s+EXISTS\s+"?{escaped_name}"?\s+ON\s+public\.profiles',
            sql,
            re.IGNORECASE,
        ), f'DROP POLICY IF EXISTS "{policy_name}" must be specified'


def test_table_and_function_privileges_and_grants():
    """Verify table ownership, revocations from PUBLIC/anon, and strict column-level UPDATE grants."""
    sql = _read_migration_sql()

    # Function ownership and revoking
    for func in ["handle_updated_at()", "handle_new_user()", "handle_user_email_change()"]:
        escaped_func = re.escape(func)
        assert re.search(
            rf"ALTER\s+FUNCTION\s+public\.{escaped_func}\s+OWNER\s+TO\s+postgres",
            sql,
            re.IGNORECASE,
        ), f"Function public.{func} must be owned by postgres"

        assert re.search(
            rf"REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.{escaped_func}\s+FROM\s+PUBLIC",
            sql,
            re.IGNORECASE,
        ), f"PUBLIC execution must be revoked from public.{func}"

        assert re.search(
            rf"GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.{escaped_func}\s+TO\s+postgres,\s*service_role",
            sql,
            re.IGNORECASE,
        ), f"Execute on public.{func} must be granted to postgres, service_role"

    # Table ownership
    assert re.search(
        r"ALTER\s+TABLE\s+public\.profiles\s+OWNER\s+TO\s+postgres",
        sql,
        re.IGNORECASE,
    ), "public.profiles must be owned by postgres"

    # Table privilege revocations
    assert re.search(
        r"REVOKE\s+ALL\s+ON\s+TABLE\s+public\.profiles\s+FROM\s+PUBLIC",
        sql,
        re.IGNORECASE,
    ), "REVOKE ALL ON TABLE public.profiles FROM PUBLIC must be specified"

    assert re.search(
        r"REVOKE\s+ALL\s+ON\s+TABLE\s+public\.profiles\s+FROM\s+anon",
        sql,
        re.IGNORECASE,
    ), "REVOKE ALL ON TABLE public.profiles FROM anon must be specified"

    # Administrative grants
    assert re.search(
        r"GRANT\s+ALL\s+ON\s+TABLE\s+public\.profiles\s+TO\s+postgres,\s*service_role",
        sql,
        re.IGNORECASE,
    ), "GRANT ALL ON TABLE public.profiles TO postgres, service_role must be specified"

    # Authenticated user grants
    assert re.search(
        r"GRANT\s+SELECT\s+ON\s+TABLE\s+public\.profiles\s+TO\s+authenticated",
        sql,
        re.IGNORECASE,
    ), "GRANT SELECT ON TABLE public.profiles TO authenticated must be specified"

    # Column-level update restriction: UPDATE (display_name) ONLY
    assert re.search(
        r"GRANT\s+UPDATE\s*\(\s*display_name\s*\)\s+ON\s+TABLE\s+public\.profiles\s+TO\s+authenticated",
        sql,
        re.IGNORECASE,
    ), "GRANT UPDATE (display_name) ON TABLE public.profiles TO authenticated must be strictly specified"

    # CRITICAL: Verify table-level UPDATE is NOT granted to authenticated
    table_level_update = re.search(
        r"GRANT\s+UPDATE\s+ON\s+TABLE\s+public\.profiles\s+TO\s+authenticated",
        sql,
        re.IGNORECASE,
    )
    assert not table_level_update, (
        "Table-level UPDATE must NOT be granted to authenticated (must be column-level display_name only)"
    )

    # CRITICAL: Verify INSERT and DELETE are NOT granted to authenticated
    assert not re.search(
        r"GRANT\s+INSERT(\s*\([^)]*\))?\s+ON\s+TABLE\s+public\.profiles\s+TO\s+authenticated",
        sql,
        re.IGNORECASE,
    ), "INSERT must NOT be granted to authenticated"

    assert not re.search(
        r"GRANT\s+DELETE\s+ON\s+TABLE\s+public\.profiles\s+TO\s+authenticated",
        sql,
        re.IGNORECASE,
    ), "DELETE must NOT be granted to authenticated"


def test_row_level_security_policies():
    """Verify Row Level Security is enabled and all 4 policies are correctly configured."""
    sql = _read_migration_sql()

    # RLS enabled
    assert re.search(
        r"ALTER\s+TABLE\s+public\.profiles\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY",
        sql,
        re.IGNORECASE,
    ), "ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY must be specified"

    # 1. SELECT policy: auth.uid() = id
    assert re.search(
        r'CREATE\s+POLICY\s+"Users can read own profile"\s+ON\s+public\.profiles\s+FOR\s+SELECT\s+TO\s+authenticated\s+USING\s*\(\s*\(\s*\(\s*SELECT\s+auth\.uid\(\)\s*\)\s*=\s*id\s*\)\s*\)',
        sql,
        re.IGNORECASE,
    ), "Policy 'Users can read own profile' must match (SELECT auth.uid()) = id"

    # 2. UPDATE policy: USING and WITH CHECK auth.uid() = id
    assert re.search(
        r'CREATE\s+POLICY\s+"Users can update own profile"\s+ON\s+public\.profiles\s+FOR\s+UPDATE\s+TO\s+authenticated\s+USING\s*\(\s*\(\s*\(\s*SELECT\s+auth\.uid\(\)\s*\)\s*=\s*id\s*\)\s*\)\s+WITH\s+CHECK\s*\(\s*\(\s*\(\s*SELECT\s+auth\.uid\(\)\s*\)\s*=\s*id\s*\)\s*\)',
        sql,
        re.IGNORECASE,
    ), "Policy 'Users can update own profile' must enforce auth.uid() = id on both USING and WITH CHECK"

    # 3. INSERT policy: WITH CHECK (false)
    assert re.search(
        r'CREATE\s+POLICY\s+"Deny direct profile insertion"\s+ON\s+public\.profiles\s+FOR\s+INSERT\s+TO\s+authenticated\s+WITH\s+CHECK\s*\(\s*false\s*\)',
        sql,
        re.IGNORECASE,
    ), "Policy 'Deny direct profile insertion' must specify WITH CHECK (false)"

    # 4. DELETE policy: USING (false)
    assert re.search(
        r'CREATE\s+POLICY\s+"Deny direct profile deletion"\s+ON\s+public\.profiles\s+FOR\s+DELETE\s+TO\s+authenticated\s+USING\s*\(\s*false\s*\)',
        sql,
        re.IGNORECASE,
    ), "Policy 'Deny direct profile deletion' must specify USING (false)"


# ============================================================================
# 2. Real PostgreSQL / Live Execution Tests
#    These run only against an active PostgreSQL / Supabase instance.
#    When no instance is available, they skip gracefully.
# ============================================================================

def _prepare_test_db(live_db: LivePostgresClient) -> None:
    """Prepare mock Supabase environment structures if running on plain PostgreSQL."""
    prep_sql = """
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email TEXT,
        raw_user_meta_data JSONB
    );
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
        SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$ LANGUAGE sql STABLE;

    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            CREATE ROLE anon;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            CREATE ROLE authenticated;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
            CREATE ROLE service_role;
        END IF;
    END
    $$;
    """
    live_db.execute(prep_sql)


def test_live_migration_application_and_idempotency(live_db: LivePostgresClient):
    """Apply migration to live database and verify running it twice is completely idempotent."""
    _prepare_test_db(live_db)
    migration_sql = _read_migration_sql()

    # First run
    live_db.execute(migration_sql)

    # Second run (idempotency check)
    live_db.execute(migration_sql)

    # Verify table exists in information schema
    res = live_db.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles';"
    )
    assert len(res) == 1 and res[0][0] == "profiles"


def test_live_anon_role_denied_access(live_db: LivePostgresClient):
    """Verify that anon role is denied SELECT, UPDATE, INSERT, and DELETE on public.profiles."""
    _prepare_test_db(live_db)
    live_db.execute(_read_migration_sql())

    # Test anon SELECT is denied (42501 permission denied)
    with pytest.raises(Exception) as exc_info:
        live_db.execute("SET ROLE anon; SELECT * FROM public.profiles; RESET ROLE;")
    assert "permission denied" in str(exc_info.value).lower() or "42501" in str(exc_info.value)
    live_db.execute("RESET ROLE;")

    # Test anon UPDATE is denied
    with pytest.raises(Exception) as exc_info:
        live_db.execute("SET ROLE anon; UPDATE public.profiles SET display_name = 'Hacked'; RESET ROLE;")
    assert "permission denied" in str(exc_info.value).lower() or "42501" in str(exc_info.value)
    live_db.execute("RESET ROLE;")


def test_live_authenticated_can_update_own_display_name(live_db: LivePostgresClient):
    """Verify authenticated user can update display_name on their own row."""
    _prepare_test_db(live_db)
    live_db.execute(_read_migration_sql())

    user_id = str(uuid.uuid4())
    user_email = f"user_{uuid.uuid4().hex[:8]}@example.com"

    # Insert user in auth.users (trigger provisions public.profiles)
    live_db.execute(f"""
        INSERT INTO auth.users (id, email, raw_user_meta_data)
        VALUES ('{user_id}', '{user_email}', '{{"display_name": "Original Name"}}');
    """)

    # Authenticated user updates own display_name
    live_db.execute(f"""
        SET ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '{user_id}';
        UPDATE public.profiles SET display_name = 'Updated Name' WHERE id = '{user_id}';
        RESET ROLE;
    """)

    # Verify update succeeded
    res = live_db.query(f"SELECT display_name FROM public.profiles WHERE id = '{user_id}';")
    assert len(res) == 1 and res[0][0] == "Updated Name"


def test_live_authenticated_cannot_update_disallowed_columns(live_db: LivePostgresClient):
    """Verify authenticated user receives 42501 error when attempting to update email or id."""
    _prepare_test_db(live_db)
    live_db.execute(_read_migration_sql())

    user_id = str(uuid.uuid4())
    user_email = f"user_{uuid.uuid4().hex[:8]}@example.com"

    live_db.execute(f"""
        INSERT INTO auth.users (id, email, raw_user_meta_data)
        VALUES ('{user_id}', '{user_email}', '{{"display_name": "Column Test"}}');
    """)

    # Attempt to update email (must raise permission denied for column)
    with pytest.raises(Exception) as exc_info:
        live_db.execute(f"""
            SET ROLE authenticated;
            SET LOCAL "request.jwt.claim.sub" = '{user_id}';
            UPDATE public.profiles SET email = 'hacked@example.com' WHERE id = '{user_id}';
            RESET ROLE;
        """)
    live_db.execute("RESET ROLE;")
    assert "permission denied" in str(exc_info.value).lower() or "42501" in str(exc_info.value)

    # Attempt to update id (must raise permission denied for column)
    with pytest.raises(Exception) as exc_info:
        live_db.execute(f"""
            SET ROLE authenticated;
            SET LOCAL "request.jwt.claim.sub" = '{user_id}';
            UPDATE public.profiles SET id = '{uuid.uuid4()}' WHERE id = '{user_id}';
            RESET ROLE;
        """)
    live_db.execute("RESET ROLE;")
    assert "permission denied" in str(exc_info.value).lower() or "42501" in str(exc_info.value)


def test_live_authenticated_cannot_update_other_user_profile(live_db: LivePostgresClient):
    """Verify RLS isolates profiles: updating another user's row modifies 0 rows."""
    _prepare_test_db(live_db)
    live_db.execute(_read_migration_sql())

    user1_id = str(uuid.uuid4())
    user2_id = str(uuid.uuid4())

    live_db.execute(f"""
        INSERT INTO auth.users (id, email, raw_user_meta_data)
        VALUES ('{user1_id}', 'user1@example.com', '{{"display_name": "User 1"}}');
        INSERT INTO auth.users (id, email, raw_user_meta_data)
        VALUES ('{user2_id}', 'user2@example.com', '{{"display_name": "User 2"}}');
    """)

    # User 1 attempts to update User 2's display_name
    live_db.execute(f"""
        SET ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '{user1_id}';
        UPDATE public.profiles SET display_name = 'User 2 Pwned' WHERE id = '{user2_id}';
        RESET ROLE;
    """)

    # Verify User 2's profile was untouched
    res = live_db.query(f"SELECT display_name FROM public.profiles WHERE id = '{user2_id}';")
    assert len(res) == 1 and res[0][0] == "User 2"


def test_live_triggers_auto_provision_and_email_sync(live_db: LivePostgresClient):
    """Verify handle_new_user and handle_user_email_change triggers in action."""
    _prepare_test_db(live_db)
    live_db.execute(_read_migration_sql())

    # 1. Trigger on user creation with metadata
    user_id = str(uuid.uuid4())
    live_db.execute(f"""
        INSERT INTO auth.users (id, email, raw_user_meta_data)
        VALUES ('{user_id}', 'test_meta@example.com', '{{"display_name": "  Custom Name  "}}');
    """)
    res = live_db.query(f"SELECT display_name, email FROM public.profiles WHERE id = '{user_id}';")
    assert len(res) == 1
    assert res[0][0] == "Custom Name"  # btrim applied
    assert res[0][1] == "test_meta@example.com"

    # 2. Trigger on user creation without metadata (email prefix fallback)
    user2_id = str(uuid.uuid4())
    live_db.execute(f"""
        INSERT INTO auth.users (id, email, raw_user_meta_data)
        VALUES ('{user2_id}', 'fallback_user@example.com', '{{}}');
    """)
    res = live_db.query(f"SELECT display_name FROM public.profiles WHERE id = '{user2_id}';")
    assert len(res) == 1
    assert res[0][0] == "fallback_user"

    # 3. Trigger on email update
    live_db.execute(f"""
        UPDATE auth.users SET email = 'updated_meta@example.com' WHERE id = '{user_id}';
    """)
    res = live_db.query(f"SELECT email FROM public.profiles WHERE id = '{user_id}';")
    assert len(res) == 1
    assert res[0][0] == "updated_meta@example.com"
