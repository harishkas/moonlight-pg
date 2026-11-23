import os
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from .config import RECEIPTS, APP_NAME

def generate_pdf_receipt(
    receipt_number: str,
    payment_number: str,
    payment_date: str,
    tenant_name: str,
    tenant_code: str,
    room_number: str,
    bed_number: str,
    payment_type: str,
    billing_period: str,
    amount_paid: float,
    payment_mode: str,
    transaction_ref: str | None,
    previous_balance: float,
    remaining_balance: float,
    received_by: str = "Administrator"
) -> str:
    """Generates a professional PDF receipt and saves it in data/receipts/."""
    filename = f"{receipt_number}.pdf"
    filepath = RECEIPTS / filename

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
        'ReceiptTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#172b4d'),
        alignment=1 # Center
    )
    sub_title = ParagraphStyle(
        'ReceiptSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748b'),
        alignment=1
    )
    badge_style = ParagraphStyle(
        'ReceiptBadge',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#24865b'),
        alignment=1
    )
    bold_label = ParagraphStyle(
        'BoldLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#334155')
    )
    normal_val = ParagraphStyle(
        'NormalVal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#0f172a')
    )
    currency_highlight = ParagraphStyle(
        'CurrencyHighlight',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#172b4d'),
        alignment=2 # Right
    )

    story = []

    # 1. Header
    story.append(Paragraph(APP_NAME.upper(), title_style))
    story.append(Paragraph("Paying Guest & Hostel Accommodation Management", sub_title))
    story.append(Spacer(1, 10))
    story.append(Paragraph("OFFICIAL PAYMENT RECEIPT", badge_style))
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#172b4d'), spaceAfter=14))

    # 2. Meta info grid (Receipt #, Date, Payment #, Mode)
    meta_data = [
        [
            Paragraph("<b>Receipt Number:</b>", bold_label), Paragraph(receipt_number, normal_val),
            Paragraph("<b>Receipt Date:</b>", bold_label), Paragraph(payment_date, normal_val)
        ],
        [
            Paragraph("<b>Payment Voucher:</b>", bold_label), Paragraph(payment_number, normal_val),
            Paragraph("<b>Payment Mode:</b>", bold_label), Paragraph(f"{payment_mode} ({transaction_ref or 'Direct'})", normal_val)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[110, 160, 110, 160])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # 3. Resident & Accommodation Details
    resident_box_data = [
        [
            Paragraph("<b>Resident Name:</b>", bold_label), Paragraph(tenant_name, normal_val),
            Paragraph("<b>Tenant ID:</b>", bold_label), Paragraph(tenant_code, normal_val)
        ],
        [
            Paragraph("<b>Room Assigned:</b>", bold_label), Paragraph(f"Room {room_number}", normal_val),
            Paragraph("<b>Bed Assigned:</b>", bold_label), Paragraph(bed_number, normal_val)
        ]
    ]
    resident_table = Table(resident_box_data, colWidths=[110, 160, 110, 160])
    resident_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(resident_table)
    story.append(Spacer(1, 16))

    # 4. Transaction Items Table
    tx_headers = [
        Paragraph("<b>Particulars / Payment Category</b>", bold_label),
        Paragraph("<b>Billing Period</b>", bold_label),
        Paragraph("<b>Amount (INR)</b>", ParagraphStyle('RightH', parent=bold_label, alignment=2))
    ]
    tx_row = [
        Paragraph(payment_type, normal_val),
        Paragraph(billing_period or "N/A", normal_val),
        Paragraph(f"Rs. {amount_paid:,.2f}", ParagraphStyle('RightV', parent=normal_val, alignment=2))
    ]
    tx_table = Table([tx_headers, tx_row], colWidths=[240, 150, 150])
    tx_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#edf3fa')),
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, colors.HexColor('#172b4d')),
        ('LINEBELOW', (0, 1), (-1, 1), 1, colors.HexColor('#cbd5e1')),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(tx_table)
    story.append(Spacer(1, 14))

    # 5. Financial Settlement Breakdown
    summary_data = [
        [Paragraph("<b>Previous Balance / Due:</b>", bold_label), Paragraph(f"Rs. {previous_balance:,.2f}", ParagraphStyle('R1', parent=normal_val, alignment=2))],
        [Paragraph("<b>Amount Received:</b>", bold_label), Paragraph(f"Rs. {amount_paid:,.2f}", currency_highlight)],
        [Paragraph("<b>Remaining Outstanding Balance:</b>", bold_label), Paragraph(f"Rs. {remaining_balance:,.2f}", ParagraphStyle('R2', parent=bold_label, alignment=2, textColor=colors.HexColor('#cf3737') if remaining_balance > 0 else colors.HexColor('#24865b')))],
    ]
    summary_table = Table(summary_data, colWidths=[360, 180])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fafbfc')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#f1f5f9')),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 35))

    # 6. Signatures and Verification
    sig_data = [
        [
            Paragraph(f"<b>Received By:</b><br/>{received_by}<br/>Moon Light PG Management", normal_val),
            Paragraph("<b>Authorized Signatory</b><br/><br/>___________________________<br/>Seal & Signature", ParagraphStyle('RightSig', parent=normal_val, alignment=2))
        ]
    ]
    sig_table = Table(sig_data, colWidths=[270, 270])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(sig_table)
    story.append(Spacer(1, 24))

    # 7. Computer Generated Disclaimer
    disclaimer = Paragraph(
        "<i>Note: This is an authentic, computer-generated transaction receipt issued by the Moon Light PG Management System. Keep this receipt for your personal tax and payment records.</i>",
        sub_title
    )
    story.append(disclaimer)

    doc.build(story)
    return filename


def generate_pdf_service_statement(
    statement_number: str,
    statement_date: str,
    tenant_name: str,
    tenant_code: str,
    room_number: str,
    bed_number: str,
    charges: list,
    total_billed: float,
    total_paid: float,
    total_pending: float,
    prepared_by: str = "Administrator"
) -> str:
    """Generates a professional PDF tenant service statement."""
    filename = f"{statement_number}.pdf"
    filepath = RECEIPTS / filename

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
        'StatTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#172b4d'),
        alignment=1
    )
    sub_title = ParagraphStyle(
        'StatSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748b'),
        alignment=1
    )
    bold_lbl = ParagraphStyle('StatBold', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=colors.HexColor('#334155'))
    normal_val = ParagraphStyle('StatVal', parent=styles['Normal'], fontName='Helvetica', fontSize=10, leading=14, textColor=colors.HexColor('#0f172a'))

    story = []

    # 1. Header
    story.append(Paragraph(APP_NAME.upper(), title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("PREMIUM RESIDENTIAL FACILITIES & SERVICES STATEMENT", sub_title))
    story.append(Spacer(1, 14))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284c7'), spaceAfter=14))

    # 2. Meta Table
    meta_data = [
        [
            Paragraph(f"<b>Statement No:</b> {statement_number}", bold_lbl),
            Paragraph(f"<b>Date:</b> {statement_date}", bold_lbl)
        ],
        [
            Paragraph(f"<b>Tenant:</b> {tenant_name} ({tenant_code})", normal_val),
            Paragraph(f"<b>Room / Bed:</b> Room {room_number} | Bed {bed_number}", normal_val)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[270, 270])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 16))

    # 3. Itemized Charges Table
    table_rows = [
        [
            Paragraph("<b>Category</b>", bold_lbl),
            Paragraph("<b>Description / Period</b>", bold_lbl),
            Paragraph("<b>Billed (Rs.)</b>", bold_lbl),
            Paragraph("<b>Paid (Rs.)</b>", bold_lbl),
            Paragraph("<b>Pending (Rs.)</b>", bold_lbl),
            Paragraph("<b>Status</b>", bold_lbl)
        ]
    ]

    for chg in charges:
        status_color = "#16a34a" if chg.get('status') == "Paid" else ("#ea580c" if chg.get('status') == "Partially Paid" else "#dc2626")
        table_rows.append([
            Paragraph(chg.get('category', 'Service'), normal_val),
            Paragraph(f"{chg.get('title', '')} ({chg.get('billing_month')}/{chg.get('billing_year')})", normal_val),
            Paragraph(f"{chg.get('amount', 0.0):,.2f}", normal_val),
            Paragraph(f"{chg.get('amount_paid', 0.0):,.2f}", normal_val),
            Paragraph(f"{chg.get('pending_amount', 0.0):,.2f}", normal_val),
            Paragraph(f"<font color='{status_color}'><b>{chg.get('status', 'Unpaid')}</b></font>", normal_val)
        ])

    # Totals Row
    table_rows.append([
        Paragraph("<b>TOTALS</b>", bold_lbl),
        Paragraph("", normal_val),
        Paragraph(f"<b>{total_billed:,.2f}</b>", bold_lbl),
        Paragraph(f"<b>{total_paid:,.2f}</b>", bold_lbl),
        Paragraph(f"<b>{total_pending:,.2f}</b>", bold_lbl),
        Paragraph("", normal_val)
    ])

    chg_table = Table(table_rows, colWidths=[80, 170, 75, 75, 75, 65])
    chg_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f8fafc')),
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, colors.HexColor('#cbd5e1')),
        ('LINEABOVE', (0, -1), (-1, -1), 1.5, colors.HexColor('#0284c7')),
        ('GRID', (0, 0), (-1, -2), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(chg_table)
    story.append(Spacer(1, 24))

    # 4. Signatures
    sig_data = [
        [
            Paragraph(f"<b>Prepared By:</b><br/>{prepared_by}<br/>Moon Light PG Administration", normal_val),
            Paragraph("<b>Authorized Signatory</b><br/><br/>___________________________<br/>Moon Light PG Management", ParagraphStyle('RightSig2', parent=normal_val, alignment=2))
        ]
    ]
    sig_table = Table(sig_data, colWidths=[270, 270])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(sig_table)
    story.append(Spacer(1, 20))

    story.append(Paragraph(
        "<i>Note: This is an authentic statement generated by the Moon Light PG Management System. For discrepancies, contact the warden/management office.</i>",
        sub_title
    ))

    doc.build(story)
    return filename


