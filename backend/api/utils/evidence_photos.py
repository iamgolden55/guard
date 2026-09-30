"""Photo evidence for venue checks and incident reports: storage and access.

Officers photograph a blocked fire exit, a toilet left in a state, a crowd at
the door, the aftermath of an incident. Until this existed none of it was kept:
the app tried to put the photo itself into a 500-character URL field (and
failed on the phone before it got that far), and incident photos were only
ever the photo's path on the officer's own phone.

A photo is uploaded on its own, stored privately, and the check or report
refers to it by URL. The rules, as for SIA documents (`sia_documents`):

- The type comes from the bytes, never from the client: JPEG or PNG only.
- A photo lives under `evidence/<company id>/<uploader id>/<random>`, so the
  path alone says whose it is. Nothing else authorises access.
- It is served only to an active member of that company who uploaded it or
  manages it (manager/admin), never publicly, never cached.
- A check or report may only refer to photos its own author uploaded to the
  same company, so evidence can't be borrowed from someone else's record.
"""
import logging
import re
import uuid
from urllib.parse import unquote, urlparse

from django.core.files.storage import default_storage
from django.http import FileResponse

logger = logging.getLogger(__name__)

PREFIX = 'evidence'
PUBLIC_PATH = '/api/v1/evidence-photos/'
MAX_BYTES = 10 * 1024 * 1024
MAX_PER_RECORD = 10

# (leading bytes, stored extension, served content type)
SIGNATURES = (
    (b'\xff\xd8\xff', '.jpg', 'image/jpeg'),
    (b'\x89PNG\r\n\x1a\n', '.png', 'image/png'),
)

# <company id (a UUID)>/<uploader id>/<random>.<jpg|png>
_RELATIVE = re.compile(
    r'^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/(\d+)/([0-9a-f]{32}\.(?:jpg|png))$'
)


class PhotoRejected(ValueError):
    """The upload is not a photo we will keep."""


def sniff(file_obj):
    """(extension, content type) from the file's signature, or None."""
    header = file_obj.read(8)
    file_obj.seek(0)
    for signature, extension, content_type in SIGNATURES:
        if header.startswith(signature):
            return extension, content_type
    return None


def validate_upload(file_obj):
    """Return (extension, content type) for an acceptable photo, else raise."""
    if not file_obj:
        raise PhotoRejected('No file provided.')
    if file_obj.size > MAX_BYTES:
        raise PhotoRejected('Photo too large. Maximum size is 10MB.')
    detected = sniff(file_obj)
    if detected is None:
        raise PhotoRejected('Only JPEG and PNG photos are accepted.')
    return detected


def store(file_obj, company_id, uploader_id, extension):
    """Save under the company and uploader with an unguessable name; return the key."""
    key = f'{PREFIX}/{uuid.UUID(str(company_id))}/{int(uploader_id)}/{uuid.uuid4().hex}{extension}'
    file_obj.seek(0)
    return default_storage.save(key, file_obj)


def url_for(request, key):
    """The authenticated URL a stored key is reached through."""
    relative = key.split(f'{PREFIX}/', 1)[-1]
    return request.build_absolute_uri(f'{PUBLIC_PATH}{relative}')


def parse(relative):
    """(company id, uploader id, key) for a well-formed relative path, else None."""
    match = _RELATIVE.match(relative or '')
    if not match:
        return None
    return match.group(1), int(match.group(2)), f'{PREFIX}/{relative}'


def parse_url(url):
    """(company id, uploader id, key) for one of our evidence URLs, else None.

    Reads the path only — stored URLs carry whichever host built them.
    """
    if not isinstance(url, str) or not url:
        return None
    path = unquote(urlparse(url).path)
    if not path.startswith(PUBLIC_PATH):
        return None
    return parse(path[len(PUBLIC_PATH):])


def check_reference(url, company_id, uploader_id):
    """Raise PhotoRejected unless `url` is a photo `uploader_id` stored for `company_id`."""
    parsed = parse_url(url)
    if parsed is None:
        raise PhotoRejected('Not an uploaded evidence photo.')
    photo_company, photo_uploader, _ = parsed
    if company_id is None or photo_company != str(uuid.UUID(str(company_id))) or photo_uploader != uploader_id:
        raise PhotoRejected('That photo was not uploaded by you for this company.')


def serve(key):
    """A private, non-sniffable response for a stored photo, or None if absent."""
    if not default_storage.exists(key):
        return None
    handle = default_storage.open(key, 'rb')
    detected = sniff(handle)
    if detected is None:
        handle.close()
        logger.warning('Refusing to serve evidence photo with an unrecognised signature: %s', key)
        return None
    _, content_type = detected
    response = FileResponse(handle, content_type=content_type)
    response['Cache-Control'] = 'private, no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    return response
