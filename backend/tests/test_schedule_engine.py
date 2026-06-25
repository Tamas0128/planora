from datetime import date

from app.services.schedule_engine import add_workdays, is_workday, subtract_workdays


def test_is_workday():
    assert is_workday(date(2026, 6, 22))  # Monday
    assert not is_workday(date(2026, 6, 27))  # Saturday
    assert not is_workday(date(2026, 6, 28))  # Sunday


def test_subtract_workdays_skips_weekend():
    # Monday 2026-06-22 minus 1 workday should land on Friday 2026-06-19
    result = subtract_workdays(date(2026, 6, 22), 1)
    assert result == date(2026, 6, 19)


def test_subtract_workdays_zero_returns_same_date():
    d = date(2026, 6, 22)
    assert subtract_workdays(d, 0) == d


def test_add_workdays_skips_weekend():
    # Friday 2026-06-19 plus 1 workday (duration) should land on Monday 2026-06-22
    result = add_workdays(date(2026, 6, 19), 2)
    assert result == date(2026, 6, 22)


def test_add_workdays_one_day_returns_same_date():
    d = date(2026, 6, 22)
    assert add_workdays(d, 1) == d
