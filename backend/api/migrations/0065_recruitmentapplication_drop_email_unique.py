from django.db import migrations, models


class Migration(migrations.Migration):
    """Drop the unique constraint on RecruitmentApplication.email.

    The unique constraint blocked legitimate re-applications when:
      - a previous application was rejected, or
      - the applicant was hired and later removed from the team.

    Outstanding-match enforcement now lives in the serializer
    (RecruitmentApplicationSerializer.validate_email and
    RecruitmentApplicationPublicSerializer.validate_email) so we can be
    smarter than a global DB constraint about what counts as a duplicate.

    A regular db_index is kept for query performance on email lookups.
    """

    dependencies = [
        ('api', '0064_alter_invoice_status_alter_payrollrun_status'),
    ]

    operations = [
        migrations.AlterField(
            model_name='recruitmentapplication',
            name='email',
            field=models.EmailField(db_index=True, max_length=254),
        ),
    ]
