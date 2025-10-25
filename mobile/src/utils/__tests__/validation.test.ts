/**
 * Validation Utility Tests
 * Tests for common validation functions
 */

describe('Validation Utilities', () => {
  describe('Email Validation', () => {
    const validateEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    it('should validate correct email addresses', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.user@company.co.uk')).toBe(true);
      expect(validateEmail('admin@subdomain.example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('no@domain')).toBe(false);
      expect(validateEmail('@nodomain.com')).toBe(false);
      expect(validateEmail('user@.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('Phone Number Validation', () => {
    const validatePhoneNumber = (phone: string): boolean => {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
    };

    it('should validate correct phone numbers', () => {
      expect(validatePhoneNumber('07123456789')).toBe(true);
      expect(validatePhoneNumber('+44 7123 456789')).toBe(true);
      expect(validatePhoneNumber('(020) 1234-5678')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validatePhoneNumber('123')).toBe(false); // Too short
      expect(validatePhoneNumber('abc123')).toBe(false); // Contains letters
      expect(validatePhoneNumber('')).toBe(false);
    });
  });

  describe('SIA License Validation', () => {
    const validateSIALicense = (license: string): boolean => {
      // SIA license format: 16 digits
      const siaRegex = /^\d{16}$/;
      return siaRegex.test(license);
    };

    it('should validate correct SIA license numbers', () => {
      expect(validateSIALicense('1234567890123456')).toBe(true);
      expect(validateSIALicense('9876543210987654')).toBe(true);
    });

    it('should reject invalid SIA license numbers', () => {
      expect(validateSIALicense('123456789012345')).toBe(false); // Too short
      expect(validateSIALicense('12345678901234567')).toBe(false); // Too long
      expect(validateSIALicense('12345678901234AB')).toBe(false); // Contains letters
      expect(validateSIALicense('')).toBe(false);
    });
  });

  describe('Date Validation', () => {
    const isDateInPast = (date: Date): boolean => {
      return date.getTime() < new Date().getTime();
    };

    const isDateInFuture = (date: Date): boolean => {
      return date.getTime() > new Date().getTime();
    };

    it('should identify past dates', () => {
      const pastDate = new Date('2020-01-01');
      expect(isDateInPast(pastDate)).toBe(true);
    });

    it('should identify future dates', () => {
      const futureDate = new Date('2030-01-01');
      expect(isDateInFuture(futureDate)).toBe(true);
    });

    it('should handle today correctly', () => {
      const today = new Date();
      // Today is neither strictly in past nor future
      expect(isDateInPast(today)).toBe(false);
      expect(isDateInFuture(today)).toBe(false);
    });
  });

  describe('Coordinate Validation', () => {
    const isValidLatitude = (lat: number): boolean => {
      return lat >= -90 && lat <= 90;
    };

    const isValidLongitude = (lon: number): boolean => {
      return lon >= -180 && lon <= 180;
    };

    it('should validate correct latitude values', () => {
      expect(isValidLatitude(0)).toBe(true);
      expect(isValidLatitude(51.5074)).toBe(true);
      expect(isValidLatitude(-33.8688)).toBe(true);
      expect(isValidLatitude(90)).toBe(true);
      expect(isValidLatitude(-90)).toBe(true);
    });

    it('should reject invalid latitude values', () => {
      expect(isValidLatitude(91)).toBe(false);
      expect(isValidLatitude(-91)).toBe(false);
      expect(isValidLatitude(180)).toBe(false);
    });

    it('should validate correct longitude values', () => {
      expect(isValidLongitude(0)).toBe(true);
      expect(isValidLongitude(-0.1278)).toBe(true);
      expect(isValidLongitude(151.2093)).toBe(true);
      expect(isValidLongitude(180)).toBe(true);
      expect(isValidLongitude(-180)).toBe(true);
    });

    it('should reject invalid longitude values', () => {
      expect(isValidLongitude(181)).toBe(false);
      expect(isValidLongitude(-181)).toBe(false);
      expect(isValidLongitude(360)).toBe(false);
    });
  });

  describe('Password Strength Validation', () => {
    const validatePasswordStrength = (password: string): {
      isValid: boolean;
      errors: string[];
    } => {
      const errors: string[] = [];

      if (password.length < 8) {
        errors.push('Password must be at least 8 characters');
      }
      if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain an uppercase letter');
      }
      if (!/[a-z]/.test(password)) {
        errors.push('Password must contain a lowercase letter');
      }
      if (!/[0-9]/.test(password)) {
        errors.push('Password must contain a number');
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    };

    it('should validate strong passwords', () => {
      const result = validatePasswordStrength('SecurePass123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const result1 = validatePasswordStrength('weak');
      expect(result1.isValid).toBe(false);
      expect(result1.errors.length).toBeGreaterThan(0);

      const result2 = validatePasswordStrength('nouppercase123');
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Password must contain an uppercase letter');

      const result3 = validatePasswordStrength('NOLOWERCASE123');
      expect(result3.isValid).toBe(false);
      expect(result3.errors).toContain('Password must contain a lowercase letter');

      const result4 = validatePasswordStrength('NoNumbers');
      expect(result4.isValid).toBe(false);
      expect(result4.errors).toContain('Password must contain a number');
    });
  });
});
