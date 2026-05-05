"""
Invoice / payslip PDF generation using ReportLab.

Visual language matches the React `ModernInvoice` template (red brand accent,
hero header with the total, three-column FROM/PAY TO/SERVICE PERIOD block,
modern line-item table, right-aligned totals card). Edit both files together
when the design evolves so admin UI and printed payslip stay in sync.
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
from reportlab.platypus.flowables import Flowable


# --- Brand palette (matches frontend/src/design-system/accents.ts brand-red) -
ACCENT_PRIMARY = colors.HexColor("#cb2431")
ACCENT_DARK = colors.HexColor("#991b25")
ACCENT_SOFT = colors.HexColor("#fde7e9")
INK900 = colors.HexColor("#201f1e")
INK600 = colors.HexColor("#605e5c")
INK500 = colors.HexColor("#a19f9d")
BG_100 = colors.HexColor("#faf9f8")
BORDER = colors.HexColor("#edebe9")
SUCCESS_INK = colors.HexColor("#0e6b3a")


def _gbp(value):
    try:
        return f"£{Decimal(str(value)):,.2f}"
    except Exception:
        return "£0.00"


def _safe(value, default=""):
    if value is None:
        return default
    s = str(value).strip()
    return s if s else default


def _date_short(d):
    return d.strftime("%d %b") if d else ""


def _date_long(d):
    return d.strftime("%d %b %Y") if d else ""


class PaidStamp(Flowable):
    """Translucent diagonal "PAID" watermark for paid invoices."""

    def __init__(self, text="PAID"):
        super().__init__()
        self.text = text
        self.width = 0
        self.height = 0

    def draw(self):
        c = self.canv
        c.saveState()
        # Position over the hero. Coordinates are local to the flowable; we
        # offset back into the page above via translate.
        c.translate(140 * mm, -10 * mm)
        c.rotate(-18)
        c.setFillColorRGB(0.80, 0.13, 0.18, alpha=0.18)
        c.setFont("Helvetica-Bold", 56)
        c.drawString(0, 0, self.text)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(8, -8 * mm, "T H A N K   Y O U")
        c.restoreState()


def generate_invoice_pdf(invoice) -> io.BytesIO:
    """Render the modern payslip PDF for an Invoice and return a BytesIO."""

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=0,
        rightMargin=0,
        topMargin=0,
        bottomMargin=0,
        title=f"Payslip {invoice.invoice_number or invoice.pk}",
    )

    styles = getSampleStyleSheet()

    # --- Style primitives ---------------------------------------------------
    s_company = ParagraphStyle(
        "Company", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=INK900,
    )
    s_amount = ParagraphStyle(
        "Amount", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=30, leading=32, textColor=INK900,
    )
    s_caption = ParagraphStyle(
        "Caption", parent=styles["Normal"],
        fontSize=10, leading=13, textColor=INK600,
    )
    s_caption_paid = ParagraphStyle(
        "CaptionPaid", parent=s_caption, textColor=SUCCESS_INK, fontName="Helvetica-Bold",
    )
    s_label = ParagraphStyle(
        "Label", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=7.5, leading=10, textColor=INK500,
        spaceAfter=4,
    )
    s_value_strong = ParagraphStyle(
        "ValueStrong", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=INK900,
    )
    s_value = ParagraphStyle(
        "Value", parent=styles["Normal"],
        fontSize=9, leading=12, textColor=INK600,
    )
    s_invoice_pill = ParagraphStyle(
        "InvoicePill", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=INK600,
        alignment=TA_RIGHT,
    )
    s_invoice_id = ParagraphStyle(
        "InvoiceId", parent=styles["Normal"],
        fontName="Courier-Bold", fontSize=11, leading=14, textColor=INK900,
        alignment=TA_RIGHT,
    )
    s_th = ParagraphStyle(
        "TH", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=7.5, leading=10, textColor=INK600,
    )
    s_th_right = ParagraphStyle("THr", parent=s_th, alignment=TA_RIGHT)
    s_td = ParagraphStyle("TD", parent=styles["Normal"], fontSize=9, leading=12, textColor=INK900)
    s_td_muted = ParagraphStyle("TDm", parent=s_td, textColor=INK600)
    s_td_right = ParagraphStyle("TDr", parent=s_td, alignment=TA_RIGHT)
    s_td_right_muted = ParagraphStyle("TDrm", parent=s_td_muted, alignment=TA_RIGHT)
    s_td_right_bold = ParagraphStyle("TDrb", parent=s_td_right, fontName="Helvetica-Bold")
    s_total_label = ParagraphStyle(
        "TotalLabel", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=INK900,
    )
    s_total_value = ParagraphStyle(
        "TotalValue", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=ACCENT_PRIMARY,
        alignment=TA_RIGHT,
    )
    s_footer = ParagraphStyle(
        "Footer", parent=styles["Normal"],
        fontSize=7, leading=10, textColor=INK500, alignment=TA_CENTER,
    )

    elements = []

    # --- Resolve display values --------------------------------------------
    company = None
    membership = invoice.staff_user.company_memberships.filter(is_active=True).first()
    if membership:
        company = membership.company
    company_name = _safe(getattr(company, "name", None), "Mead Security")
    company_address = []
    if company:
        for attr in ("address_line_1", "address_line_2"):
            val = _safe(getattr(company, attr, None))
            if val:
                company_address.append(val)
        city_line = ", ".join(filter(None, [
            _safe(getattr(company, "city", None)),
            _safe(getattr(company, "postal_code", None)),
        ]))
        if city_line:
            company_address.append(city_line)
        if getattr(company, "country", None):
            company_address.append(getattr(company, "country"))

    staff = invoice.staff_user
    staff_name = (f"{staff.first_name} {staff.last_name}".strip()) or staff.username
    staff_role = "Officer"
    staff_profile = getattr(staff, "profile", None)
    staff_utr = ""
    if staff_profile:
        staff_utr = _safe(getattr(staff_profile, "utr_number", None))

    invoice_id = invoice.invoice_number or f"PAY-{invoice.pk}"
    period = f"{_date_short(invoice.start_date)} – {_date_short(invoice.end_date)}"
    issue_date = _date_long(invoice.created_at) if invoice.created_at else "—"

    is_paid = invoice.status == "paid"
    is_overdue = invoice.status == "overdue"

    # Status caption shown under the total amount.
    if is_paid and invoice.paid_date:
        status_caption = Paragraph(f"Paid on {_date_long(invoice.paid_date)}", s_caption_paid)
    elif invoice.status == "draft":
        status_caption = Paragraph("Draft · ready for review", s_caption)
    elif is_overdue and invoice.due_date:
        status_caption = Paragraph(f"Overdue · due {_date_long(invoice.due_date)}", s_caption)
    elif invoice.due_date:
        status_caption = Paragraph(f"Due {_date_long(invoice.due_date)}", s_caption)
    else:
        status_caption = Paragraph(invoice.status.title(), s_caption)

    # ---  HERO HEADER  -----------------------------------------------------
    hero_left = Table(
        [
            [Paragraph(f"◆ &nbsp; {company_name}", s_company)],
            [Spacer(1, 4 * mm)],
            [Paragraph(_gbp(invoice.total_amount), s_amount)],
            [status_caption],
        ],
        colWidths=[110 * mm],
    )
    hero_left.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    invoice_pill = Table(
        [[Paragraph("INVOICE", s_invoice_pill)]],
        colWidths=[24 * mm],
    )
    invoice_pill.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))

    hero_right = Table(
        [
            [invoice_pill],
            [Spacer(1, 2 * mm)],
            [Paragraph(invoice_id, s_invoice_id)],
            [Paragraph(f"Issued {issue_date}", ParagraphStyle("IssuedSm", parent=s_caption, alignment=TA_RIGHT))],
        ],
        colWidths=[60 * mm],
    )
    hero_right.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
    ]))

    hero = Table(
        [[hero_left, hero_right]],
        colWidths=[110 * mm, 70 * mm],
    )
    hero_style = [
        ("BACKGROUND", (0, 0), (-1, -1), ACCENT_SOFT),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 16 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 16 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 14 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12 * mm),
        # 4px-equivalent accent line under the hero
        ("LINEBELOW", (0, 0), (-1, -1), 2.5, ACCENT_PRIMARY),
    ]
    hero.setStyle(TableStyle(hero_style))
    elements.append(hero)

    # Paid stamp watermark, sits on top of the hero.
    if is_paid:
        elements.append(PaidStamp())

    elements.append(Spacer(1, 8 * mm))

    # --- Three-column meta block: FROM | PAY TO | SERVICE PERIOD ----------
    def meta_column(label, lines):
        rows = [[Paragraph(label.upper(), s_label)]]
        if lines:
            rows.append([Paragraph(lines[0], s_value_strong)])
            for ln in lines[1:]:
                rows.append([Paragraph(ln, s_value)])
        t = Table(rows, colWidths=[55 * mm])
        t.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        return t

    from_lines = [company_name] + company_address
    pay_to_lines = [staff_name, staff_role]
    if staff_utr:
        pay_to_lines.append(f"UTR {staff_utr}")
    if staff.email:
        pay_to_lines.append(staff.email)
    period_lines = [
        period,
        f"{invoice.total_hours or 0:.2f} hours · {invoice.items.count()} line items",
    ]

    meta = Table(
        [[
            meta_column("From", from_lines),
            meta_column("Pay to", pay_to_lines),
            meta_column("Service period", period_lines),
        ]],
        colWidths=[60 * mm, 60 * mm, 60 * mm],
    )
    meta.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 16 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    elements.append(meta)
    elements.append(Spacer(1, 8 * mm))

    # --- Line items table -------------------------------------------------
    type_label = {
        "shift": "Shift",
        "overtime_1": "OT 1.5×",
        "overtime_2": "OT 2×",
        "bank_holiday": "Bank holiday",
        "annual_leave": "Annual leave",
        "special": "Special event",
    }

    items = list(invoice.items.select_related("shift", "venue").order_by("date", "id"))
    table_data = [[
        Paragraph("DATE", s_th),
        Paragraph("DESCRIPTION", s_th),
        Paragraph("HRS", s_th_right),
        Paragraph("RATE", s_th_right),
        Paragraph("AMOUNT", s_th_right),
    ]]
    for it in items:
        venue_name = _safe(getattr(it.venue, "name", None) if it.venue else None, "")
        type_str = type_label.get(it.item_type, it.item_type)
        if it.item_type in ("shift", "overtime_1", "overtime_2", "special"):
            primary = f"{type_str} · {venue_name}" if venue_name else type_str
        else:
            primary = type_str
        desc_html = f"<b>{primary}</b>"
        if venue_name and it.item_type not in ("shift", "overtime_1", "overtime_2", "special"):
            desc_html += f"<br/><font color='#a19f9d' size='8'>{venue_name}</font>"

        if it.hours_worked is not None:
            qty = f"{it.hours_worked:.2f}"
        elif it.days is not None:
            qty = f"{it.days:.1f}d"
        else:
            qty = ""
        rate = _gbp(it.rate) if it.rate else ""
        table_data.append([
            Paragraph(_date_short(it.date), s_td_muted),
            Paragraph(desc_html, s_td),
            Paragraph(qty, s_td_right),
            Paragraph(rate, s_td_right_muted),
            Paragraph(_gbp(it.amount), s_td_right_bold),
        ])

    items_table = Table(
        table_data,
        colWidths=[20 * mm, 84 * mm, 18 * mm, 22 * mm, 24 * mm],
        repeatRows=1,
    )
    style_cmds = [
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), BG_100),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, BORDER),
        # All cells
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
        # Box around the whole table for rounded-card feel
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
    ]
    # Inner row dividers
    for i in range(1, len(table_data) - 1):
        style_cmds.append(("LINEBELOW", (0, i), (-1, i), 0.3, BG_100))

    items_table.setStyle(TableStyle(style_cmds))

    # Wrap in a left-margin Table to inset by 16mm.
    body_wrap = Table([[items_table]], colWidths=[168 * mm])
    body_wrap.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 16 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 16 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(body_wrap)
    elements.append(Spacer(1, 6 * mm))

    # --- Bottom row: bank details (left) + totals card (right) ------------
    # For a staff payslip the BANK block describes WHERE THE OFFICER GETS PAID
    # (their personal bank account). We read it from BankDetails which is a
    # OneToOne on StaffProfile. Encrypted fields decrypt automatically.
    staff_bank = None
    if staff_profile is not None:
        staff_bank = getattr(staff_profile, 'bank_details', None)

    if staff_bank:
        bank_label_text = "PAY INTO"
        bank_lines = [
            _safe(staff_bank.bank_name),
            f"Sort {staff_bank.sort_code} · Acc {staff_bank.account_number}",
        ]
        if staff_bank.account_name:
            bank_lines.append(f"Account name: {staff_bank.account_name}")
    else:
        bank_label_text = "PAY INTO"
        bank_lines = ["Bank details not on file."]

    bank_rows = [[Paragraph(bank_label_text, s_label)]]
    for ln in bank_lines:
        bank_rows.append([Paragraph(ln, s_value)])

    bank_table = Table(bank_rows, colWidths=[90 * mm])
    bank_table.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))

    totals_rows = [
        [
            Paragraph("Subtotal", s_value),
            Paragraph(_gbp(invoice.total_amount), ParagraphStyle("Sub", parent=s_value, alignment=TA_RIGHT)),
        ],
    ]
    totals_rows.append([
        Paragraph("Total", s_total_label),
        Paragraph(_gbp(invoice.total_amount), s_total_value),
    ])

    totals_table = Table(totals_rows, colWidths=[36 * mm, 32 * mm])
    totals_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG_100),
        ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
        # Divider above total row
        ("LINEABOVE", (0, 1), (-1, 1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))

    bottom = Table(
        [[bank_table, totals_table]],
        colWidths=[90 * mm, 78 * mm],
    )
    bottom.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 16 * mm),
        ("RIGHTPADDING", (0, 0), (0, 0), 4 * mm),
        ("RIGHTPADDING", (1, 0), (1, 0), 16 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    elements.append(bottom)
    elements.append(Spacer(1, 12 * mm))

    # --- Footer ------------------------------------------------------------
    generated_at = datetime.now().strftime("%d %b %Y at %H:%M")
    footer_text = (
        f"Generated on {generated_at} · "
        f"Invoice version {invoice.version or 1} · "
        "This document is the canonical record of the named period."
    )
    elements.append(Paragraph(footer_text, s_footer))

    doc.build(elements)
    buf.seek(0)
    return buf
