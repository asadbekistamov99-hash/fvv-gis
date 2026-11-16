"""Pure password-hash checks; these need no database."""
from app.core.security import hash_password, verify_password


def test_hash_round_trip_and_salting():
    first = hash_password("Parol2026x")
    second = hash_password("Parol2026x")
    assert first != second
    assert verify_password("Parol2026x", first)
    assert not verify_password("Parol2026y", first)


def test_missing_or_malformed_hashes_never_verify():
    assert not verify_password("Parol2026x", None)
    assert not verify_password("Parol2026x", "")
    assert not verify_password("Parol2026x", "bcrypt$garbage")
    assert not verify_password("Parol2026x", "scrypt$x$y$z$!!$!!")
