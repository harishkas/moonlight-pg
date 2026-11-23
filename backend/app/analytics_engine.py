from datetime import datetime, date, timedelta
from typing import Dict, Any, List
from sqlalchemy import select, func, and_, or_, distinct
from sqlalchemy.orm import Session
from .models import (
    Tenant, Room, Bed, BedAllocation, RentInvoice, Payment,
    Expense, FoodSubscription, ParkingSlot, ParkingAllocation,
    ElectricityReading, ServiceCharge
)

def get_analytics_overview(db: Session) -> Dict[str, Any]:
    """Computes comprehensive top-level business analytics."""
    rooms = db.scalars(select(Room)).all()
    beds = db.scalars(select(Bed)).all()
    active_tenants = db.scalars(select(Tenant).where(Tenant.status == "Active")).all()
    vacated_tenants = db.scalars(select(Tenant).where(Tenant.status == "Vacated")).all()

    total_beds = len(beds)
    occupied_beds = len([b for b in beds if b.status == "Occupied"])
    available_beds = len([b for b in beds if b.status == "Available"])
    maint_beds = len([b for b in beds if b.status == "Maintenance"])
    occupancy_rate = round((occupied_beds / total_beds * 100), 1) if total_beds > 0 else 0.0

    # Financial sums
    invoices = db.scalars(select(RentInvoice)).all()
    total_rent_expected = sum(i.total_amount for i in invoices)
    total_rent_collected = sum(i.amount_paid for i in invoices)
    total_rent_pending = sum(i.pending_amount for i in invoices)

    payments = db.scalars(select(Payment).where(Payment.is_cancelled == False)).all()
    total_all_collected = sum(p.amount for p in payments)

    expenses = db.scalars(select(Expense).where(Expense.is_deleted == False)).all()
    total_expenses = sum(e.amount for e in expenses)

    net_operating_income = round(total_all_collected - total_expenses, 2)
    collection_rate = round((total_rent_collected / total_rent_expected * 100), 1) if total_rent_expected > 0 else 0.0

    # Service metrics
    active_food = db.scalar(select(func.count(FoodSubscription.id)).where(FoodSubscription.status == "Active")) or 0
    active_parking = db.scalar(select(func.count(ParkingAllocation.id)).where(ParkingAllocation.status == "Active")) or 0

    return {
        "total_rooms": len(rooms),
        "total_beds": total_beds,
        "occupied_beds": occupied_beds,
        "available_beds": available_beds,
        "maintenance_beds": maint_beds,
        "occupancy_rate": occupancy_rate,
        "active_tenants": len(active_tenants),
        "vacated_tenants": len(vacated_tenants),
        "total_rent_expected": total_rent_expected,
        "total_rent_collected": total_rent_collected,
        "total_rent_pending": total_rent_pending,
        "total_all_collected": total_all_collected,
        "total_expenses": total_expenses,
        "net_operating_income": net_operating_income,
        "collection_rate": collection_rate,
        "active_food_subscriptions": active_food,
        "active_parking_allocations": active_parking
    }

def get_occupancy_analytics(db: Session) -> Dict[str, Any]:
    """Generates monthly occupancy trend and floor-by-floor breakdown."""
    rooms = db.scalars(select(Room)).all()
    beds = db.scalars(select(Bed)).all()
    allocations = db.scalars(select(BedAllocation)).all()

    # Room-level summary
    room_breakdown = []
    floor_stats: Dict[int, Dict[str, int]] = {}

    for r in rooms:
        r_beds = [b for b in beds if b.room_id == r.id]
        occ = len([b for b in r_beds if b.status == "Occupied"])
        cap = len(r_beds) or r.capacity

        room_breakdown.append({
            "room_id": r.id,
            "room_number": r.room_number,
            "floor": r.floor,
            "room_type": r.room_type,
            "has_ac": r.has_ac,
            "capacity": cap,
            "occupied": occ,
            "rate": round((occ / cap * 100), 1) if cap > 0 else 0.0,
            "status": r.status
        })

        if r.floor not in floor_stats:
            floor_stats[r.floor] = {"total_beds": 0, "occupied_beds": 0, "rooms": 0}
        floor_stats[r.floor]["total_beds"] += cap
        floor_stats[r.floor]["occupied_beds"] += occ
        floor_stats[r.floor]["rooms"] += 1

    floor_breakdown = [
        {
            "floor": f,
            "rooms": data["rooms"],
            "total_beds": data["total_beds"],
            "occupied_beds": data["occupied_beds"],
            "occupancy_rate": round((data["occupied_beds"] / data["total_beds"] * 100), 1) if data["total_beds"] > 0 else 0.0
        }
        for f, data in sorted(floor_stats.items())
    ]

    # 6-Month Trend Simulation based on actual allocation months
    today = date.today()
    trend = []
    for i in range(5, -1, -1):
        m_date = today.replace(day=1) - timedelta(days=i * 30)
        m_label = m_date.strftime("%b %Y")
        m_str = m_date.strftime("%Y-%m")

        # Active allocations during that month
        active_in_month = len([
            a for a in allocations
            if a.allocation_date[:7] <= m_str and (not a.vacating_date or a.vacating_date[:7] >= m_str)
        ])
        total_b = len(beds) or 30
        rate = round((active_in_month / total_b * 100), 1) if total_b > 0 else 0.0
        trend.append({
            "month": m_label,
            "occupied": active_in_month,
            "capacity": total_b,
            "rate": rate
        })

    return {
        "monthly_trend": trend,
        "floor_breakdown": floor_breakdown,
        "room_breakdown": room_breakdown
    }

def get_financial_analytics(db: Session, months: int = 6) -> Dict[str, Any]:
    """Computes monthly financial performance, collection efficiency and expense breakdown."""
    payments = db.scalars(select(Payment).where(Payment.is_cancelled == False)).all()
    expenses = db.scalars(select(Expense).where(Expense.is_deleted == False)).all()
    invoices = db.scalars(select(RentInvoice)).all()

    # Expense category distribution
    cat_expenses: Dict[str, float] = {}
    for e in expenses:
        cat_expenses[e.category] = cat_expenses.get(e.category, 0.0) + e.amount

    expense_breakdown = [
        {"category": cat, "amount": round(amt, 2)}
        for cat, amt in sorted(cat_expenses.items(), key=lambda x: x[1], reverse=True)
    ]

    # Monthly income vs expense trend
    today = date.today()
    monthly_data = []

    for i in range(months - 1, -1, -1):
        target_month_date = today.replace(day=1) - timedelta(days=i * 30)
        m = target_month_date.month
        y = target_month_date.year
        label = target_month_date.strftime("%b %Y")
        m_prefix = f"{y}-{m:02d}"

        month_rent = sum(p.amount for p in payments if p.payment_date[:7] == m_prefix and p.payment_type == "Monthly Rent")
        month_other = sum(p.amount for p in payments if p.payment_date[:7] == m_prefix and p.payment_type != "Monthly Rent")
        total_income = round(month_rent + month_other, 2)

        month_exp = round(sum(e.amount for e in expenses if e.expense_date[:7] == m_prefix), 2)
        noi = round(total_income - month_exp, 2)

        # Invoices billed for this month
        month_invoices = [inv for inv in invoices if inv.billing_month == m and inv.billing_year == y]
        expected = sum(inv.total_amount for inv in month_invoices)
        collected = sum(inv.amount_paid for inv in month_invoices)
        collection_rate = round((collected / expected * 100), 1) if expected > 0 else 0.0

        monthly_data.append({
            "month": label,
            "rent_income": month_rent,
            "other_income": month_other,
            "total_income": total_income,
            "expenses": month_exp,
            "net_operating_income": noi,
            "collection_rate": collection_rate
        })

    return {
        "monthly_performance": monthly_data,
        "expense_category_breakdown": expense_breakdown
    }

def get_tenant_analytics(db: Session) -> Dict[str, Any]:
    """Computes tenant tenure, average stay duration and retention rates."""
    tenants = db.scalars(select(Tenant)).all()
    allocations = db.scalars(select(BedAllocation)).all()

    completed_durations = []
    for a in allocations:
        if a.vacating_date and a.allocation_date:
            try:
                start_d = datetime.strptime(a.allocation_date, "%Y-%m-%d").date()
                end_d = datetime.strptime(a.vacating_date, "%Y-%m-%d").date()
                diff = (end_d - start_d).days
                if diff > 0:
                    completed_durations.append(diff)
            except Exception:
                continue

    avg_stay_days = round(sum(completed_durations) / len(completed_durations)) if completed_durations else 120
    active_count = len([t for t in tenants if t.status == "Active"])
    vacated_count = len([t for t in tenants if t.status == "Vacated"])
    total_ever = active_count + vacated_count
    retention_rate = round((active_count / total_ever * 100), 1) if total_ever > 0 else 100.0

    gender_dist = {"Male": 0, "Female": 0, "Other": 0}
    for t in tenants:
        g = t.gender or "Other"
        gender_dist[g] = gender_dist.get(g, 0) + 1

    return {
        "active_tenants": active_count,
        "vacated_tenants": vacated_count,
        "average_stay_days": avg_stay_days,
        "average_stay_months": round(avg_stay_days / 30, 1),
        "retention_rate": retention_rate,
        "gender_distribution": gender_dist
    }

def get_service_analytics(db: Session) -> Dict[str, Any]:
    """Computes food, parking and utility analytics."""
    food_subs = db.scalars(select(FoodSubscription)).all()
    parking_allocs = db.scalars(select(ParkingAllocation)).all()
    parking_slots = db.scalars(select(ParkingSlot)).all()
    elec_readings = db.scalars(select(ElectricityReading)).all()

    active_food = [fs for fs in food_subs if fs.status == "Active"]
    food_revenue = sum(fs.monthly_price for fs in active_food)

    active_parking = [pa for pa in parking_allocs if pa.status == "Active"]
    total_slots = len(parking_slots) or 10
    parking_utilization = round((len(active_parking) / total_slots * 100), 1) if total_slots > 0 else 0.0

    total_units_consumed = sum(r.units_consumed for r in elec_readings)
    total_elec_billed = sum(r.total_amount for r in elec_readings)

    return {
        "active_food_subscribers": len(active_food),
        "monthly_food_revenue": food_revenue,
        "total_parking_slots": total_slots,
        "occupied_parking_slots": len(active_parking),
        "parking_utilization_rate": parking_utilization,
        "total_kwh_consumed": round(total_units_consumed, 1),
        "total_electricity_billed": round(total_elec_billed, 2)
    }
