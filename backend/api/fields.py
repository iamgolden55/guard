import os

from cryptography.fernet import Fernet, InvalidToken
from django.core.exceptions import ImproperlyConfigured
from django.db import models


class EncryptedCharField(models.CharField):
    """
    A CharField that transparently encrypts data at rest using Fernet
    symmetric encryption.

    Reads the encryption key from BANK_ENCRYPTION_KEY (preferred) or
    FINANCE_ENCRYPTION_KEY environment variable.

    Migration-safe: if decryption fails (e.g. data was stored before
    encryption was enabled), the raw value is returned so existing rows
    keep working. On the next save the value will be encrypted.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        key = os.getenv("BANK_ENCRYPTION_KEY") or os.getenv("FINANCE_ENCRYPTION_KEY")
        if not key:
            raise ImproperlyConfigured(
                "BANK_ENCRYPTION_KEY or FINANCE_ENCRYPTION_KEY environment "
                "variable must be set. Generate one with:\n"
                "  python -c 'from cryptography.fernet import Fernet; "
                "print(Fernet.generate_key().decode())'"
            )
        if isinstance(key, str):
            key = key.encode()
        self.cipher = Fernet(key)

    def get_prep_value(self, value):
        """Encrypt the value before writing to the database."""
        value = super().get_prep_value(value)
        if value is None:
            return None
        encrypted = self.cipher.encrypt(value.encode("utf-8"))
        return encrypted.decode("utf-8")

    def from_db_value(self, value, expression, connection):
        """Decrypt the value when reading from the database."""
        if value is None:
            return None
        try:
            decrypted = self.cipher.decrypt(value.encode("utf-8"))
            return decrypted.decode("utf-8")
        except (InvalidToken, Exception):
            # Data was stored before encryption was enabled — return as-is.
            # It will be encrypted on the next save.
            return value

    def deconstruct(self):
        """
        Return enough info for Django to recreate this field in migrations.
        EncryptedCharField serialises identically to CharField so that
        migrations don't embed the encryption key.
        """
        name, path, args, kwargs = super().deconstruct()
        path = "api.fields.EncryptedCharField"
        return name, path, args, kwargs
