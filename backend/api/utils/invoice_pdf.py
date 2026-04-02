"""
Invoice / Pay Stub PDF generation using ReportLab.

Generates a professional A4 pay stub containing:
  - Company header (name, address)
  - Staff member details
  - Invoice period and reference
  - Line-item table (shifts, bank holidays, annual leave)
  - Subtotals by category
  - Grand total and status
  - Generated timestamp
"""

import io
from datetime import datetime
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


# ---------------------------------------------------------------------------
# Colour palette
# ---------------------------------------------------------------------------
BRAND_DARK = colors.HexColor("#1a1a2e")
BRAND_PRIMARY = colors.HexColor("#16213e")
BRAND_ACCENT = colors.HexColor("#0f3460")
HEADER_BG = colors.HexColor("#1a1a2e")
ROW_ALT = colors.HexColor("#f4f6f9")
BORDER_COLOR = colors.HexColor("#d1d5db")
STATUS_COLORS = {
    "pending": colors.HexColor("#f59e0b"),
    "paid": colors.HexColor("#10b981"),
    "rejected": colors.HexColor("#ef4444"),
}


def _currency(value):
    """Format a Decimal / float as GBP currency string."""
    try:
        return f"\u00a3{Decimal(str(value)):,.2f}"
    except Exception:
        return "\u00a30.00"


def _safe_str(value, default=""):
    """Return str(value) or *default* when value is None / empty."""
    if value is None:
        return default
    s = str(value).strip()
    return s if s else default


def generate_invoice_pdf(invoice) -> io.BytesIO:
    """Generate an A4 pay-stub PDF for the given ``Invoice`` instance.

    Parameters
    ----------
    invoice : api.models.Invoice
        The invoice ORM object (must have ``.items`` related manager,
        ``.staff_user``, and ``.get_payment_breakdown()``).

    Returns
    -------
    io.BytesIO
        A seeked-to-zero buffer containing the PDF bytes.
    """

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        title=f"Pay Stub - Invoice #{invoice.id}",
    )

    styles = getSampleStyleSheet()

    # ------------------------------------------------------------------
    # Custom styles
    # ------------------------------------------------------------------
    s_company = ParagraphStyle(
        "CompanyName",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        textColor=colors.white,
        spaceAfter=2 * mm,
    )
    s_company_sub = ParagraphStyle(
        "CompanySub",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#cbd5e1"),
    )
    s_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=11,
        leading=14,
        textColor=BRAND_DARK,
        spaceBefore=6 * mm,
        spaceAfter=3 * mm,
    )
    s_label = ParagraphStyle(
        "Label",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#6b7280"),
    )
    s_value = ParagraphStyle(
        "Value",
        parent=styles["Normal"],
        fontSize=10,
        leading=13,
        textColor=BRAND_DARK,
    )
    s_total_label = ParagraphStyle(
        "TotalLabel",
        parent=styles["Normal"],
        fontSize=11,
        leading=14,
        textColor=BRAND_DARK,
        fontName="Helvetica-Bold",
    )
    s_total_value = ParagraphStyle(
        "TotalValue",
        parent=styles["Normal"],
        fontSize=13,
        leading=16,
        textColor=BRAND_DARK,
        fontName="Helvetica-Bold",
        alignment=TA_RIGHT,
    )
    s_footer = ParagraphStyle(
        "Footer",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#9ca3af"),
        alignment=TA_CENTER,
    )

    elements = []

    # ------------------------------------------------------------------
    # Resolve company
    # ------------------------------------------------------------------
    company = None
    membership = invoice.staff_user.company_memberships.filter(is_active=True).first()
    if membership:
        company = membership.company

    company_name = _safe_str(getattr(company, "name", None), "Security Company")
    company_address_parts = []
    if company:
        if company.address_line_1:
            company_address_parts.append(company.address_line_1)
        if getattr(company, "address_line_2", None):
            company_address_parts.append(company.address_line_2)
        city_line = ", ".join(
            filter(None, [
                _safe_str(getattr(company, "city", None)),
                _safe_str(getattr(company, "state_province", None)),
                _safe_str(getattr(company, "postal_code", None)),
            ])
        )
        if city_line:
            company_address_parts.append(city_line)
        if getattr(company, "registration_number", None):
            company_address_parts.append(f"Reg: {company.registration_number}")
        if getattr(company, "tax_id", None):
            company_address_parts.append(f"VAT: {company.tax_id}")

    company_address = " | ".join(company_address_parts) if company_address_parts else ""

    # ------------------------------------------------------------------
    # Header banner
    # ------------------------------------------------------------------
    header_data = [
        [
            Paragraph(company_name, s_company),
            Paragraph("PAY STUB", ParagraphStyle(
                "PayStubTitle",
                parent=styles["Heading1"],
                fontSize=16,
                leading=20,
                textColor=colors.white,
                alignment=TA_RIGHT,
            )),
        ],
    ]
    if company_address:
        header_data.append([
            Paragraph(company_address, s_company_sub),
            "",
        ])

    header_table = Table(header_data, colWidths=[120 * mm, 60 * mm])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HEADER_BG),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5 * mm),
        ("SPAN", (0, 1), (1, 1)) if company_address else ("TOPPADDING", (0, 0), (0, 0), 5 * mm),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 5 * mm))

    # ------------------------------------------------------------------
    # Invoice meta + staff details (two-column)
    # ------------------------------------------------------------------
    staff_user = invoice.staff_user
    staff_name = f"{staff_user.first_name} {staff_user.last_name}".strip()
    if not staff_name:
        staff_name = staff_user.username

    staff_profile = getattr(staff_user, "profile", None)
    employee_id = ""
    if staff_profile:
        employee_id = _safe_str(getattr(staff_profile, "employee_id", None))

    status_color = STATUS_COLORS.get(invoice.status, colors.gray)
    status_text = invoice.get_status_display() if hasattr(invoice, "get_status_display") else invoice.status.title()

    left_col = [
        [Paragraph("EMPLOYEE", s_label), ""],
        [Paragraph(staff_name, s_value), ""],
    ]
    if employee_id:
        left_col.append([Paragraph(f"ID: {employee_id}", s_label), ""])
    if staff_user.email:
        left_col.append([Paragraph(staff_user.email, s_label), ""])

    right_col = [
        [Paragraph("INVOICE REF", s_label), Paragraph(f"#{invoice.id}", s_value)],
        [Paragraph("PERIOD", s_label), Paragraph(
            f"{invoice.start_date.strftime('%d %b %Y')} \u2013 {invoice.end_date.strftime('%d %b %Y')}", s_value
        )],
        [Paragraph("STATUS", s_label), Paragraph(
            f'<font color="{status_color.hexval()}">{status_text}</font>', s_value
        )],
        [Paragraph("ISSUED", s_label), Paragraph(
            invoice.created_at.strftime("%d %b %Y") if invoice.created_at else "N/A", s_value
        )],
    ]

    left_table = Table(left_col, colWidths=[80 * mm, 10 * mm])
    left_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))

    right_table = Table(right_col, colWidths=[30 * mm, 60 * mm])
    right_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))

    meta_table = Table(
        [[left_table, right_table]],
        colWidths=[95 * mm, 85 * mm],
    )
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 4 * mm))

    # ------------------------------------------------------------------
    # Line items table
    # ------------------------------------------------------------------
    elements.append(Paragraph("LINE ITEMS", s_heading))

    items_qs = invoice.items.select_related("shift", "venue", "bank_holiday").order_by("date", "item_type")

    col_widths = [22 * mm, 16 * mm, 58 * mm, 22 * mm, 22 * mm, 28 * mm]
    header_style = ParagraphStyle("TH", parent=styles["Normal"], fontSize=8, leading=10, textColor=colors.white, fontName="Helvetica-Bold")
    cell_style = ParagraphStyle("TD", parent=styles["Normal"], fontSize=8, leading=11, textColor=BRAND_DARK)
    cell_right = ParagraphStyle("TDR", parent=cell_style, alignment=TA_RIGHT)

    table_data = [[
        Paragraph("Date", header_style),
        Paragraph("Type", header_style),
        Paragraph("Description", header_style),
        Paragraph("Qty", header_style),
        Paragraph("Rate", header_style),
        Paragraph("Amount", header_style),
    ]]

    for item in items_qs:
        date_str = item.date.strftime("%d/%m/%Y") if item.date else ""

        if item.item_type == "shift":
            type_label = "Shift"
            venue_name = _safe_str(getattr(item.venue, "name", None), "—")
            description = venue_name
            if item.shift and item.shift.is_special_event:
                type_label = "Event"
                description = f"{venue_name} (Special Event)"
            qty = f"{item.hours_worked or 0:.2f} hrs"
            rate = f"{_currency(item.rate)}/hr"
        elif item.item_type == "bank_holiday":
            type_label = "BH"
            description = _safe_str(item.description, "Bank Holiday")
            qty = f"{item.days or 1:.1f} day(s)"
            rate = f"{_currency(item.rate)}/day"
        elif item.item_type == "annual_leave":
            type_label = "Leave"
            description = _safe_str(item.description, "Annual Leave")
            qty = f"{item.days or 1:.1f} day(s)"
            rate = f"{_currency(item.rate)}/day"
        else:
            type_label = item.item_type
            description = _safe_str(item.description, "—")
            qty = ""
            rate = ""

        table_data.append([
            Paragraph(date_str, cell_style),
            Paragraph(type_label, cell_style),
            Paragraph(description, cell_style),
            Paragraph(qty, cell_right),
            Paragraph(rate, cell_right),
            Paragraph(_currency(item.amount), cell_right),
        ])

    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    t_style_cmds = [
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        # All cells
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
        # Grid
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("LINEBELOW", (0, 0), (-1, 0), 1, BRAND_DARK),
    ]
    # Alternate row shading
    for i in range(1, len(table_data)):
        if i % 2 == 0:
            t_style_cmds.append(("BACKGROUND", (0, i), (-1, i), ROW_ALT))

    items_table.setStyle(TableStyle(t_style_cmds))
    elements.append(items_table)
    elements.append(Spacer(1, 5 * mm))

    # ------------------------------------------------------------------
    # Breakdown summary
    # ------------------------------------------------------------------
    breakdown = invoice.get_payment_breakdown()

    summary_rows = []
    s_sum_label = ParagraphStyle("SumL", parent=styles["Normal"], fontSize=9, leading=12, textColor=BRAND_DARK)
    s_sum_val = ParagraphStyle("SumV", parent=styles["Normal"], fontSize=9, leading=12, textColor=BRAND_DARK, alignment=TA_RIGHT)

    reg = breakdown.get("regular_shifts", {})
    if reg.get("count", 0) > 0:
        summary_rows.append([
            Paragraph(f"Regular Shifts ({reg['count']} shifts, {reg['hours']:.2f} hrs @ avg {_currency(reg['average_rate'])}/hr)", s_sum_label),
            Paragraph(_currency(reg["amount"]), s_sum_val),
        ])

    spe = breakdown.get("special_event_shifts", {})
    if spe.get("count", 0) > 0:
        summary_rows.append([
            Paragraph(f"Special Event Shifts ({spe['count']} shifts, {spe['hours']:.2f} hrs @ avg {_currency(spe['average_rate'])}/hr)", s_sum_label),
            Paragraph(_currency(spe["amount"]), s_sum_val),
        ])

    bh = breakdown.get("bank_holidays", {})
    if bh.get("count", 0) > 0:
        summary_rows.append([
            Paragraph(f"Bank Holiday Pay ({bh['count']} days @ {_currency(bh['daily_rate'])}/day)", s_sum_label),
            Paragraph(_currency(bh["amount"]), s_sum_val),
        ])

    al = breakdown.get("annual_leave", {})
    if al.get("count", 0) > 0:
        summary_rows.append([
            Paragraph(f"Annual Leave Pay ({al['count']} days @ {_currency(al['daily_rate'])}/day)", s_sum_label),
            Paragraph(_currency(al["amount"]), s_sum_val),
        ])

    if summary_rows:
        elements.append(Paragraph("PAYMENT BREAKDOWN", s_heading))
        summary_table = Table(summary_rows, colWidths=[140 * mm, 28 * mm])
        summary_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
            ("LINEBELOW", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 3 * mm))

    # ------------------------------------------------------------------
    # Grand total
    # ------------------------------------------------------------------
    total_data = [[
        Paragraph("TOTAL PAYABLE", s_total_label),
        Paragraph(_currency(invoice.total_amount), s_total_value),
    ]]
    total_table = Table(total_data, colWidths=[140 * mm, 28 * mm])
    total_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdf4") if invoice.status == "paid" else colors.HexColor("#fefce8")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOX", (0, 0), (-1, -1), 1, BRAND_DARK),
    ]))
    elements.append(total_table)
    elements.append(Spacer(1, 8 * mm))

    # ------------------------------------------------------------------
    # Footer
    # ------------------------------------------------------------------
    generated_at = datetime.now().strftime("%d %b %Y at %H:%M")
    footer_text = (
        f"Generated on {generated_at} | "
        f"Invoice version {invoice.version or 1} | "
        f"This document is for payroll purposes only."
    )
    elements.append(Paragraph(footer_text, s_footer))

    # Build
    doc.build(elements)
    buf.seek(0)
    return buf
