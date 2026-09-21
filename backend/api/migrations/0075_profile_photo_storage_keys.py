"""Store profile photos as storage keys, not as URLs.

`StaffProfile.profile_image_url` held an absolute URL built from `MEDIA_URL`,
which production never served — and built wrongly at that, since `MEDIA_URL` had
no leading slash, so rows read
`https://mead-security-api.onrender.commedia/profile_photos/<name>`.

Readers now sign the key on the way out, so the rows keep the key. Values that
are not ours — an externally hosted avatar, say — are left exactly as they are;
`api.utils.profile_photos.storage_key` refuses to sign those anyway.
"""
from django.db import migrations

PREFIX = 'profile_photos/'


def to_keys(apps, schema_editor):
    StaffProfile = apps.get_model('api', 'StaffProfile')
    from api.utils.profile_photos import storage_key

    updates = []
    for profile in StaffProfile.objects.exclude(
        profile_image_url__isnull=True
    ).exclude(profile_image_url='').iterator():
        key = storage_key(profile.profile_image_url)
        if key and key != profile.profile_image_url:
            profile.profile_image_url = key
            updates.append(profile)
    if updates:
        StaffProfile.objects.bulk_update(updates, ['profile_image_url'], batch_size=200)


def to_urls(apps, schema_editor):
    """Nothing to undo: the URLs these came from never resolved."""


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0074_capacity_check_in_out'),
    ]

    operations = [
        migrations.RunPython(to_keys, to_urls),
    ]
