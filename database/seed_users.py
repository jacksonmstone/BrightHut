#!/usr/bin/env python3
"""
Seed users into database/brighthut.sqlite.

Requires: pip install bcrypt

Run from repo root:
    SEED_ADMIN_PASSWORD=<pass> SEED_DONOR_PASSWORD=<pass> python database/seed_users.py

Required environment variables:
    SEED_ADMIN_PASSWORD  — password for admin@brighthut.org
  SEED_DONOR_PASSWORD  — password for donor@brighthut.org

role must be 'admin' or 'donor'.
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

try:
    import bcrypt
except ImportError:
    raise SystemExit("Missing 'bcrypt' package. Install it with:  pip install bcrypt")

REPO_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = REPO_ROOT / "database" / "brighthut.sqlite"

# ── Load passwords from environment variables (never hardcode) ────────────────
_admin_password = os.environ.get("SEED_ADMIN_PASSWORD")
_donor_password = os.environ.get("SEED_DONOR_PASSWORD")

missing = [v for v, val in [("SEED_ADMIN_PASSWORD", _admin_password), ("SEED_DONOR_PASSWORD", _donor_password)] if not val]
if missing:
    raise SystemExit(
        f"Missing required environment variable(s): {', '.join(missing)}\n"
        "Set them before running this script:\n"
        "  export SEED_ADMIN_PASSWORD='...' SEED_DONOR_PASSWORD='...'"
    )

USERS: list[dict] = [
    {
        "email": "admin@brighthut.org",
        "password": _admin_password,
        "role": "admin",
        "first_name": "Admin",
        "last_name": "User",
    },
    {
        "email": "donor@brighthut.org",
        "password": _donor_password,
        "role": "donor",
        "first_name": "Test",
        "last_name": "Donor",
    },
]
# ─────────────────────────────────────────────────────────────────────────────


def seed(db_path: Path = DB_PATH) -> None:
    if not db_path.exists():
        raise SystemExit(f"Database not found at {db_path}. Run build_sqlite.py first.")

    conn = sqlite3.connect(db_path)
    try:
        created = updated = 0

        # migrate legacy staff account to admin when needed
        legacy_staff = conn.execute(
            "SELECT user_id FROM users WHERE lower(email) = 'staff@brighthut.org'"
        ).fetchone()
        admin_user = conn.execute(
            "SELECT user_id FROM users WHERE lower(email) = 'admin@brighthut.org'"
        ).fetchone()
        if legacy_staff and not admin_user:
            conn.execute(
                """
                UPDATE users
                SET email = 'admin@brighthut.org', role = 'admin', first_name = 'Admin', last_name = 'User', is_active = 1
                WHERE lower(email) = 'staff@brighthut.org'
                """
            )
            print("  Migrated: staff@brighthut.org -> admin@brighthut.org")
        elif legacy_staff and admin_user:
            conn.execute("DELETE FROM users WHERE lower(email) = 'staff@brighthut.org'")
            print("  Removed duplicate legacy staff@brighthut.org user")
        for u in USERS:
            email = u["email"].lower()
            password_hash = bcrypt.hashpw(
                u["password"].encode(), bcrypt.gensalt(rounds=12)
            ).decode()

            existing = conn.execute(
                "SELECT user_id FROM users WHERE email = ?", (email,)
            ).fetchone()

            if existing:
                conn.execute(
                    "UPDATE users SET password_hash = ?, role = ?, is_active = 1 WHERE email = ?",
                    (password_hash, u["role"], email),
                )
                print(f"  Updated : {email}  (role={u['role']})")
                updated += 1
            else:
                conn.execute(
                    """INSERT INTO users
                         (email, password_hash, role, first_name, last_name,
                          organization_name, phone, country, region,
                          relationship_type, acquisition_channel, supporter_type)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        email,
                        password_hash,
                        u["role"],
                        u.get("first_name"),
                        u.get("last_name"),
                        u.get("organization_name"),
                        u.get("phone"),
                        u.get("country"),
                        u.get("region"),
                        u.get("relationship_type"),
                        u.get("acquisition_channel"),
                        u.get("supporter_type"),
                    ),
                )
                print(f"  Created : {email}  (role={u['role']})")
                created += 1

        conn.commit()
        print(f"Users seeded — {created} created, {updated} updated.")
    finally:
        conn.close()


if __name__ == "__main__":
    seed()
