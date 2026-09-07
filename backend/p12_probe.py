"""Probe: does the update_fields defect actually lose hours?"""
from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.utils import timezone
from api.models import SecurityCompany, Shift, UserCompanyMembership, Venue
from shifts.services import record_attendance

User = get_user_model()
co = SecurityCompany.objects.create(name="Probe Co", registration_number="PROBE1")
admin = User.objects.create_user(username="probe_admin", email="pa@t.test", password="x", role="admin")
staff = User.objects.create_user(username="probe_staff", email="ps@t.test", password="x", role="staff")
for u in (admin, staff):
    UserCompanyMembership.objects.create(user=u, company=co, is_active=True)
v = Venue.objects.create(company=co, name="PV", address="1 St", city="B", postal_code="B1",
                         country="UK", capacity=10, contact_name="c", contact_phone="0",
                         contact_email="v@t.test", terms_and_conditions="t")
start = (timezone.now() - timedelta(hours=10)).replace(minute=0, second=0, microsecond=0)
s = Shift.objects.create(venue=v, staff_user=staff, start_time=start,
                         end_time=start + timedelta(hours=8), status="scheduled",
                         required_security_role="sg", is_published=True,
                         hourly_rate=Decimal("15.00"))

record_attendance(shift=s, check_in=start, check_out=None, hours=None, actor=admin, reason="")
s.refresh_from_db()
print(f"after step 1: check_in={s.check_in_time is not None} hours={s.actual_hours_worked}")

record_attendance(shift=s, check_in=None, check_out=start + timedelta(hours=8),
                  hours=None, actor=admin, reason="closed at end")
s.refresh_from_db()
print(f"after step 2: check_out={s.check_out_time is not None} hours={s.actual_hours_worked}")
print("VERDICT:", "HOURS LOST (bug reproduces)" if s.actual_hours_worked is None
      else f"hours persisted as {s.actual_hours_worked} (bug does NOT reproduce)")

from api.models import TimeAdjustment
ta = TimeAdjustment.objects.filter(shift=s).first()
print(f"TimeAdjustment created: {ta is not None}, adjusted_actual_hours={ta.adjusted_actual_hours if ta else None}")
