#!/usr/bin/env python3
"""Run age-limited audit retention with a dedicated maintenance database identity."""
import os
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]


def main():
    values = {}
    for filename in ('.env', '.env.runtime'):
        path = ROOT / filename
        if path.exists():
            for line in path.read_text().splitlines():
                if line.strip() and not line.lstrip().startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    values[key] = value.strip().strip('"').strip("'")
    values.update(os.environ)
    if values.get('RETENTION_POLICY_APPROVED', '').lower() != 'true' or not values.get('RETENTION_POLICY_REFERENCE'):
        raise SystemExit('An approved retention policy reference is required.')
    try:
        days = int(values['AUDIT_RETENTION_DAYS'])
        if days <= 0:
            raise ValueError
    except (KeyError, ValueError):
        raise SystemExit('AUDIT_RETENTION_DAYS must be a positive approved value.') from None
    url = values.get('RETENTION_DATABASE_URL')
    if not url:
        raise SystemExit('A dedicated RETENTION_DATABASE_URL is required.')
    with psycopg.connect(url.replace('postgresql+psycopg://', 'postgresql://', 1)) as connection:
        allowed = connection.execute("SELECT pg_has_role(session_user,'fvv_retention','member')").fetchone()[0]
        if not allowed:
            raise SystemExit('The maintenance identity lacks fvv_retention membership.')
        removed = connection.execute('SELECT fvv_purge_expired_audit(%s,%s)',
                                     (days, values['RETENTION_POLICY_REFERENCE'])).fetchone()[0]
        connection.commit()
    print(f'Expired audit records removed under the approved policy: {removed}')


if __name__ == '__main__':
    main()
