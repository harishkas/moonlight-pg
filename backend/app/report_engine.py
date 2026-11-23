import json, os, csv, io
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Dict, Any
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from .config import REPORTS, APP_NAME
from .models import (
    Tenant, Room, Bed, BedAllocation, RentInvoice, Payment,
    Expense, FoodSubscription, ParkingAllocation, ReportHistory
)

def generate_daily_report_data(db: Session, target_date: str) -> Dict[str, Any]:
    """Compiles operational activity for a single calendar day."""
    new_tenants = db.scalars(
        select(Tenant).where(Tenant.joining_date == target_date)
    ).all()

    vacated_allocs = db.scalars(
        select(BedAllocation).where(BedAllocation.vacating_date == target_date)
    ).all()

    payments_today = db.scalars(
        select(Payment).where(Payment.payment_date == target_date, Payment.is_cancelled == False)
    ).all()

    rent_collected = sum(p.amount for p in payments_today if p.payment_type == "Monthly Rent")
    other_collected = sum(p.amount for p in payments_today if p.payment_type != "Monthly Rent")

    expenses_today = db.scalars(
        select(Expense).where(Expense.expense_date == target_date, Expense.is_deleted == False)
    ).all()
    total_expenses = sum(e.amount for e in expenses_today)

    total_beds = db.scalar(select(func.count(Bed.id))) or 0
    occupied_beds = db.scalar(select(func.count(Bed.id)).where(Bed.status == "Occupied")) or 0
    available_beds = db.scalar(select(func.count(Bed.id)).where(Bed.status == "Available")) or 0
    occupancy_rate = round((occupied_beds / total_beds * 100), 1) if total_beds > 0 else 0.0

    return {
        "report_date": target_date,
        "new_tenants_count": len(new_tenants),
        "new_tenants_names": [t.full_name for t in new_tenants],
        "vacated_count": len(vacated_allocs),
        "rent_collected": rent_collected,
        "other_payments_collected": other_collected,
        "total_revenue": rent_collected + other_collected,
        "total_expenses": total_expenses,
        "net_cash_flow": (rent_collected + other_collected) - total_expenses,
        "total_beds": total_beds,
        "occupied_beds": occupied_beds,
        "available_beds": available_beds,
        "occupancy_rate": occupancy_rate,
        "payments_list": [
            {"num": p.payment_number, "tenant_id": p.tenant_id, "amount": p.amount, "type": p.payment_type, "mode": p.payment_mode}
            for p in payments_today
        ],
        "expenses_list": [
            {"num": e.expense_number, "category": e.category, "amount": e.amount, "vendor": e.paid_to}
            for e in expenses_today
        ]
    }

def generate_weekly_report_data(db: Session, start_date: str, end_date: str) -> Dict[str, Any]:
    """Compiles weekly financial and operational metrics."""
    payments = db.scalars(
        select(Payment).where(
            Payment.payment_date >= start_date,
            Payment.payment_date <= end_date,
            Payment.is_cancelled == False
        )
    ).all()

    rent_collected = sum(p.amount for p in payments if p.payment_type == "Monthly Rent")
    other_collected = sum(p.amount for p in payments if p.payment_type != "Monthly Rent")

    expenses = db.scalars(
        select(Expense).where(
            Expense.expense_date >= start_date,
            Expense.expense_date <= end_date,
            Expense.is_deleted == False
        )
    ).all()
    total_expenses = sum(e.amount for e in expenses)

    new_tenants = db.scalars(
        select(Tenant).where(Tenant.joining_date >= start_date, Tenant.joining_date <= end_date)
    ).all()

    vacated_allocs = db.scalars(
        select(BedAllocation).where(BedAllocation.vacating_date >= start_date, BedAllocation.vacating_date <= end_date)
    ).all()

    unpaid_invoices = db.scalars(
        select(RentInvoice).where(RentInvoice.status.in_(["Unpaid", "Partially Paid", "Overdue"]))
    ).all()
    outstanding_rent = sum(i.pending_amount for i in unpaid_invoices)

    active_food = db.scalar(select(func.count(FoodSubscription.id)).where(FoodSubscription.status == "Active")) or 0

    return {
        "start_date": start_date,
        "end_date": end_date,
        "rent_collected": rent_collected,
        "other_collected": other_collected,
        "total_revenue": rent_collected + other_collected,
        "total_expenses": total_expenses,
        "net_operating_income": (rent_collected + other_collected) - total_expenses,
        "new_tenants_count": len(new_tenants),
        "vacated_tenants_count": len(vacated_allocs),
        "outstanding_rent_dues": outstanding_rent,
        "active_food_subscriptions": active_food
    }

def generate_monthly_report_data(db: Session, month: int, year: int) -> Dict[str, Any]:
    """Compiles complete monthly operating, revenue, and expense summary."""
    m_prefix = f"{year}-{month:02d}"

    invoices = db.scalars(
        select(RentInvoice).where(RentInvoice.billing_month == month, RentInvoice.billing_year == year)
    ).all()

    rent_expected = sum(i.total_amount for i in invoices)
    rent_collected = sum(i.amount_paid for i in invoices)
    rent_pending = sum(i.pending_amount for i in invoices)

    payments = db.scalars(
        select(Payment).where(Payment.payment_date.startswith(m_prefix), Payment.is_cancelled == False)
    ).all()
    total_revenue_collected = sum(p.amount for p in payments)

    # Food revenue
    food_payments = sum(p.amount for p in payments if p.payment_type == "Food Charges")
    service_payments = sum(p.amount for p in payments if p.payment_type not in ["Monthly Rent", "Food Charges", "Security Deposit"])

    expenses = db.scalars(
        select(Expense).where(Expense.expense_date.startswith(m_prefix), Expense.is_deleted == False)
    ).all()
    total_expenses = sum(e.amount for e in expenses)

    # Expense category breakdown
    cat_breakdown: Dict[str, float] = {}
    for e in expenses:
        cat_breakdown[e.category] = cat_breakdown.get(e.category, 0.0) + e.amount

    net_operating_income = round(total_revenue_collected - total_expenses, 2)
    collection_rate = round((rent_collected / rent_expected * 100), 1) if rent_expected > 0 else 0.0

    total_beds = db.scalar(select(func.count(Bed.id))) or 0
    occupied_beds = db.scalar(select(func.count(Bed.id)).where(Bed.status == "Occupied")) or 0
    occupancy_rate = round((occupied_beds / total_beds * 100), 1) if total_beds > 0 else 0.0

    new_tenants = db.scalar(
        select(func.count(Tenant.id)).where(Tenant.joining_date.startswith(m_prefix))
    ) or 0

    vacated_tenants = db.scalar(
        select(func.count(BedAllocation.id)).where(BedAllocation.vacating_date.startswith(m_prefix))
    ) or 0

    return {
        "billing_month": month,
        "billing_year": year,
        "month_label": datetime(year, month, 1).strftime("%B %Y"),
        "rent_expected": rent_expected,
        "rent_collected": rent_collected,
        "rent_pending": rent_pending,
        "total_revenue_collected": total_revenue_collected,
        "food_revenue": food_payments,
        "service_revenue": service_payments,
        "total_expenses": total_expenses,
        "net_operating_income": net_operating_income,
        "collection_rate": collection_rate,
        "occupancy_rate": occupancy_rate,
        "new_tenants": new_tenants,
        "vacated_tenants": vacated_tenants,
        "expense_category_breakdown": cat_breakdown
    }

def save_report_history(
    db: Session,
    report_type: str,
    title: str,
    start_d: str,
    end_d: str,
    data: Dict[str, Any]
) -> ReportHistory:
    """Stores generated report record in the database."""
    rep = ReportHistory(
        report_type=report_type,
        report_title=title,
        start_date=start_d,
        end_date=end_d,
        generated_by="System Automated",
        summary_json=json.dumps(data)
    )
    db.add(rep)
    db.commit()
    db.refresh(rep)
    return rep

def build_report_pdf(report: ReportHistory, data: Dict[str, Any]) -> Path:
    """Generates a professional PDF document for the specified report."""
    filename = f"report_{report.report_type.lower()}_{report.id}_{datetime.now().strftime('%Y%m%d')}.pdf"
    filepath = REPORTS / filename

    doc = SimpleDocTemplate(
        str(filepath),
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'RepTitle', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=colors.HexColor('#172b4d')
    )
    sub_style = ParagraphStyle(
        'RepSub', parent=styles['Normal'],
        fontName='Helvetica', fontSize=10, leading=14, textColor=colors.HexColor('#64748b')
    )
    cell_bold = ParagraphStyle(
        'CellBold', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=12
    )
    cell_norm = ParagraphStyle(
        'CellNorm', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=12
    )

    elements = []
    elements.append(Paragraph(f"{APP_NAME} — {report.report_title}", title_style))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(f"Period: {report.start_date} to {report.end_date} | Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", sub_style))
    elements.append(Spacer(1, 12))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#cbd5e1'), spaceBefore=2, spaceAfter=12))

    # KPI Table
    kpi_rows = [["Metric", "Value"]]
    if report.report_type == "Daily":
        kpi_rows.extend([
            ["Date", str(data.get("report_date"))],
            ["Rent Collected Today", f"Rs. {data.get('rent_collected', 0):,.2f}"],
            ["Other Collections Today", f"Rs. {data.get('other_payments_collected', 0):,.2f}"],
            ["Total Revenue Today", f"Rs. {data.get('total_revenue', 0):,.2f}"],
            ["Total Expenses Today", f"Rs. {data.get('total_expenses', 0):,.2f}"],
            ["Net Daily Cash Flow", f"Rs. {data.get('net_cash_flow', 0):,.2f}"],
            ["Occupancy Rate", f"{data.get('occupancy_rate', 0)}% ({data.get('occupied_beds')}/{data.get('total_beds')} Beds)"],
            ["New Tenant Registrations", str(data.get("new_tenants_count", 0))],
            ["Tenant Vacates Today", str(data.get("vacated_count", 0))]
        ])
    elif report.report_type == "Weekly":
        kpi_rows.extend([
            ["Rent Collected (Week)", f"Rs. {data.get('rent_collected', 0):,.2f}"],
            ["Total Weekly Revenue", f"Rs. {data.get('total_revenue', 0):,.2f}"],
            ["Total Weekly Expenses", f"Rs. {data.get('total_expenses', 0):,.2f}"],
            ["Net Operating Income (NOI)", f"Rs. {data.get('net_operating_income', 0):,.2f}"],
            ["Outstanding Rent Dues", f"Rs. {data.get('outstanding_rent_dues', 0):,.2f}"],
            ["New Tenants Joined", str(data.get("new_tenants_count", 0))],
            ["Tenants Vacated", str(data.get("vacated_tenants_count", 0))]
        ])
    else: # Monthly
        kpi_rows.extend([
            ["Billing Month", str(data.get("month_label"))],
            ["Total Rent Expected", f"Rs. {data.get('rent_expected', 0):,.2f}"],
            ["Total Rent Collected", f"Rs. {data.get('rent_collected', 0):,.2f}"],
            ["Total Rent Pending", f"Rs. {data.get('rent_pending', 0):,.2f}"],
            ["Total Revenue Collected", f"Rs. {data.get('total_revenue_collected', 0):,.2f}"],
            ["Operating Expenses", f"Rs. {data.get('total_expenses', 0):,.2f}"],
            ["Net Operating Income (NOI)", f"Rs. {data.get('net_operating_income', 0):,.2f}"],
            ["Rent Collection Rate", f"{data.get('collection_rate', 0)}%"],
            ["End of Month Occupancy", f"{data.get('occupancy_rate', 0)}%"]
        ])

    table_data = [[Paragraph(c, cell_bold) if r_idx == 0 else Paragraph(c, cell_norm) for c in row] for r_idx, row in enumerate(kpi_rows)]
    t = Table(table_data, colWidths=[240, 300])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#172b4d')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("Report verified by Moon Light PG Automation System.", sub_style))

    doc.build(elements)
    report.pdf_filename = filename
    return filepath

def build_report_csv(report: ReportHistory, data: Dict[str, Any]) -> str:
    """Generates tabular CSV data string for the report."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Report Title", report.report_title])
    writer.writerow(["Report Type", report.report_type])
    writer.writerow(["Start Date", report.start_date])
    writer.writerow(["End Date", report.end_date])
    writer.writerow(["Generated At", datetime.now().isoformat()])
    writer.writerow([])
    writer.writerow(["Metric", "Value"])

    for k, v in data.items():
        if not isinstance(v, (list, dict)):
            writer.writerow([k.replace("_", " ").title(), v])

    return output.getvalue()
