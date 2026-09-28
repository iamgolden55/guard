"""Create or repair the App Store review account and its demo company.

    python manage.py seed_app_review_account                      # new: generates and prints a password once
    python manage.py seed_app_review_account                      # existing: repairs data, password untouched
    python manage.py seed_app_review_account --rotate-password    # new password, printed once
    printf '%s' "$PW" | python manage.py seed_app_review_account --password-stdin

With --password-stdin nothing secret is written to stdout, so it is the form to
use anywhere output is kept (Render job logs). The password is never logged and
never stored anywhere but as a hash on the user row.

Everything it touches lives in the `app-review-demo` company; see api/app_review.py.
"""
import sys

from django.contrib.auth.password_validation import validate_password
from django.core.management.base import BaseCommand, CommandError

from api import app_review


class Command(BaseCommand):
    help = 'Create or repair the App Store review demo account (idempotent).'

    def add_arguments(self, parser):
        parser.add_argument('--password-stdin', action='store_true',
                            help='Read the password from stdin instead of generating one.')
        parser.add_argument('--rotate-password', action='store_true',
                            help='Generate a new password for an existing account and print it once.')
        parser.add_argument('--reset-demo-data', action='store_true',
                            help="Delete and rebuild the demo account's seeded shifts and invoices.")
        parser.add_argument('--adopt-existing', action='store_true',
                            help=f'Convert an existing {app_review.REVIEW_EMAIL} account into the review account.')

    def handle(self, *args, **opts):
        from api.models import User

        exists = User.objects.filter(email__iexact=app_review.REVIEW_EMAIL).exists()
        password = None
        generated = False
        if opts['password_stdin']:
            password = sys.stdin.readline().rstrip('\n')
            if not password:
                raise CommandError('--password-stdin given but stdin was empty.')
        elif opts['rotate_password'] or not exists:
            password = app_review.generate_password()
            generated = True
        if password:
            validate_password(password)

        try:
            summary = app_review.seed(
                password=password,
                reset_demo_data=opts['reset_demo_data'],
                adopt_existing=opts['adopt_existing'],
            )
        except ValueError as e:
            raise CommandError(str(e))

        for key, value in summary.items():
            self.stdout.write(f'  {key}: {value}')
        self.stdout.write(f'  login: {app_review.REVIEW_EMAIL}')
        if generated:
            self.stdout.write(self.style.WARNING(
                f'  password (shown once, not stored anywhere): {password}'
            ))
        elif password:
            self.stdout.write('  password: set from stdin')
        else:
            self.stdout.write('  password: unchanged')
        self.stdout.write(self.style.SUCCESS('App review account ready.'))
