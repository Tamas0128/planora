"""B2C sales dashboard — weekly close/momentum + monthly strategic volumes.

Aggregation is deliberately Python-side (fetch rows with plain date-range
filters, bucket/average in Python) rather than `date_trunc`/`EXTRACT` SQL:
the test suite runs against sqlite (backend/tests/conftest.py) while prod is
Postgres, so Postgres-only date SQL would silently break pytest. See
docs/CRM_modul_fejlesztesi_terv.md for the base CRM model this extends.
"""

from calendar import monthrange
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.models_crm import (
    CommunicationEvent,
    CommunicationType,
    Contract,
    Customer,
    CustomerStatus,
    Quote,
    QuoteStatus,
)
from app.schemas_crm import (
    ConversionFunnel,
    PipelineBucket,
    SalesDashboardMonthly,
    SalesDashboardWeekly,
    SourceBreakdown,
    TrendPoint,
    ValidQuotesSummary,
)
from app.services.scoping import (
    scoped_communication_event_query,
    scoped_contract_query,
    scoped_customer_query,
    scoped_quote_query,
)

router = APIRouter(prefix="/crm/sales-dashboard", tags=["crm-sales-dashboard"])

TREND_MONTHS = 6


def _day_bounds(day: date) -> tuple[datetime, datetime]:
    return datetime.combine(day, time.min), datetime.combine(day, time.max)


def _previous_week_start(today: date) -> date:
    this_monday = today - timedelta(days=today.weekday())
    return this_monday - timedelta(days=7)


def _previous_month_start(today: date) -> date:
    first_of_this_month = today.replace(day=1)
    last_day_prev_month = first_of_this_month - timedelta(days=1)
    return last_day_prev_month.replace(day=1)


def _month_end(month_start: date) -> date:
    return month_start.replace(day=monthrange(month_start.year, month_start.month)[1])


def _add_months(month_start: date, delta: int) -> date:
    month_index = month_start.year * 12 + (month_start.month - 1) + delta
    year, month = divmod(month_index, 12)
    return date(year, month + 1, 1)


@router.get("/weekly", response_model=SalesDashboardWeekly)
def sales_dashboard_weekly(
    week_start: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    week_start = week_start or _previous_week_start(date.today())
    week_end = week_start + timedelta(days=6)
    range_start, _ = _day_bounds(week_start)
    _, range_end = _day_bounds(week_end)

    contracts_in_week = (
        scoped_contract_query(db, user)
        .filter(Contract.signed_at.isnot(None), Contract.signed_at.between(range_start, range_end))
        .all()
    )
    contracts_signed_count = len(contracts_in_week)
    contracts_signed_value = sum(
        (c.value for c in contracts_in_week if c.value is not None), Decimal("0")
    )

    customers_q = scoped_customer_query(db, user)
    active_customers = customers_q.filter(Customer.status != CustomerStatus.ARCHIVED).count()
    new_inquiries = customers_q.filter(Customer.created_at.between(range_start, range_end)).count()

    quotes_sent = (
        scoped_quote_query(db, user)
        .filter(Quote.sent_at.isnot(None), Quote.sent_at.between(range_start, range_end))
        .count()
    )
    # Site visit/consultation proxy — IN_PERSON is the closest existing
    # CommunicationType, no finer subtype exists (see plan note).
    site_visits = (
        scoped_communication_event_query(db, user)
        .filter(
            CommunicationEvent.type == CommunicationType.IN_PERSON,
            CommunicationEvent.date >= week_start,
            CommunicationEvent.date <= week_end,
        )
        .count()
    )

    pipeline = [
        PipelineBucket(status=status, count=count)
        for status, count in customers_q.with_entities(Customer.status, func.count()).group_by(
            Customer.status
        )
    ]

    return SalesDashboardWeekly(
        week_start=week_start,
        week_end=week_end,
        contracts_signed_count=contracts_signed_count,
        contracts_signed_value=contracts_signed_value,
        active_customers=active_customers,
        new_inquiries=new_inquiries,
        quotes_sent=quotes_sent,
        site_visits=site_visits,
        pipeline=pipeline,
    )


@router.get("/monthly", response_model=SalesDashboardMonthly)
def sales_dashboard_monthly(
    month: Optional[date] = Query(None, description="Any date within the target month"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    month_start = (month or _previous_month_start(date.today())).replace(day=1)
    month_end = _month_end(month_start)
    range_start, _ = _day_bounds(month_start)
    _, range_end = _day_bounds(month_end)

    contracts_in_month = (
        scoped_contract_query(db, user)
        .filter(Contract.signed_at.isnot(None), Contract.signed_at.between(range_start, range_end))
        .all()
    )
    valued_contracts = [c for c in contracts_in_month if c.value is not None]
    total_contracted_value = sum((c.value for c in valued_contracts), Decimal("0"))
    average_contract_value = (
        total_contracted_value / len(valued_contracts) if valued_contracts else None
    )

    # Sales-cycle days: signed_at - the customer's created_at ("first
    # contact" — the only reliable pre-Quote timestamp that exists).
    cycle_rows = (
        scoped_contract_query(db, user)
        .with_entities(Contract.signed_at, Customer.created_at)
        .filter(Contract.signed_at.isnot(None), Contract.signed_at.between(range_start, range_end))
        .all()
    )
    if cycle_rows:
        cycle_days = [(signed - created).days for signed, created in cycle_rows]
        average_sales_cycle_days = sum(cycle_days) / len(cycle_days)
    else:
        average_sales_cycle_days = None

    # Trailing TREND_MONTHS months ending at the selected month.
    trend_start = _add_months(month_start, -(TREND_MONTHS - 1))
    trend_range_start, _ = _day_bounds(trend_start)
    trend_rows = (
        scoped_contract_query(db, user)
        .with_entities(Contract.signed_at, Contract.value)
        .filter(Contract.signed_at.isnot(None), Contract.signed_at.between(trend_range_start, range_end))
        .all()
    )
    trend_sums: dict[tuple[int, int], Decimal] = defaultdict(lambda: Decimal("0"))
    for signed_at, value in trend_rows:
        if value is not None:
            trend_sums[(signed_at.year, signed_at.month)] += value
    trend = []
    for i in range(TREND_MONTHS):
        bucket_month = _add_months(trend_start, i)
        key = (bucket_month.year, bucket_month.month)
        trend.append(
            TrendPoint(year=key[0], month=key[1], contracted_value=trend_sums.get(key, Decimal("0")))
        )

    # Lead source breakdown — of contracts signed this month, grouped by the
    # signing customer's source (None = "Ismeretlen", not dropped).
    source_counts = Counter(c.customer.source for c in contracts_in_month)
    source_breakdown = [
        SourceBreakdown(source=source, count=count) for source, count in source_counts.items()
    ]

    # Conversion funnel — a pragmatic monthly-volume snapshot, not true
    # cohort tracking (a lead from mid-month may not convert until later):
    # leads = customers first seen this month; negotiations = distinct
    # customers with a quote sent this month; contracts = contracts signed
    # this month. No stage-transition history table backs this.
    leads = scoped_customer_query(db, user).filter(
        Customer.created_at.between(range_start, range_end)
    ).count()
    negotiations = (
        scoped_quote_query(db, user)
        .filter(Quote.sent_at.isnot(None), Quote.sent_at.between(range_start, range_end))
        .with_entities(func.count(func.distinct(Quote.customer_id)))
        .scalar()
        or 0
    )
    contracts_count = len(contracts_in_month)
    funnel = ConversionFunnel(
        leads=leads,
        negotiations=negotiations,
        contracts=contracts_count,
        lead_to_negotiation_pct=(negotiations / leads * 100) if leads else 0.0,
        negotiation_to_contract_pct=(contracts_count / negotiations * 100) if negotiations else 0.0,
    )

    return SalesDashboardMonthly(
        month=month_start,
        total_contracted_value=total_contracted_value,
        average_contract_value=average_contract_value,
        average_sales_cycle_days=average_sales_cycle_days,
        trend=trend,
        source_breakdown=source_breakdown,
        funnel=funnel,
    )


@router.get("/valid-quotes", response_model=ValidQuotesSummary)
def valid_quotes_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Point-in-time count + total value of currently-open quotes — "érvényes"
    meaning not yet REJECTED or EXPIRED (DRAFT/APPROVAL_PENDING/SENT/ACCEPTED
    all still represent live pipeline value), regardless of when they were
    created — unlike the rest of this dashboard, this isn't week/month-scoped.
    """
    quotes = (
        scoped_quote_query(db, user)
        .filter(Quote.status.notin_([QuoteStatus.REJECTED, QuoteStatus.EXPIRED]))
        .all()
    )
    total_value = sum((q.value for q in quotes if q.value is not None), Decimal("0"))
    return ValidQuotesSummary(count=len(quotes), total_value=total_value)
