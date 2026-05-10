"""
Capacity-check logbook PDF generation.

Replaces the paper logbook the company used to keep at the venue desk —
one signed sheet per shift, every 30-minute count noted in order, with
the duty manager's signature at the bottom. The output here is the
audit-ready single document a compliance officer would file.

Uses the same brand palette as `invoice_pdf.py` so admin downloads share
visual identity. Edit alongside that file if the brand evolves.
"""

import base64
import io
import os
from datetime import datetime, timedelta

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


# Brand palette (kept in sync with invoice_pdf.py)
ACCENT_PRIMARY = colors.HexColor("#cb2431")
ACCENT_SOFT = colors.HexColor("#fde7e9")
INK900 = colors.HexColor("#201f1e")
INK600 = colors.HexColor("#605e5c")
INK500 = colors.HexColor("#a19f9d")
BG_100 = colors.HexColor("#faf9f8")
BORDER = colors.HexColor("#edebe9")
SUCCESS_INK = colors.HexColor("#0e6b3a")
WARN_INK = colors.HexColor("#9a4b00")

# Brand mark — Mead Security wordmark, kept next to this module so the PDF
# never depends on Django staticfiles wiring.
_LOGO_PATH = os.path.join(os.path.dirname(__file__), "assets", "mead_logo.png")


def _safe(value, default="—"):
    if value is None:
        return default
    s = str(value).strip()
    return s if s else default


def _datetime_long(dt):
    return dt.strftime("%d %b %Y, %H:%M") if dt else "—"


def _date_long(dt):
    return dt.strftime("%d %b %Y") if dt else "—"


def _time_short(dt):
    return dt.strftime("%H:%M") if dt else "—"


def _decode_signature(signature_b64: str):
    """
    Accept either a raw base64 string or a data URL ("data:image/png;base64,…").
    Returns a BytesIO ready to feed reportlab.platypus.Image, or None if the
    signature can't be decoded — in which case callers should fall back to
    the override-reason path.
    """
    if not signature_b64:
        return None
    payload = signature_b64
    if "," in payload[:64]:
        payload = payload.split(",", 1)[1]
    try:
        return io.BytesIO(base64.b64decode(payload))
    except Exception:
        return None


def generate_capacity_logbook_pdf(*, signoff, checks, misses) -> io.BytesIO:
    """
    Render the capacity logbook PDF for a finalised shift_group.

    Args:
        signoff: CapacityLogbookSignoff instance (the closed logbook).
        checks: iterable of CapacityCheck rows for the shift_group, ordered
                oldest-first (chronological).
        misses: iterable of CapacityCheckSlotMiss rows for the shift_group,
                ordered oldest-first.

    Returns:
        BytesIO of the rendered PDF.
    """
    venue = signoff.venue
    shift_group = signoff.shift_group

    # Date span — derived from the earliest check timestamp + venue.
    if checks:
        first_ts = checks[0].timestamp
        last_ts = checks[-1].timestamp
        shift_date = first_ts.date()
    elif misses:
        first_ts = misses[0].expected_at
        last_ts = misses[-1].expected_at
        shift_date = first_ts.date()
    else:
        first_ts = last_ts = signoff.created_at
        shift_date = signoff.created_at.date()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Capacity logbook · {venue.name} · {_date_long(shift_date)}",
    )
    styles = getSampleStyleSheet()
    story = []

    # ─── Hero header ───
    eyebrow_style = ParagraphStyle(
        "eyebrow",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        textColor=ACCENT_PRIMARY,
        spaceAfter=2,
        leading=10,
    )
    title_style = ParagraphStyle(
        "title",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=22,
        textColor=INK900,
        leading=26,
        spaceAfter=4,
    )
    sub_style = ParagraphStyle(
        "sub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        textColor=INK600,
        leading=14,
    )
    title_block = [
        Paragraph("CAPACITY LOGBOOK", eyebrow_style),
        Paragraph(_safe(venue.name), title_style),
        Paragraph(
            f"{_date_long(shift_date)} · capacity {venue.capacity} · "
            f"check every {venue.capacity_check_interval_minutes} min",
            sub_style,
        ),
    ]

    logo_cell = ""
    if os.path.exists(_LOGO_PATH):
        try:
            logo_cell = Image(_LOGO_PATH, width=36 * mm, height=36 * mm)
        except Exception:
            logo_cell = ""

    if logo_cell:
        header_table = Table(
            [[logo_cell, title_block]],
            colWidths=[40 * mm, 134 * mm],
        )
        header_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (0, 0), 6),
            ("RIGHTPADDING", (1, 0), (1, 0), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(header_table)
    else:
        for el in title_block:
            story.append(el)
    story.append(Spacer(1, 8 * mm))

    # ─── Summary card (3 columns) ───
    label_style = ParagraphStyle(
        "label",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        textColor=INK500,
        leading=9,
        spaceAfter=2,
    )
    value_style = ParagraphStyle(
        "value",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        textColor=INK900,
        leading=18,
    )

    def _summary_cell(label, value):
        return [Paragraph(label, label_style), Paragraph(_safe(value), value_style)]

    summary_data = [[
        _summary_cell("CHECKS LOGGED", str(signoff.total_checks)),
        _summary_cell("SLOTS MISSED", str(signoff.total_missed)),
        _summary_cell("FIRST → LAST", f"{_time_short(first_ts)} – {_time_short(last_ts)}"),
    ]]
    summary_table = Table(summary_data, colWidths=[58 * mm, 58 * mm, 58 * mm])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG_100),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 8 * mm))

    # ─── Capacity checks table ───
    section_style = ParagraphStyle(
        "section",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=INK900,
        leading=14,
        spaceAfter=4,
    )
    story.append(Paragraph("Capacity checks", section_style))

    th_style = ParagraphStyle(
        "th",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        textColor=INK500,
        leading=10,
    )
    td_style = ParagraphStyle(
        "td",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        textColor=INK900,
        leading=12,
    )
    td_warn_style = ParagraphStyle(
        "td_warn",
        parent=td_style,
        textColor=WARN_INK,
        fontName="Helvetica-Bold",
    )
    td_muted_style = ParagraphStyle(
        "td_muted",
        parent=td_style,
        textColor=INK600,
    )

    if checks:
        check_rows = [[
            Paragraph("TIME", th_style),
            Paragraph("COUNT / CAPACITY", th_style),
            Paragraph("PERFORMED BY", th_style),
            Paragraph("ACTION TAKEN / NOTES", th_style),
        ]]
        for c in checks:
            count_text = f"{c.current_count} / {c.venue_capacity}"
            count_paragraph = Paragraph(
                count_text, td_warn_style if c.is_at_capacity else td_style
            )
            performer = "—"
            if c.performed_by:
                performer = (
                    f"{c.performed_by.first_name} {c.performed_by.last_name}".strip()
                    or c.performed_by.username
                )
            extras_parts = []
            if c.action_taken:
                extras_parts.append(f"<b>Action:</b> {c.action_taken}")
            if c.notes:
                extras_parts.append(c.notes)
            extras = "<br/>".join(extras_parts) if extras_parts else "—"
            check_rows.append([
                Paragraph(_time_short(c.timestamp), td_style),
                count_paragraph,
                Paragraph(_safe(performer), td_style),
                Paragraph(extras, td_muted_style),
            ])
        check_table = Table(
            check_rows,
            colWidths=[20 * mm, 36 * mm, 42 * mm, 76 * mm],
            repeatRows=1,
        )
        check_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BG_100),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
            ("LINEBELOW", (0, 0), (-1, -1), 0.25, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(check_table)
    else:
        story.append(Paragraph("No capacity checks were logged.", td_muted_style))
    story.append(Spacer(1, 8 * mm))

    # ─── Missed slots table ───
    if misses:
        story.append(Paragraph("Missed slots", section_style))
        miss_rows = [[
            Paragraph("EXPECTED AT", th_style),
            Paragraph("ACKNOWLEDGED REASON", th_style),
            Paragraph("ACK BY", th_style),
        ]]
        for m in misses:
            ack_by = "—"
            if m.acknowledged_by:
                ack_by = (
                    f"{m.acknowledged_by.first_name} {m.acknowledged_by.last_name}".strip()
                    or m.acknowledged_by.username
                )
            miss_rows.append([
                Paragraph(_time_short(m.expected_at), td_style),
                Paragraph(_safe(m.acknowledgement_reason, default="(not acknowledged)"), td_muted_style),
                Paragraph(ack_by, td_muted_style),
            ])
        miss_table = Table(
            miss_rows,
            colWidths=[28 * mm, 110 * mm, 36 * mm],
            repeatRows=1,
        )
        miss_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), ACCENT_SOFT),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
            ("LINEBELOW", (0, 0), (-1, -1), 0.25, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(miss_table)
        story.append(Spacer(1, 8 * mm))

    # ─── Signoff block ───
    story.append(Paragraph("Signoff", section_style))

    if signoff.signature:
        sig_buf = _decode_signature(signoff.signature)
        if sig_buf is not None:
            try:
                sig_image = Image(sig_buf, width=70 * mm, height=24 * mm)
            except Exception:
                sig_image = Paragraph("(signature image could not be rendered)", td_muted_style)
        else:
            sig_image = Paragraph("(signature image could not be decoded)", td_muted_style)
        signed_at = signoff.signed_at or signoff.created_at
        signoff_data = [[
            sig_image,
            [
                Paragraph(_safe(signoff.closed_by_name), value_style),
                Paragraph(_safe(signoff.closed_by_role, default=""), td_muted_style),
                Paragraph(f"Signed {_datetime_long(signed_at)}", td_muted_style),
            ],
        ]]
    else:
        signoff_data = [[
            Paragraph("OVERRIDE", ParagraphStyle(
                "override_eyebrow",
                parent=eyebrow_style,
                textColor=WARN_INK,
            )),
            [
                Paragraph(
                    _safe(signoff.override_reason, default="No reason captured"),
                    value_style,
                ),
                Paragraph(
                    f"Recorded {_datetime_long(signoff.created_at)}",
                    td_muted_style,
                ),
            ],
        ]]

    signoff_table = Table(signoff_data, colWidths=[80 * mm, 94 * mm])
    signoff_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG_100),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(signoff_table)

    if signoff.notes:
        story.append(Spacer(1, 4 * mm))
        story.append(Paragraph("Notes", section_style))
        story.append(Paragraph(_safe(signoff.notes), td_muted_style))

    # ─── Footer ───
    story.append(Spacer(1, 10 * mm))
    footer_style = ParagraphStyle(
        "footer",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7,
        textColor=INK500,
        leading=10,
        alignment=TA_CENTER,
    )
    story.append(Paragraph(
        f"Logbook ID {shift_group} · Generated {_datetime_long(datetime.utcnow())} UTC",
        footer_style,
    ))

    doc.build(story)
    buf.seek(0)
    return buf
