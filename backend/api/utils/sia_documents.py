"""SIA licence documents: validation, storage keys and serving.

An SIA licence scan is an identity document, so everything about how one is
accepted, where it is kept and how it is handed back lives here rather than
being re-derived in each view.

Three rules hold throughout:

- A document's type comes from its bytes, never from the client. The stored
  extension and the served Content-Type are both taken from the file signature,
  so `licence.html` that starts with PNG bytes is kept and served as a PNG — not
  as `text/html` on the API origin.
- A document lives under `sia_licenses/<owner user id>/`, where the owner is the
  officer the licence belongs to, not whoever uploaded it. The legacy
  `sia-license-documents/` view authorises against that directory.
- A licence only ever resolves to a key inside its own officer's directory, so
  a `document_url` pointing at someone else's file serves and deletes nothing.
"""
import logging
import os
import re
import uuid
from urllib.parse import quote, unquote, urlparse

from django.core.files.storage import default_storage
from django.http import FileResponse

logger = logging.getLogger(__name__)

PREFIX = 'sia_licenses'
PUBLIC_PATH = '/api/v1/sia-license-documents/'
MAX_BYTES = 10 * 1024 * 1024

DECLARED_TYPES = {'application/pdf', 'image/jpeg', 'image/png', 'image/jpg'}

# (leading bytes, stored extension, served content type)
SIGNATURES = (
    (b'\xff\xd8\xff', '.jpg', 'image/jpeg'),
    (b'\x89PNG\r\n\x1a\n', '.png', 'image/png'),
    (b'%PDF-', '.pdf', 'application/pdf'),
)

_KEY_PATTERN = re.compile(r'^(\d+)/[^/\\]+$')


class DocumentRejected(ValueError):
    """The upload is not a document we will keep."""


def sniff(file_obj):
    """(extension, content type) from the file's signature, or None."""
    header = file_obj.read(8)
    file_obj.seek(0)
    for signature, extension, content_type in SIGNATURES:
        if header.startswith(signature):
            return extension, content_type
    return None


def validate_upload(file_obj):
    """Return (extension, content type) for an acceptable upload, else raise."""
    if not file_obj:
        raise DocumentRejected('No file provided.')
    if file_obj.size > MAX_BYTES:
        raise DocumentRejected('File too large. Maximum size is 10MB.')
    if getattr(file_obj, 'content_type', None) not in DECLARED_TYPES:
        raise DocumentRejected('Invalid file type. Allowed types: PDF, JPEG, PNG.')
    detected = sniff(file_obj)
    if detected is None:
        # The declared type is a claim; the bytes are the fact.
        raise DocumentRejected(
            'Invalid file type. Only JPEG, PNG, and PDF files are allowed.'
        )
    return detected


def store(file_obj, owner_user_id, extension):
    """Save under the owner's directory with an unguessable name; return the key."""
    key = f'{PREFIX}/{int(owner_user_id)}/{uuid.uuid4().hex}{extension}'
    file_obj.seek(0)
    return default_storage.save(key, file_obj)


def url_for(request, key):
    """The authenticated URL a stored key is reached through."""
    relative = key.split(f'{PREFIX}/', 1)[-1]
    return request.build_absolute_uri(f'{PUBLIC_PATH}{quote(relative, safe="/")}')


def key_from_url(url):
    """The storage key a document URL refers to, or None.

    Reads the path only — stored URLs carry whichever host built them.
    """
    if not url:
        return None
    path = unquote(urlparse(url).path)
    if PUBLIC_PATH not in path:
        return None
    relative = path.split(PUBLIC_PATH, 1)[1]
    if not relative or '..' in relative or relative.startswith('/') or '\\' in relative:
        return None
    return f'{PREFIX}/{relative}'


def owner_id_from_key(key):
    relative = key.split(f'{PREFIX}/', 1)[-1] if key else ''
    match = _KEY_PATTERN.match(relative)
    return int(match.group(1)) if match else None


def key_for_licence(licence):
    """The key for a licence's document, only if it sits in its officer's directory."""
    key = key_from_url(licence.document_url)
    if key is None:
        return None
    if owner_id_from_key(key) != licence.staff_profile.user_id:
        return None
    return key


def serve(key, download_stem):
    """A private, non-sniffable response for a stored document, or None if absent."""
    # `open()` on S3 storage is lazy, so a missing object would otherwise only
    # surface mid-response as a 500.
    if not key or not default_storage.exists(key):
        return None
    handle = default_storage.open(key, 'rb')
    detected = sniff(handle)
    if detected is None:
        handle.close()
        logger.warning('Refusing to serve SIA document with an unrecognised signature: %s', key)
        return None
    extension, content_type = detected
    response = FileResponse(
        handle, content_type=content_type, filename=f'{download_stem}{extension}',
    )
    # Never let a shared cache hold an identity document, and never let a
    # browser second-guess the type we derived from its bytes.
    response['Cache-Control'] = 'private, no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    return response


def delete_quietly(key):
    """Remove a stored document; a failure is logged, never raised."""
    if not key:
        return
    try:
        default_storage.delete(key)
    except Exception:
        logger.exception('Could not delete SIA document %s', key)


def display_name(filename):
    """A tidy version of the client's filename, for echoing back only."""
    name, ext = os.path.splitext(filename or '')
    name = re.sub(r'[^\w\-.]', '_', name.replace(' ', '_'))
    name = re.sub(r'_+', '_', name).strip('_')
    return f'{name}{ext}'
