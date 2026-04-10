#!/usr/bin/env python3
"""
Seed users into database/brighthut.sqlite.

Requires: pip install bcrypt

Run from repo root:
  SEED_STAFF_PASSWORD=<pass> SEED_DONOR_PASSWORD=<pass> python database/seed_users.py

Required environment variables:
  SEED_STAFF_PASSWORD  — password for staff@brighthut.org
  SEED_DONOR_PASSWORD  — password for donor@brighthut.org

role must be 'staff' or 'donor'.
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
_staff_password = os.environ.get("SEED_STAFF_PASSWORD")
_donor_password = os.environ.get("SEED_DONOR_PASSWORD")

missing = [v for v, val in [("SEED_STAFF_PASSWORD", _staff_password), ("SEED_DONOR_PASSWORD", _donor_password)] if not val]
if missing:
    raise SystemExit(
        f"Missing required environment variable(s): {', '.join(missing)}\n"
        "Set them before running this script:\n"
        "  export SEED_STAFF_PASSWORD='...' SEED_DONOR_PASSWORD='...'"
    )

USERS: list[dict] = [
    {
        "email": "staff@brighthut.org",
        "password": _staff_password,
        "role": "staff",
        "first_name": "Staff",
        "last_name": "Admin",
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
