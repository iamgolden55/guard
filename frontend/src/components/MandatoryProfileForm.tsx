import React, { useState } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  Dropdown,
  TextField,
  DatePicker,
  MessageBar,
  MessageBarType
} from '@fluentui/react';
import { StaffProfile, SIALicenseType, SIALicense } from '../types';
import { profileService } from '../services';
import api from '../services/api';

interface MandatoryProfileFormProps {
  profile: StaffProfile;
  onComplete: () => void;
}

const SECURITY_ROLE_OPTIONS = [
  { key: 'ds', text: 'Door Supervisor' },
  { key: 'sg', text: 'Security Guard' },
  { key: 'cctv', text: 'CCTV Operator' },
  { key: 'cp', text: 'Close Protection Officer' },
  { key: 'steward', text: 'Steward/Marshal' },
  { key: 'k9', text: 'Dog Handler' },
  { key: 'retail', text: 'Retail Security' },
  { key: 'static', text: 'Static Guard' },
  { key: 'mobile', text: 'Mobile Patrol' },
  { key: 'event', text: 'Event Security' },
];

const SIA_LICENSE_TYPE_OPTIONS = [
  { key: 'ds', text: 'Door Supervisor' },
  { key: 'sg', text: 'Security Guard' },
  { key: 'cctv', text: 'CCTV Operator' },
  { key: 'cp', text: 'Close Protection' },
  { key: 'k9', text: 'Dog Handler' },
  { key: 'vs', text: 'Vehicle Security' },
  { key: 'key', text: 'Key Holding' },
];

const MandatoryProfileForm: React.FC<MandatoryProfileFormProps> = ({ profile, onComplete }) => {
  const [securityRoles, setSecurityRoles] = useState<string[]>(profile.securityRoles || []);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseType, setLicenseType] = useState<SIALicenseType | undefined>(undefined);
  const [issueDate, setIssueDate] = useState<Date | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    setUploadError(null);
    if (file) {
      setDocumentFile(file);
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post('/api/v1/upload/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setDocumentUrl(response.data.url);
      } catch (err: any) {
        setUploadError('Failed to upload file. Please try again.');
        setDocumentUrl(null);
      } finally {
        setUploading(false);
      }
    } else {
      setDocumentFile(null);
      setDocumentUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!securityRoles.length) {
      setError('Please select at least one security role.');
      return;
    }
    if (!licenseNumber || !licenseType || !issueDate || !expiryDate) {
      setError('Please fill in all SIA license fields.');
      return;
    }
    if (!documentFile || !documentUrl) {
      setError('Please upload a photo or scan of your SIA license.');
      return;
    }
    setSubmitting(true);
    try {
      await api.patch('/users/me', { security_roles: securityRoles });
      const siaPayload = {
        licenseNumber,
        licenseType,
        issueDate: issueDate.toISOString().slice(0, 10),
        expiryDate: expiryDate.toISOString().slice(0, 10),
        status: 'pending',
        document_url: documentUrl,
        level: 'qualified',
      };
      console.log('SIA License payload:', siaPayload);
      await profileService.addSIALicense(profile.id, siaPayload);
      setSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err: any) {
      if (err.response && err.response.data) {
        console.error('SIA License API error:', err.response.data);
        setError(
          typeof err.response.data === 'string'
            ? err.response.data
            : JSON.stringify(err.response.data)
        );
      } else {
        setError('Failed to submit profile information. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 500, margin: '0 auto', padding: 24, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001' }}>
      <Stack tokens={{ childrenGap: 16 }}>
        <Text variant="xLarge">Complete Your Profile</Text>
        <Text>You must provide your security role and SIA license before you can access shift features. Your information will be reviewed by an admin.</Text>
        <Dropdown
          label="Security Role(s)"
          placeholder="Select your security role(s)"
          multiSelect
          options={SECURITY_ROLE_OPTIONS}
          selectedKeys={securityRoles}
          onChange={(_, option) => {
            if (!option) return;
            setSecurityRoles(prev =>
              option.selected
                ? [...prev, option.key as string]
                : prev.filter(r => r !== option.key)
            );
          }}
          required
        />
        <TextField
          label="SIA License Number"
          value={licenseNumber}
          onChange={(_, v) => setLicenseNumber(v || '')}
          required
        />
        <Dropdown
          label="SIA License Type"
          placeholder="Select license type"
          options={SIA_LICENSE_TYPE_OPTIONS}
          selectedKey={licenseType}
          onChange={(_, option) => setLicenseType(option?.key as string)}
          required
        />
        <DatePicker
          label="Issue Date"
          value={issueDate}
          onSelectDate={setIssueDate}
          required
        />
        <DatePicker
          label="Expiry Date"
          value={expiryDate}
          onSelectDate={setExpiryDate}
          required
        />
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileChange}
          required
        />
        {uploading && <Text>Uploading file...</Text>}
        {uploadError && <MessageBar messageBarType={MessageBarType.error}>{uploadError}</MessageBar>}
        {documentUrl && documentFile && (
          <div style={{ marginTop: 8 }}>
            <Text>Preview:</Text>
            {documentFile.type.startsWith('image/') ? (
              <img src={URL.createObjectURL(documentFile)} alt="SIA License Preview" style={{ maxWidth: 200, maxHeight: 200, display: 'block', marginTop: 4 }} />
            ) : (
              <a href={documentUrl} target="_blank" rel="noopener noreferrer">View uploaded document</a>
            )}
          </div>
        )}
        {error && <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>}
        {success && <MessageBar messageBarType={MessageBarType.success}>Profile submitted! Awaiting admin approval.</MessageBar>}
        <PrimaryButton type="submit" text={submitting ? 'Submitting...' : 'Submit'} disabled={submitting} />
      </Stack>
    </form>
  );
};

export default MandatoryProfileForm; 