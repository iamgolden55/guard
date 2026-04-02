import React, { useState, useEffect } from 'react';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { Header, Container, SpaceBetween, Alert, FormSection, KeyValuePairs, StatusIndicator, ConfirmationModal } from '../../components/cloudscape';
import { profileService } from '../../services';
import { useAuth } from '../../contexts/AuthContext';
import {
  type StaffProfile,
  type SIALicense,
  SIALicenseType,
  Address,
  BankDetails,
  EmergencyContact,
  ProfileUpdateRequest
} from '../../types';

const ProfilePage: React.FC = () => {
  const { refreshUserData } = useAuth();
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [showAddLicenseDialog, setShowAddLicenseDialog] = useState(false);
  const [editingLicense, setEditingLicense] = useState<SIALicense | null>(null);
  const [siaLicenses, setSiaLicenses] = useState<SIALicense[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [addingLicense, setAddingLicense] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const licenseFileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      setError(null);
      const profileData = await profileService.getProfile();
      setProfile(profileData);
      setSiaLicenses(profileData.siaLicenses || []);
    } catch (error) {
      console.error('Failed to load profile data:', error);
      setError('Failed to load profile data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatRelativeTime = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);

    if (diffSec < 60) return 'just now';
    if (diffMin < 2) return '1 minute ago';
    if (diffMin < 60) return `${diffMin} minutes ago`;
    if (diffHour < 2) return '1 hour ago';
    if (diffHour < 24) return `${diffHour} hours ago`;
    if (diffDay < 2) return '1 day ago';
    if (diffDay < 7) return `${diffDay} days ago`;
    if (diffWeek < 2) return '1 week ago';
    if (diffWeek < 4) return `${diffWeek} weeks ago`;
    if (diffMonth < 2) return '1 month ago';
    if (diffMonth < 12) return `${diffMonth} months ago`;
    if (diffYear < 2) return '1 year ago';
    return `${diffYear} years ago`;
  };

  const getLicenseStatus = (expiryDate: string) => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(now.getMonth() + 3);

    if (expiry < now) {
      return { status: 'expired', type: 'error' as const };
    }
    if (expiry < threeMonthsFromNow) {
      return { status: 'expiring soon', type: 'warning' as const };
    }
    return { status: 'valid', type: 'success' as const };
  };

  const handleProfileImageClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      setImageFile(event.target.files[0]);
      uploadProfileImage(event.target.files[0]);
    }
  };

  const uploadProfileImage = async (file: File) => {
    try {
      setIsUploadingImage(true);
      setError(null);
      const result = await profileService.uploadProfileImage(file);
      if (profile) {
        setProfile({ ...profile, profileImageUrl: result.imageUrl });
      }
      setSuccessMessage('Profile image updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Failed to upload profile image:', error);
      setError('Failed to upload profile image. Please try again.');
    } finally {
      setIsUploadingImage(false);
      setImageFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Validation schemas
  const personalInfoSchema = Yup.object({
    firstName: Yup.string().required('First name is required'),
    lastName: Yup.string().required('Last name is required'),
    email: Yup.string().email('Invalid email format').required('Email is required'),
    nationalInsuranceNumber: Yup.string(),
    dateOfBirth: Yup.date(),
  });

  const contactInfoSchema = Yup.object({
    phoneNumber: Yup.string().required('Phone number is required'),
    street: Yup.string().required('Street address is required'),
    city: Yup.string().required('City is required'),
    postalCode: Yup.string().required('Postal code is required'),
    country: Yup.string().required('Country is required'),
    emergencyName: Yup.string().when([], {
      is: () => profile?.role === 'admin',
      then: (schema) => schema.notRequired(),
      otherwise: (schema) => schema.required('Emergency contact name is required')
    }),
    emergencyRelationship: Yup.string().when([], {
      is: () => profile?.role === 'admin',
      then: (schema) => schema.notRequired(),
      otherwise: (schema) => schema.required('Relationship is required')
    }),
    emergencyPhone: Yup.string().when([], {
      is: () => profile?.role === 'admin',
      then: (schema) => schema.notRequired(),
      otherwise: (schema) => schema.required('Emergency contact phone is required')
    }),
  });

  const bankDetailsSchema = Yup.object({
    accountName: Yup.string().required('Account name is required'),
    accountNumber: Yup.string().required('Account number is required'),
    sortCode: Yup.string().required('Sort code is required'),
    bankName: Yup.string().required('Bank name is required'),
  });

  const passwordChangeSchema = Yup.object({
    currentPassword: Yup.string().required('Current password is required'),
    newPassword: Yup.string().min(8, 'Password must be at least 8 characters').required('New password is required'),
    confirmPassword: Yup.string().oneOf([Yup.ref('newPassword'), undefined], 'Passwords must match').required('Please confirm your new password'),
  });

  const siaLicenseSchema = Yup.object({
    licenseNumber: Yup.string().required('License number is required'),
    licenseType: Yup.string().required('License type is required'),
    issueDate: Yup.date().required('Issue date is required'),
    expiryDate: Yup.date().required('Expiry date is required').min(Yup.ref('issueDate'), 'Expiry date cannot be before issue date'),
  });

  // Forms
  const personalInfoFormik = useFormik({
    initialValues: {
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      email: profile?.email || '',
      nationalInsuranceNumber: profile?.nationalInsuranceNumber || '',
      dateOfBirth: profile?.dateOfBirth ? new Date(profile.dateOfBirth) : null,
    },
    validationSchema: personalInfoSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      try {
        setError(null);
        await profileService.updateProfile({
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          nationalInsuranceNumber: values.nationalInsuranceNumber,
          dateOfBirth: values.dateOfBirth ? values.dateOfBirth.toISOString().split('T')[0] : undefined,
        });
        await loadProfileData();
        refreshUserData();
        setIsEditingPersonal(false);
        setSuccessMessage('Personal information updated successfully (Note: Date of birth and National Insurance Number cannot be changed for security reasons)');
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (error) {
        console.error('Failed to update personal information:', error);
        setError('Failed to update personal information. Please try again.');
      }
    },
  });

  const contactInfoFormik = useFormik({
    initialValues: {
      phoneNumber: profile?.phoneNumber || '',
      street: profile?.address?.street || '',
      city: profile?.address?.city || '',
      postalCode: profile?.address?.postalCode || '',
      country: profile?.address?.country || '',
      emergencyName: profile?.emergencyContact?.name || '',
      emergencyRelationship: profile?.emergencyContact?.relationship || '',
      emergencyPhone: profile?.emergencyContact?.phoneNumber || '',
    },
    validationSchema: contactInfoSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      try {
        setError(null);
        await profileService.updateProfile({
          phoneNumber: values.phoneNumber,
          address: {
            street: values.street,
            city: values.city,
            postalCode: values.postalCode,
            country: values.country,
          },
          emergencyContact: {
            name: values.emergencyName,
            relationship: values.emergencyRelationship,
            phoneNumber: values.emergencyPhone,
          },
        });
        await loadProfileData();
        setIsEditingContact(false);
        setSuccessMessage('Contact information updated successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (error) {
        console.error('Failed to update contact information:', error);
        setError('Failed to update contact information. Please try again.');
      }
    },
  });

  const bankDetailsFormik = useFormik({
    initialValues: {
      accountName: profile?.bankDetails?.accountName || '',
      accountNumber: profile?.bankDetails?.accountNumber || '',
      sortCode: profile?.bankDetails?.sortCode || '',
      bankName: profile?.bankDetails?.bankName || '',
    },
    validationSchema: bankDetailsSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      try {
        setError(null);
        await profileService.updateProfile({
          bankDetails: {
            accountName: values.accountName,
            accountNumber: values.accountNumber,
            sortCode: values.sortCode,
            bankName: values.bankName,
          },
        });
        await loadProfileData();
        setIsEditingBank(false);
        setSuccessMessage('Bank details updated successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (error) {
        console.error('Failed to update bank details:', error);
        setError('Failed to update bank details. Please try again.');
      }
    },
  });

  const passwordChangeFormik = useFormik({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validationSchema: passwordChangeSchema,
    onSubmit: async (values) => {
      try {
        setError(null);
        await profileService.changePassword(values.currentPassword, values.newPassword);
        setIsEditingPassword(false);
        setSuccessMessage('Password changed successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
        passwordChangeFormik.resetForm();
      } catch (error) {
        console.error('Failed to change password:', error);
        setError('Failed to change password. Please ensure your current password is correct.');
      }
    },
  });

  const licenseFormik = useFormik({
    initialValues: {
      licenseNumber: editingLicense?.licenseNumber || '',
      licenseType: editingLicense?.licenseType || '',
      issueDate: editingLicense?.issueDate ? new Date(editingLicense.issueDate) : null,
      expiryDate: editingLicense?.expiryDate ? new Date(editingLicense.expiryDate) : null,
      documentFile: null as File | null,
    },
    validationSchema: siaLicenseSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      try {
        setAddingLicense(true);
        setError(null);
        const licenseData = {
          licenseNumber: values.licenseNumber,
          licenseType: values.licenseType as SIALicenseType,
          issueDate: values.issueDate?.toISOString().split('T')[0] || '',
          expiryDate: values.expiryDate?.toISOString().split('T')[0] || '',
          documentFile: values.documentFile || undefined
        };

        if (editingLicense) {
          await profileService.updateSIALicense(editingLicense.licenseNumber, licenseData);
        } else {
          const newLicense = await profileService.addSIALicense(licenseData);
          setSiaLicenses([...siaLicenses, newLicense]);
        }

        await loadProfileData();
        setShowAddLicenseDialog(false);
        setEditingLicense(null);
        licenseFormik.resetForm();
        setSuccessMessage(`SIA License ${editingLicense ? 'updated' : 'added'} successfully`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (error) {
        console.error('Failed to save SIA license:', error);
        setError('Failed to save SIA license. Please try again.');
      } finally {
        setAddingLicense(false);
      }
    },
  });

  const handleLicenseFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      licenseFormik.setFieldValue('documentFile', event.target.files[0]);
    }
  };

  const handleEditLicense = (license: SIALicense) => {
    setEditingLicense(license);
    setShowAddLicenseDialog(true);
  };

  const handleAddLicense = () => {
    setEditingLicense(null);
    licenseFormik.resetForm();
    setShowAddLicenseDialog(true);
  };

  // Helper: render input field
  const renderInput = (label: string, name: string, formik: any, opts?: { type?: string; required?: boolean; disabled?: boolean; description?: string }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label} {opts?.required && '*'}</label>
      <input
        name={name}
        type={opts?.type || 'text'}
        value={formik.values[name]}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        disabled={opts?.disabled}
        className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
      />
      {opts?.description && <p className="text-xs text-gray-400 mt-1">{opts.description}</p>}
      {formik.touched[name] && formik.errors[name] && (
        <p className="text-red-600 text-xs mt-1">{formik.errors[name]}</p>
      )}
    </div>
  );

  const tabs = [
    { key: 'personal', label: 'Personal' },
    { key: 'contact', label: 'Contact' },
    { key: 'licenses', label: 'SIA Licenses' },
    { key: 'bank', label: 'Bank Details' },
    { key: 'security', label: 'Security' },
  ];

  return (
    <SpaceBetween size="l">
      <Header variant="h1">My Profile</Header>

      {error && (
        <Alert type="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert type="success" dismissible onDismiss={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading profile...</p>
          </div>
        </div>
      ) : profile ? (
        <div className="max-w-3xl">
          <SpaceBetween size="l">
            {/* Profile Header */}
            <Container>
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="relative">
                  <img
                    src={profile.profileImageUrl || 'https://via.placeholder.com/150?text=User'}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                  />
                  <button
                    onClick={handleProfileImageClick}
                    disabled={isUploadingImage}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors"
                    title="Change profile picture"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900">{profile.firstName} {profile.lastName}</p>
                  <p className="text-sm text-gray-500 capitalize">{profile.role}</p>
                </div>
                {isUploadingImage && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-gray-200 border-t-red-600 rounded-full animate-spin" />
                    <p className="text-xs text-gray-500">Uploading image...</p>
                  </div>
                )}
              </div>
            </Container>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <nav className="flex gap-0 -mb-px overflow-x-auto">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? 'border-red-600 text-red-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Personal Information */}
            {activeTab === 'personal' && (
              <Container
                header={
                  <Header
                    variant="h2"
                    actions={
                      !isEditingPersonal ? (
                        <button
                          onClick={() => setIsEditingPersonal(true)}
                          className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Edit
                        </button>
                      ) : undefined
                    }
                  >
                    Personal Information
                  </Header>
                }
              >
                {isEditingPersonal ? (
                  <form onSubmit={personalInfoFormik.handleSubmit}>
                    <SpaceBetween size="m">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderInput('First Name', 'firstName', personalInfoFormik, { required: true })}
                        {renderInput('Last Name', 'lastName', personalInfoFormik, { required: true })}
                      </div>
                      {renderInput('Email', 'email', personalInfoFormik, { type: 'email', required: true })}
                      {renderInput('National Insurance Number', 'nationalInsuranceNumber', personalInfoFormik, { description: 'Note: This field cannot be updated for security reasons.' })}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                        <input
                          type="date"
                          value={personalInfoFormik.values.dateOfBirth ? personalInfoFormik.values.dateOfBirth.toISOString().split('T')[0] : ''}
                          onChange={(e) => personalInfoFormik.setFieldValue('dateOfBirth', e.target.value ? new Date(e.target.value) : null)}
                          max={new Date().toISOString().split('T')[0]}
                          className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-400 mt-1">Note: This field cannot be updated for security reasons.</p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setIsEditingPersonal(false); personalInfoFormik.resetForm(); }} className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                        <button type="submit" disabled={!personalInfoFormik.dirty || !personalInfoFormik.isValid} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">Save</button>
                      </div>
                    </SpaceBetween>
                  </form>
                ) : (
                  <KeyValuePairs
                    columns={2}
                    items={[
                      { label: 'First Name', value: profile?.firstName || '-' },
                      { label: 'Last Name', value: profile?.lastName || '-' },
                      { label: 'Email', value: profile?.email || '-' },
                      { label: 'National Insurance Number', value: profile?.nationalInsuranceNumber || '-' },
                      { label: 'Date of Birth', value: profile?.dateOfBirth ? formatDate(profile.dateOfBirth) : '-' },
                    ]}
                  />
                )}
              </Container>
            )}

            {/* Contact Information */}
            {activeTab === 'contact' && (
              <Container
                header={
                  <Header
                    variant="h2"
                    actions={
                      !isEditingContact ? (
                        <button onClick={() => setIsEditingContact(true)} className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Edit</button>
                      ) : undefined
                    }
                  >
                    Contact Information
                  </Header>
                }
              >
                {isEditingContact ? (
                  <form onSubmit={contactInfoFormik.handleSubmit}>
                    <SpaceBetween size="m">
                      <FormSection header="Phone">
                        {renderInput('Phone Number', 'phoneNumber', contactInfoFormik, { required: true })}
                      </FormSection>
                      <FormSection header="Address">
                        {renderInput('Street Address', 'street', contactInfoFormik, { required: true })}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {renderInput('City', 'city', contactInfoFormik, { required: true })}
                          {renderInput('Postal Code', 'postalCode', contactInfoFormik, { required: true })}
                        </div>
                        {renderInput('Country', 'country', contactInfoFormik, { required: true })}
                      </FormSection>
                      <FormSection header="Emergency Contact">
                        {profile?.role === 'admin' && (
                          <Alert type="info">Emergency contact information is not available for admin users.</Alert>
                        )}
                        {renderInput('Name', 'emergencyName', contactInfoFormik, { required: profile?.role !== 'admin', disabled: profile?.role === 'admin' })}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {renderInput('Relationship', 'emergencyRelationship', contactInfoFormik, { required: profile?.role !== 'admin', disabled: profile?.role === 'admin' })}
                          {renderInput('Phone Number', 'emergencyPhone', contactInfoFormik, { required: profile?.role !== 'admin', disabled: profile?.role === 'admin' })}
                        </div>
                      </FormSection>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setIsEditingContact(false); contactInfoFormik.resetForm(); }} className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                        <button type="submit" disabled={!contactInfoFormik.dirty || !contactInfoFormik.isValid} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">Save</button>
                      </div>
                    </SpaceBetween>
                  </form>
                ) : (
                  <SpaceBetween size="l">
                    <KeyValuePairs columns={2} items={[{ label: 'Phone Number', value: profile?.phoneNumber || '-' }]} />
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Address</p>
                      {profile?.address ? (
                        <div className="text-sm text-gray-900">
                          <p>{profile.address.street}</p>
                          <p>{profile.address.city}, {profile.address.postalCode}</p>
                          <p>{profile.address.country}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">No address information</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Emergency Contact</p>
                      {profile?.emergencyContact ? (
                        <div className="text-sm text-gray-900">
                          <p>{profile.emergencyContact.name} ({profile.emergencyContact.relationship})</p>
                          <p>{profile.emergencyContact.phoneNumber}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">No emergency contact information</p>
                      )}
                    </div>
                  </SpaceBetween>
                )}
              </Container>
            )}

            {/* SIA Licenses */}
            {activeTab === 'licenses' && (
              <Container
                header={
                  <Header
                    variant="h2"
                    actions={
                      <button onClick={handleAddLicense} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">Add License</button>
                    }
                  >
                    SIA Licenses
                  </Header>
                }
              >
                {siaLicenses.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4">No SIA licenses added yet. Click "Add License" to add your SIA license details.</p>
                ) : (
                  <SpaceBetween size="m">
                    {siaLicenses.map((license, index) => {
                      const status = getLicenseStatus(license.expiryDate);
                      return (
                        <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900">{license.licenseType}</p>
                              <StatusIndicator type={status.type}>
                                {status.status.toUpperCase()}
                              </StatusIndicator>
                            </div>
                            <button onClick={() => handleEditLicense(license)} className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Edit</button>
                          </div>
                          <KeyValuePairs
                            columns={3}
                            items={[
                              { label: 'License Number', value: license.licenseNumber },
                              { label: 'Issue Date', value: formatDate(license.issueDate) },
                              { label: 'Expiry Date', value: formatDate(license.expiryDate) },
                            ]}
                          />
                          {license.documentUrl && (
                            <div className="mt-3">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">License Document</p>
                              <img src={license.documentUrl} alt="SIA License" className="max-w-full border border-gray-200 rounded-lg" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </SpaceBetween>
                )}
              </Container>
            )}

            {/* Bank Details */}
            {activeTab === 'bank' && (
              <Container
                header={
                  <Header
                    variant="h2"
                    actions={
                      !isEditingBank ? (
                        <button onClick={() => setIsEditingBank(true)} className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Edit</button>
                      ) : undefined
                    }
                  >
                    Bank Details
                  </Header>
                }
              >
                {isEditingBank ? (
                  <form onSubmit={bankDetailsFormik.handleSubmit}>
                    <SpaceBetween size="m">
                      {renderInput('Account Name', 'accountName', bankDetailsFormik, { required: true })}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderInput('Account Number', 'accountNumber', bankDetailsFormik, { required: true })}
                        {renderInput('Sort Code', 'sortCode', bankDetailsFormik, { required: true })}
                      </div>
                      {renderInput('Bank Name', 'bankName', bankDetailsFormik, { required: true })}
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setIsEditingBank(false); bankDetailsFormik.resetForm(); }} className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                        <button type="submit" disabled={!bankDetailsFormik.dirty || !bankDetailsFormik.isValid} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">Save</button>
                      </div>
                    </SpaceBetween>
                  </form>
                ) : (
                  <>
                    {profile?.bankDetails ? (
                      <SpaceBetween size="s">
                        <KeyValuePairs
                          columns={2}
                          items={[
                            { label: 'Account Name', value: profile.bankDetails.accountName || '-' },
                            { label: 'Bank Name', value: profile.bankDetails.bankName || '-' },
                            { label: 'Account Number', value: `\u2022\u2022\u2022\u2022\u2022\u2022${profile.bankDetails.accountNumber.slice(-2) || '-'}` },
                            { label: 'Sort Code', value: profile.bankDetails.sortCode || '-' },
                          ]}
                        />
                        <p className="text-xs text-gray-400">Your bank details are used for payment processing. They are encrypted and stored securely.</p>
                      </SpaceBetween>
                    ) : (
                      <p className="text-sm text-gray-500 py-4">No bank details added yet. Click "Edit" to add your bank details.</p>
                    )}
                  </>
                )}
              </Container>
            )}

            {/* Security */}
            {activeTab === 'security' && (
              <Container
                header={
                  <Header
                    variant="h2"
                    actions={
                      !isEditingPassword ? (
                        <button onClick={() => setIsEditingPassword(true)} className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Change Password</button>
                      ) : undefined
                    }
                  >
                    Password & Security
                  </Header>
                }
              >
                {isEditingPassword ? (
                  <form onSubmit={passwordChangeFormik.handleSubmit}>
                    <SpaceBetween size="m">
                      {renderInput('Current Password', 'currentPassword', passwordChangeFormik, { type: 'password', required: true })}
                      {renderInput('New Password', 'newPassword', passwordChangeFormik, { type: 'password', required: true })}
                      {renderInput('Confirm New Password', 'confirmPassword', passwordChangeFormik, { type: 'password', required: true })}
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setIsEditingPassword(false); passwordChangeFormik.resetForm(); }} className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                        <button type="submit" disabled={!passwordChangeFormik.isValid || !passwordChangeFormik.dirty} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">Change Password</button>
                      </div>
                    </SpaceBetween>
                  </form>
                ) : (
                  <SpaceBetween size="m">
                    <p className="text-sm text-gray-600">Your password was last changed {formatRelativeTime(profile?.passwordLastChanged)}</p>
                    <p className="text-sm text-gray-600">
                      For security reasons, it's recommended to change your password regularly. Your password should be strong and include:
                    </p>
                    <ul className="list-disc pl-6 text-sm text-gray-600 space-y-1">
                      <li>At least 8 characters</li>
                      <li>Upper and lowercase letters</li>
                      <li>Numbers</li>
                      <li>Special characters</li>
                    </ul>
                    <p className="text-xs text-gray-400">
                      This system uses encrypted connections and your password is securely hashed.
                    </p>
                  </SpaceBetween>
                )}
              </Container>
            )}
          </SpaceBetween>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Failed to load profile. Please refresh the page.</p>
      )}

      {/* SIA License Dialog */}
      <ConfirmationModal
        visible={showAddLicenseDialog}
        header={editingLicense ? 'Edit SIA License' : 'Add SIA License'}
        confirmLabel={editingLicense ? 'Save Changes' : 'Add License'}
        onConfirm={() => licenseFormik.handleSubmit()}
        onCancel={() => {
          setShowAddLicenseDialog(false);
          setEditingLicense(null);
          licenseFormik.resetForm();
        }}
        loading={addingLicense}
      >
        <SpaceBetween size="m">
          <p className="text-sm text-gray-500">Please enter your SIA License details</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License Number *</label>
            <input
              name="licenseNumber"
              value={licenseFormik.values.licenseNumber}
              onChange={licenseFormik.handleChange}
              onBlur={licenseFormik.handleBlur}
              disabled={editingLicense !== null}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
            />
            {licenseFormik.touched.licenseNumber && licenseFormik.errors.licenseNumber && (
              <p className="text-red-600 text-xs mt-1">{licenseFormik.errors.licenseNumber}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License Type *</label>
            <select
              value={licenseFormik.values.licenseType}
              onChange={(e) => licenseFormik.setFieldValue('licenseType', e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Select type...</option>
              {Object.values(SIALicenseType).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {licenseFormik.touched.licenseType && licenseFormik.errors.licenseType && (
              <p className="text-red-600 text-xs mt-1">{licenseFormik.errors.licenseType}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date *</label>
              <input
                type="date"
                value={licenseFormik.values.issueDate ? licenseFormik.values.issueDate.toISOString().split('T')[0] : ''}
                onChange={(e) => licenseFormik.setFieldValue('issueDate', e.target.value ? new Date(e.target.value) : null)}
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date *</label>
              <input
                type="date"
                value={licenseFormik.values.expiryDate ? licenseFormik.values.expiryDate.toISOString().split('T')[0] : ''}
                onChange={(e) => licenseFormik.setFieldValue('expiryDate', e.target.value ? new Date(e.target.value) : null)}
                min={licenseFormik.values.issueDate ? licenseFormik.values.issueDate.toISOString().split('T')[0] : ''}
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License Document</label>
            <button
              type="button"
              onClick={() => licenseFileInputRef.current?.click()}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Upload License Document
            </button>
            <input
              type="file"
              ref={licenseFileInputRef}
              onChange={handleLicenseFileChange}
              accept="image/*,.pdf"
              style={{ display: 'none' }}
            />
            {licenseFormik.values.documentFile && (
              <p className="text-xs text-gray-500 mt-1">Selected file: {licenseFormik.values.documentFile.name}</p>
            )}
            {editingLicense?.documentUrl && !licenseFormik.values.documentFile && (
              <div className="mt-2">
                <p className="text-xs text-gray-500">Current document:</p>
                <img src={editingLicense.documentUrl} alt="SIA License" className="max-w-full border border-gray-200 rounded-lg mt-1" />
              </div>
            )}
          </div>
        </SpaceBetween>
      </ConfirmationModal>
    </SpaceBetween>
  );
};

export default ProfilePage;
