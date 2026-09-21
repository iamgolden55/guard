"""Profile photos: where they are kept, and how a client gets a link to one.

A profile photo has to load in a plain `<Image src>` in the staff app and in an
`<img>` in the dashboard, neither of which sends an Authorization header. So
unlike an SIA licence scan — streamed through an authenticated view, see
`api.utils.sia_documents` — a photo is handed out as a signed, expiring link
straight to storage.

What rows hold is the storage key. They used to hold an absolute URL built from
`MEDIA_URL`, which production never served: `MEDIA_URL` had no leading slash, so
the result was `https://mead-security-api.onrender.commedia/profile_photos/…`,
a hostname that does not exist. Both shapes resolve here, so photos uploaded
before the fix still work if their file is still in storage.
"""
import logging
import os
import re
import uuid
from urllib.parse import unquote, urlparse

from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)

PREFIX = 'profile_photos'

# Keys are flat — `profile_photos/<name>` — so a single segment, and never a
# path that could climb into another prefix such as the licence documents.
_NAME = re.compile(r'^[A-Za-z0-9._-]{1,200}$')


def storage_key(value):
    """The storage key a stored profile-photo value refers to, or None.

    None means "nothing this application is allowed to sign": an empty field, an
    externally hosted avatar, or anything pointing outside the photo prefix.
    """
    if not value:
        return None
    candidate = str(value).strip()
    marker = f'{PREFIX}/'
    if marker not in candidate:
        return None
    # A legacy value is a URL; take its path, drop any query string, and undo
    # the percent-encoding the old view applied.
    tail = candidate.split(marker, 1)[1]
    if candidate.lower().startswith(('http://', 'https://')):
        tail = urlparse(candidate).path.split(marker, 1)[-1]
    tail = unquote(tail.split('?', 1)[0].split('#', 1)[0])
    if not _NAME.match(tail):
        return None
    return f'{PREFIX}/{tail}'


def signed_url(value, request=None):
    """A link to the photo that a browser or the app can load directly.

    On R2 that is a signed URL which expires (`querystring_expire`); on local
    disk it is the plain media path, made absolute when a request is at hand so
    the staff app can load it from a LAN address.
    """
    key = storage_key(value)
    if key is None:
        return None
    try:
        url = default_storage.url(key)
    except Exception:
        logger.exception('Could not build a URL for profile photo %s', key)
        return None
    if request is not None and url.startswith('/'):
        return request.build_absolute_uri(url)
    return url


def store(file_obj, user_id, extension):
    """Save an uploaded photo under an unguessable name; return the key."""
    name = f'user_{int(user_id)}_{uuid.uuid4().hex[:8]}{extension.lower()}'
    file_obj.seek(0)
    return default_storage.save(f'{PREFIX}/{name}', file_obj)


def delete_quietly(key):
    """Remove a stored photo; a failure is logged, never raised."""
    if not key:
        return
    try:
        if default_storage.exists(key):
            default_storage.delete(key)
    except Exception:
        logger.exception('Could not delete profile photo %s', key)


def extension_for(filename):
    """The stored extension for an uploaded filename, defaulting to .jpg."""
    ext = os.path.splitext(filename or '')[1].lower()
    return ext if _NAME.match(ext.lstrip('.') or 'x') and ext else '.jpg'
