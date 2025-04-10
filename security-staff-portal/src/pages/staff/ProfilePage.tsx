import React, { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  TextField,
  DatePicker,
  Pivot,
  PivotItem,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  Dialog,
  DialogType,
  DialogFooter,
  Label,
  Image,
  ImageFit,
  mergeStyleSets,
  Dropdown,
  type IDropdownOption,
  Toggle,
  IconButton
} from '@fluentui/react';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { Card } from '../../components';
import { MainLayout } from '../../layouts';
import { profileService } from '../../services';
import {
  type StaffProfile,
  type SIALicense,
  SIALicenseType,
  Address,
  BankDetails,
  EmergencyContact,
  ProfileUpdateRequest
} from '../../types';

// Styles for the profile page
const styles = mergeStyleSets({
  profileImageContainer: {
    position: 'relative',
    width: '150px',
    height: '150px',
    margin: '0 auto 20px auto',
  },
  profileImage: {
    width: '150px',
    height: '150px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid #f3f3f3',
  },
  editImageButton: {
    position: 'absolute',
    bottom: '5px',
    right: '5px',
    backgroundColor: 'white',
    borderRadius: '50%',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  profileContainer: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  sectionTitle: {
    padding: '0 0 8px 0',
    borderBottom: '1px solid #f3f3f3',
    marginBottom: '16px',
  },
  formRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px',
  },
  formColumn: {
    flex: 1,
  },
  licenseCard: {
    padding: '16px',
    border: '1px solid #f0f0f0',
    borderRadius: '4px',
    marginBottom: '16px',
    backgroundColor: '#f9f9f9',
  },
  documentPreview: {
    maxWidth: '100%',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    marginTop: '8px',
  },
  fileUploadButton: {
    marginTop: '8px',
  },
  inputField: {
    marginBottom: '16px',
  },
});

const ProfilePage: React.FC = () => {
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

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const licenseFileInputRef = React.useRef<HTMLInputElement>(null);

  // Load profile data when component mounts
  useEffect(() => {
    loadProfileData();
  }, []);

  // Load profile data
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

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Check if a license is expired or about to expire
  const getLicenseStatus = (expiryDate: string) => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(now.getMonth() + 3);

    if (expiry < now) {
      return { status: 'expired', color: '#d13438' }; // Red
    }

    if (expiry < threeMonthsFromNow) {
      return { status: 'expiring soon', color: '#ffaa44' }; // Orange
    }

    return { status: 'valid', color: '#107c10' }; // Green
  };

  // Handle profile image update
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
        setProfile({
          ...profile,
          profileImageUrl: result.imageUrl
        });
      }

      setSuccessMessage('Profile image updated successfully');

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);

    } catch (error) {
      console.error('Failed to upload profile image:', error);
      setError('Failed to upload profile image. Please try again.');
    } finally {
      setIsUploadingImage(false);
      setImageFile(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Personal information form validation schema
  const personalInfoSchema = Yup.object({
    firstName: Yup.string().required('First name is required'),
    lastName: Yup.string().required('Last name is required'),
    email: Yup.string().email('Invalid email format').required('Email is required'),
    nationalInsuranceNumber: Yup.string().required('National Insurance Number is required'),
    dateOfBirth: Yup.date().required('Date of birth is required'),
  });

  // Contact information form validation schema
  const contactInfoSchema = Yup.object({
    phoneNumber: Yup.string().required('Phone number is required'),
    street: Yup.string().required('Street address is required'),
    city: Yup.string().required('City is required'),
    postalCode: Yup.string().required('Postal code is required'),
    country: Yup.string().required('Country is required'),
    emergencyName: Yup.string().required('Emergency contact name is required'),
    emergencyRelationship: Yup.string().required('Relationship is required'),
    emergencyPhone: Yup.string().required('Emergency contact phone is required'),
  });

  // Bank details form validation schema
  const bankDetailsSchema = Yup.object({
    accountName: Yup.string().required('Account name is required'),
    accountNumber: Yup.string().required('Account number is required'),
    sortCode: Yup.string().required('Sort code is required'),
    bankName: Yup.string().required('Bank name is required'),
  });

  // Password change form validation schema
  const passwordChangeSchema = Yup.object({
    currentPassword: Yup.string().required('Current password is required'),
    newPassword: Yup.string()
      .min(8, 'Password must be at least 8 characters')
      .required('New password is required'),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref('newPassword'), undefined], 'Passwords must match')
      .required('Please confirm your new password'),
  });

  // SIA License form validation schema
  const siaLicenseSchema = Yup.object({
    licenseNumber: Yup.string().required('License number is required'),
    licenseType: Yup.string().required('License type is required'),
    issueDate: Yup.date().required('Issue date is required'),
    expiryDate: Yup.date()
      .required('Expiry date is required')
      .min(
        Yup.ref('issueDate'),
        'Expiry date cannot be before issue date'
      ),
  });

  // Personal information form
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
        });

        // Reload profile data to get updated information
        await loadProfileData();

        setIsEditingPersonal(false);
        setSuccessMessage('Personal information updated successfully');

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);

      } catch (error) {
        console.error('Failed to update personal information:', error);
        setError('Failed to update personal information. Please try again.');
      }
    },
  });

  // Contact information form
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

        // Reload profile data to get updated information
        await loadProfileData();

        setIsEditingContact(false);
        setSuccessMessage('Contact information updated successfully');

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);

      } catch (error) {
        console.error('Failed to update contact information:', error);
        setError('Failed to update contact information. Please try again.');
      }
    },
  });

  // Bank details form
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

        // Reload profile data to get updated information
        await loadProfileData();

        setIsEditingBank(false);
        setSuccessMessage('Bank details updated successfully');

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);

      } catch (error) {
        console.error('Failed to update bank details:', error);
        setError('Failed to update bank details. Please try again.');
      }
    },
  });

  // Password change form
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

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);

        // Reset form values
        passwordChangeFormik.resetForm();

      } catch (error) {
        console.error('Failed to change password:', error);
        setError('Failed to change password. Please ensure your current password is correct.');
      }
    },
  });

  // SIA License form
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
          // Update existing license
          await profileService.updateSIALicense(editingLicense.licenseNumber, licenseData);
        } else {
          // Add new license
          const newLicense = await profileService.addSIALicense(licenseData);
          setSiaLicenses([...siaLicenses, newLicense]);
        }

        // Reload profile data to get updated information
        await loadProfileData();

        setShowAddLicenseDialog(false);
        setEditingLicense(null);
        licenseFormik.resetForm();

        setSuccessMessage(`SIA License ${editingLicense ? 'updated' : 'added'} successfully`);

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);

      } catch (error) {
        console.error('Failed to save SIA license:', error);
        setError('Failed to save SIA license. Please try again.');
      } finally {
        setAddingLicense(false);
      }
    },
  });

  // Handle license file selection
  const handleLicenseFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      licenseFormik.setFieldValue('documentFile', event.target.files[0]);
    }
  };

  // Handle edit license
  const handleEditLicense = (license: SIALicense) => {
    setEditingLicense(license);
    setShowAddLicenseDialog(true);
  };

  // Handle add new license
  const handleAddLicense = () => {
    setEditingLicense(null);
    licenseFormik.resetForm();
    setShowAddLicenseDialog(true);
  };

  // License type options
  const licenseTypeOptions: IDropdownOption[] = Object.values(SIALicenseType).map(type => ({
    key: type,
    text: type
  }));

  // Render the Profile Page
  return (
    <MainLayout>
      <div className={styles.profileContainer}>
        <Stack tokens={{ childrenGap: 16 }}>
          <Text variant="xxLarge">My Profile</Text>

          {/* Error and Success Messages */}
          {error && (
            <MessageBar
              messageBarType={MessageBarType.error}
              isMultiline={false}
              onDismiss={() => setError(null)}
              dismissButtonAriaLabel="Close"
            >
              {error}
            </MessageBar>
          )}

          {successMessage && (
            <MessageBar
              messageBarType={MessageBarType.success}
              isMultiline={false}
              onDismiss={() => setSuccessMessage(null)}
              dismissButtonAriaLabel="Close"
            >
              {successMessage}
            </MessageBar>
          )}

          {loading ? (
            <div className="flex justify-center p-8">
              <Spinner size={SpinnerSize.large} label="Loading profile..." />
            </div>
          ) : profile ? (
            <Stack tokens={{ childrenGap: 24 }}>
              {/* Profile Header with Image */}
              <Card>
                <Stack horizontalAlign="center" tokens={{ childrenGap: 12 }}>
                  <div className={styles.profileImageContainer}>
                    <Image
                      src={profile.profileImageUrl || 'https://via.placeholder.com/150?text=User'}
                      alt="Profile"
                      className={styles.profileImage}
                      imageFit={ImageFit.cover}
                    />
                    <IconButton
                      className={styles.editImageButton}
                      iconProps={{ iconName: 'Edit' }}
                      onClick={handleProfileImageClick}
                      title="Change profile picture"
                      ariaLabel="Change profile picture"
                      disabled={isUploadingImage}
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                  </div>

                  <Text variant="xLarge">{profile.firstName} {profile.lastName}</Text>
                  <Text variant="medium">{profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}</Text>

                  {isUploadingImage && (
                    <Spinner size={SpinnerSize.small} label="Uploading image..." />
                  )}
                </Stack>
              </Card>

              {/* Pivot for different sections */}
              <Pivot>
                <PivotItem headerText="Personal Information">
                  <Card>
                    <Stack tokens={{ childrenGap: 16 }}>
                      <div className={styles.sectionTitle}>
                        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                          <Text variant="large">Personal Information</Text>
                          {!isEditingPersonal ? (
                            <DefaultButton
                              text="Edit"
                              iconProps={{ iconName: 'Edit' }}
                              onClick={() => setIsEditingPersonal(true)}
                            />
                          ) : null}
                        </Stack>
                      </div>

                      {isEditingPersonal ? (
                        <form onSubmit={personalInfoFormik.handleSubmit}>
                          <Stack tokens={{ childrenGap: 16 }}>
                            <div className={styles.formRow}>
                              <div className={styles.formColumn}>
                                <TextField
                                  label="First Name"
                                  name="firstName"
                                  value={personalInfoFormik.values.firstName}
                                  onChange={personalInfoFormik.handleChange}
                                  onBlur={personalInfoFormik.handleBlur}
                                  errorMessage={
                                    personalInfoFormik.touched.firstName && personalInfoFormik.errors.firstName
                                      ? personalInfoFormik.errors.firstName
                                      : undefined
                                  }
                                  required
                                />
                              </div>
                              <div className={styles.formColumn}>
                                <TextField
                                  label="Last Name"
                                  name="lastName"
                                  value={personalInfoFormik.values.lastName}
                                  onChange={personalInfoFormik.handleChange}
                                  onBlur={personalInfoFormik.handleBlur}
                                  errorMessage={
                                    personalInfoFormik.touched.lastName && personalInfoFormik.errors.lastName
                                      ? personalInfoFormik.errors.lastName
                                      : undefined
                                  }
                                  required
                                />
                              </div>
                            </div>

                            <TextField
                              label="Email"
                              name="email"
                              value={personalInfoFormik.values.email}
                              onChange={personalInfoFormik.handleChange}
                              onBlur={personalInfoFormik.handleBlur}
                              errorMessage={
                                personalInfoFormik.touched.email && personalInfoFormik.errors.email
                                  ? personalInfoFormik.errors.email
                                  : undefined
                              }
                              required
                            />

                            <TextField
                              label="National Insurance Number"
                              name="nationalInsuranceNumber"
                              value={personalInfoFormik.values.nationalInsuranceNumber}
                              onChange={personalInfoFormik.handleChange}
                              onBlur={personalInfoFormik.handleBlur}
                              errorMessage={
                                personalInfoFormik.touched.nationalInsuranceNumber && personalInfoFormik.errors.nationalInsuranceNumber
                                  ? personalInfoFormik.errors.nationalInsuranceNumber
                                  : undefined
                              }
                              required
                            />

                            <DatePicker
                              label="Date of Birth"
                              value={personalInfoFormik.values.dateOfBirth || undefined}
                              onSelectDate={(date) => personalInfoFormik.setFieldValue('dateOfBirth', date)}
                              isRequired
                              strings={{
                                months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
                                shortMonths: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                                days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                                shortDays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
                                goToToday: 'Go to today',
                                isRequiredErrorMessage: 'Date of birth is required'
                              }}
                              maxDate={new Date()}
                            />

                            <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
                              <DefaultButton
                                text="Cancel"
                                onClick={() => {
                                  setIsEditingPersonal(false);
                                  personalInfoFormik.resetForm();
                                }}
                              />
                              <PrimaryButton
                                text="Save"
                                type="submit"
                                disabled={!personalInfoFormik.dirty || !personalInfoFormik.isValid}
                              />
                            </Stack>
                          </Stack>
                        </form>
                      ) : (
                        <Stack tokens={{ childrenGap: 8 }}>
                          <div className={styles.formRow}>
                            <div className={styles.formColumn}>
                              <Label>First Name</Label>
                              <Text>{profile?.firstName || '-'}</Text>
                            </div>
                            <div className={styles.formColumn}>
                              <Label>Last Name</Label>
                              <Text>{profile?.lastName || '-'}</Text>
                            </div>
                          </div>

                          <Label>Email</Label>
                          <Text>{profile?.email || '-'}</Text>

                          <Label>National Insurance Number</Label>
                          <Text>{profile?.nationalInsuranceNumber || '-'}</Text>

                          <Label>Date of Birth</Label>
                          <Text>{profile?.dateOfBirth ? formatDate(profile.dateOfBirth) : '-'}</Text>
                        </Stack>
                      )}
                    </Stack>
                  </Card>
                </PivotItem>
                <PivotItem headerText="Contact Information">
                  <Card>
                    <Stack tokens={{ childrenGap: 16 }}>
                      <div className={styles.sectionTitle}>
                        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                          <Text variant="large">Contact Information</Text>
                          {!isEditingContact ? (
                            <DefaultButton
                              text="Edit"
                              iconProps={{ iconName: 'Edit' }}
                              onClick={() => setIsEditingContact(true)}
                            />
                          ) : null}
                        </Stack>
                      </div>

                      {isEditingContact ? (
                        <form onSubmit={contactInfoFormik.handleSubmit}>
                          <Stack tokens={{ childrenGap: 16 }}>
                            <Text variant="mediumPlus">Phone Number</Text>
                            <TextField
                              label="Phone Number"
                              name="phoneNumber"
                              value={contactInfoFormik.values.phoneNumber}
                              onChange={contactInfoFormik.handleChange}
                              onBlur={contactInfoFormik.handleBlur}
                              errorMessage={
                                contactInfoFormik.touched.phoneNumber && contactInfoFormik.errors.phoneNumber
                                  ? contactInfoFormik.errors.phoneNumber
                                  : undefined
                              }
                              required
                            />

                            <Text variant="mediumPlus">Address</Text>
                            <TextField
                              label="Street Address"
                              name="street"
                              value={contactInfoFormik.values.street}
                              onChange={contactInfoFormik.handleChange}
                              onBlur={contactInfoFormik.handleBlur}
                              errorMessage={
                                contactInfoFormik.touched.street && contactInfoFormik.errors.street
                                  ? contactInfoFormik.errors.street
                                  : undefined
                              }
                              required
                            />

                            <div className={styles.formRow}>
                              <div className={styles.formColumn}>
                                <TextField
                                  label="City"
                                  name="city"
                                  value={contactInfoFormik.values.city}
                                  onChange={contactInfoFormik.handleChange}
                                  onBlur={contactInfoFormik.handleBlur}
                                  errorMessage={
                                    contactInfoFormik.touched.city && contactInfoFormik.errors.city
                                      ? contactInfoFormik.errors.city
                                      : undefined
                                  }
                                  required
                                />
                              </div>
                              <div className={styles.formColumn}>
                                <TextField
                                  label="Postal Code"
                                  name="postalCode"
                                  value={contactInfoFormik.values.postalCode}
                                  onChange={contactInfoFormik.handleChange}
                                  onBlur={contactInfoFormik.handleBlur}
                                  errorMessage={
                                    contactInfoFormik.touched.postalCode && contactInfoFormik.errors.postalCode
                                      ? contactInfoFormik.errors.postalCode
                                      : undefined
                                  }
                                  required
                                />
                              </div>
                            </div>

                            <TextField
                              label="Country"
                              name="country"
                              value={contactInfoFormik.values.country}
                              onChange={contactInfoFormik.handleChange}
                              onBlur={contactInfoFormik.handleBlur}
                              errorMessage={
                                contactInfoFormik.touched.country && contactInfoFormik.errors.country
                                  ? contactInfoFormik.errors.country
                                  : undefined
                              }
                              required
                            />

                            <Text variant="mediumPlus">Emergency Contact</Text>
                            <TextField
                              label="Name"
                              name="emergencyName"
                              value={contactInfoFormik.values.emergencyName}
                              onChange={contactInfoFormik.handleChange}
                              onBlur={contactInfoFormik.handleBlur}
                              errorMessage={
                                contactInfoFormik.touched.emergencyName && contactInfoFormik.errors.emergencyName
                                  ? contactInfoFormik.errors.emergencyName
                                  : undefined
                              }
                              required
                            />

                            <div className={styles.formRow}>
                              <div className={styles.formColumn}>
                                <TextField
                                  label="Relationship"
                                  name="emergencyRelationship"
                                  value={contactInfoFormik.values.emergencyRelationship}
                                  onChange={contactInfoFormik.handleChange}
                                  onBlur={contactInfoFormik.handleBlur}
                                  errorMessage={
                                    contactInfoFormik.touched.emergencyRelationship && contactInfoFormik.errors.emergencyRelationship
                                      ? contactInfoFormik.errors.emergencyRelationship
                                      : undefined
                                  }
                                  required
                                />
                              </div>
                              <div className={styles.formColumn}>
                                <TextField
                                  label="Phone Number"
                                  name="emergencyPhone"
                                  value={contactInfoFormik.values.emergencyPhone}
                                  onChange={contactInfoFormik.handleChange}
                                  onBlur={contactInfoFormik.handleBlur}
                                  errorMessage={
                                    contactInfoFormik.touched.emergencyPhone && contactInfoFormik.errors.emergencyPhone
                                      ? contactInfoFormik.errors.emergencyPhone
                                      : undefined
                                  }
                                  required
                                />
                              </div>
                            </div>

                            <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
                              <DefaultButton
                                text="Cancel"
                                onClick={() => {
                                  setIsEditingContact(false);
                                  contactInfoFormik.resetForm();
                                }}
                              />
                              <PrimaryButton
                                text="Save"
                                type="submit"
                                disabled={!contactInfoFormik.dirty || !contactInfoFormik.isValid}
                              />
                            </Stack>
                          </Stack>
                        </form>
                      ) : (
                        <Stack tokens={{ childrenGap: 16 }}>
                          <Stack tokens={{ childrenGap: 8 }}>
                            <Text variant="mediumPlus">Phone Number</Text>
                            <Text>{profile?.phoneNumber || '-'}</Text>
                          </Stack>

                          <Stack tokens={{ childrenGap: 8 }}>
                            <Text variant="mediumPlus">Address</Text>
                            {profile?.address ? (
                              <div>
                                <Text>{profile.address.street}</Text>
                                <Text>{profile.address.city}, {profile.address.postalCode}</Text>
                                <Text>{profile.address.country}</Text>
                              </div>
                            ) : (
                              <Text>No address information</Text>
                            )}
                          </Stack>

                          <Stack tokens={{ childrenGap: 8 }}>
                            <Text variant="mediumPlus">Emergency Contact</Text>
                            {profile?.emergencyContact ? (
                              <div>
                                <Text>{profile.emergencyContact.name} ({profile.emergencyContact.relationship})</Text>
                                <Text>{profile.emergencyContact.phoneNumber}</Text>
                              </div>
                            ) : (
                              <Text>No emergency contact information</Text>
                            )}
                          </Stack>
                        </Stack>
                      )}
                    </Stack>
                  </Card>
                </PivotItem>
                <PivotItem headerText="SIA Licenses">
                  <Card>
                    <Stack tokens={{ childrenGap: 16 }}>
                      <div className={styles.sectionTitle}>
                        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                          <Text variant="large">SIA Licenses</Text>
                          <PrimaryButton
                            text="Add License"
                            iconProps={{ iconName: 'Add' }}
                            onClick={handleAddLicense}
                          />
                        </Stack>
                      </div>

                      {siaLicenses.length === 0 ? (
                        <Text>No SIA licenses added yet. Click "Add License" to add your SIA license details.</Text>
                      ) : (
                        <Stack tokens={{ childrenGap: 16 }}>
                          {siaLicenses.map((license, index) => {
                            const status = getLicenseStatus(license.expiryDate);

                            return (
                              <div key={index} className={styles.licenseCard}>
                                <Stack tokens={{ childrenGap: 12 }}>
                                  <Stack horizontal horizontalAlign="space-between">
                                    <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
                                      <Text variant="mediumPlus">{license.licenseType}</Text>
                                      <div style={{
                                        backgroundColor: status.color,
                                        color: 'white',
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        fontSize: '12px',
                                        fontWeight: 'bold'
                                      }}>
                                        {status.status.toUpperCase()}
                                      </div>
                                    </Stack>
                                    <DefaultButton
                                      text="Edit"
                                      iconProps={{ iconName: 'Edit' }}
                                      onClick={() => handleEditLicense(license)}
                                    />
                                  </Stack>

                                  <Stack horizontal tokens={{ childrenGap: 20 }}>
                                    <Stack tokens={{ childrenGap: 4 }}>
                                      <Text className="font-semibold">License Number</Text>
                                      <Text>{license.licenseNumber}</Text>
                                    </Stack>
                                    <Stack tokens={{ childrenGap: 4 }}>
                                      <Text className="font-semibold">Issue Date</Text>
                                      <Text>{formatDate(license.issueDate)}</Text>
                                    </Stack>
                                    <Stack tokens={{ childrenGap: 4 }}>
                                      <Text className="font-semibold">Expiry Date</Text>
                                      <Text>{formatDate(license.expiryDate)}</Text>
                                    </Stack>
                                  </Stack>

                                  {license.documentUrl && (
                                    <div>
                                      <Text className="font-semibold">License Document</Text>
                                      <img
                                        src={license.documentUrl}
                                        alt="SIA License"
                                        className={styles.documentPreview}
                                      />
                                    </div>
                                  )}
                                </Stack>
                              </div>
                            );
                          })}
                        </Stack>
                      )}
                    </Stack>
                  </Card>
                </PivotItem>
                <PivotItem headerText="Bank Details">
                  <Card>
                    <Stack tokens={{ childrenGap: 16 }}>
                      <div className={styles.sectionTitle}>
                        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                          <Text variant="large">Bank Details</Text>
                          {!isEditingBank ? (
                            <DefaultButton
                              text="Edit"
                              iconProps={{ iconName: 'Edit' }}
                              onClick={() => setIsEditingBank(true)}
                            />
                          ) : null}
                        </Stack>
                      </div>

                      {isEditingBank ? (
                        <form onSubmit={bankDetailsFormik.handleSubmit}>
                          <Stack tokens={{ childrenGap: 16 }}>
                            <TextField
                              label="Account Name"
                              name="accountName"
                              value={bankDetailsFormik.values.accountName}
                              onChange={bankDetailsFormik.handleChange}
                              onBlur={bankDetailsFormik.handleBlur}
                              errorMessage={
                                bankDetailsFormik.touched.accountName && bankDetailsFormik.errors.accountName
                                  ? bankDetailsFormik.errors.accountName
                                  : undefined
                              }
                              required
                            />

                            <div className={styles.formRow}>
                              <div className={styles.formColumn}>
                                <TextField
                                  label="Account Number"
                                  name="accountNumber"
                                  value={bankDetailsFormik.values.accountNumber}
                                  onChange={bankDetailsFormik.handleChange}
                                  onBlur={bankDetailsFormik.handleBlur}
                                  errorMessage={
                                    bankDetailsFormik.touched.accountNumber && bankDetailsFormik.errors.accountNumber
                                      ? bankDetailsFormik.errors.accountNumber
                                      : undefined
                                  }
                                  required
                                />
                              </div>
                              <div className={styles.formColumn}>
                                <TextField
                                  label="Sort Code"
                                  name="sortCode"
                                  value={bankDetailsFormik.values.sortCode}
                                  onChange={bankDetailsFormik.handleChange}
                                  onBlur={bankDetailsFormik.handleBlur}
                                  errorMessage={
                                    bankDetailsFormik.touched.sortCode && bankDetailsFormik.errors.sortCode
                                      ? bankDetailsFormik.errors.sortCode
                                      : undefined
                                  }
                                  required
                                />
                              </div>
                            </div>

                            <TextField
                              label="Bank Name"
                              name="bankName"
                              value={bankDetailsFormik.values.bankName}
                              onChange={bankDetailsFormik.handleChange}
                              onBlur={bankDetailsFormik.handleBlur}
                              errorMessage={
                                bankDetailsFormik.touched.bankName && bankDetailsFormik.errors.bankName
                                  ? bankDetailsFormik.errors.bankName
                                  : undefined
                              }
                              required
                            />

                            <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
                              <DefaultButton
                                text="Cancel"
                                onClick={() => {
                                  setIsEditingBank(false);
                                  bankDetailsFormik.resetForm();
                                }}
                              />
                              <PrimaryButton
                                text="Save"
                                type="submit"
                                disabled={!bankDetailsFormik.dirty || !bankDetailsFormik.isValid}
                              />
                            </Stack>
                          </Stack>
                        </form>
                      ) : (
                        <Stack tokens={{ childrenGap: 12 }}>
                          {profile?.bankDetails ? (
                            <>
                              <div className={styles.formRow}>
                                <div className={styles.formColumn}>
                                  <Label>Account Name</Label>
                                  <Text>{profile.bankDetails.accountName || '-'}</Text>
                                </div>
                                <div className={styles.formColumn}>
                                  <Label>Bank Name</Label>
                                  <Text>{profile.bankDetails.bankName || '-'}</Text>
                                </div>
                              </div>

                              <div className={styles.formRow}>
                                <div className={styles.formColumn}>
                                  <Label>Account Number</Label>
                                  <Text>••••••{profile.bankDetails.accountNumber.slice(-2) || '-'}</Text>
                                </div>
                                <div className={styles.formColumn}>
                                  <Label>Sort Code</Label>
                                  <Text>{profile.bankDetails.sortCode || '-'}</Text>
                                </div>
                              </div>

                              <Text variant="small" style={{ color: '#666' }}>
                                Your bank details are used for payment processing. They are encrypted and stored securely.
                              </Text>
                            </>
                          ) : (
                            <Text>No bank details added yet. Click "Edit" to add your bank details.</Text>
                          )}
                        </Stack>
                      )}
                    </Stack>
                  </Card>
                </PivotItem>
                <PivotItem headerText="Security">
                  <Card>
                    <Stack tokens={{ childrenGap: 16 }}>
                      <div className={styles.sectionTitle}>
                        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                          <Text variant="large">Password & Security</Text>
                          {!isEditingPassword ? (
                            <DefaultButton
                              text="Change Password"
                              iconProps={{ iconName: 'Lock' }}
                              onClick={() => setIsEditingPassword(true)}
                            />
                          ) : null}
                        </Stack>
                      </div>

                      {isEditingPassword ? (
                        <form onSubmit={passwordChangeFormik.handleSubmit}>
                          <Stack tokens={{ childrenGap: 16 }}>
                            <TextField
                              label="Current Password"
                              name="currentPassword"
                              type="password"
                              value={passwordChangeFormik.values.currentPassword}
                              onChange={passwordChangeFormik.handleChange}
                              onBlur={passwordChangeFormik.handleBlur}
                              errorMessage={
                                passwordChangeFormik.touched.currentPassword && passwordChangeFormik.errors.currentPassword
                                  ? passwordChangeFormik.errors.currentPassword
                                  : undefined
                              }
                              required
                            />

                            <TextField
                              label="New Password"
                              name="newPassword"
                              type="password"
                              value={passwordChangeFormik.values.newPassword}
                              onChange={passwordChangeFormik.handleChange}
                              onBlur={passwordChangeFormik.handleBlur}
                              errorMessage={
                                passwordChangeFormik.touched.newPassword && passwordChangeFormik.errors.newPassword
                                  ? passwordChangeFormik.errors.newPassword
                                  : undefined
                              }
                              required
                            />

                            <TextField
                              label="Confirm New Password"
                              name="confirmPassword"
                              type="password"
                              value={passwordChangeFormik.values.confirmPassword}
                              onChange={passwordChangeFormik.handleChange}
                              onBlur={passwordChangeFormik.handleBlur}
                              errorMessage={
                                passwordChangeFormik.touched.confirmPassword && passwordChangeFormik.errors.confirmPassword
                                  ? passwordChangeFormik.errors.confirmPassword
                                  : undefined
                              }
                              required
                            />

                            <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
                              <DefaultButton
                                text="Cancel"
                                onClick={() => {
                                  setIsEditingPassword(false);
                                  passwordChangeFormik.resetForm();
                                }}
                              />
                              <PrimaryButton
                                text="Change Password"
                                type="submit"
                                disabled={!passwordChangeFormik.isValid || !passwordChangeFormik.dirty}
                              />
                            </Stack>
                          </Stack>
                        </form>
                      ) : (
                        <Stack tokens={{ childrenGap: 16 }}>
                          <Text>Your password was last changed on {profile?.passwordLastChanged || 'N/A'}</Text>
                          <Text>
                            For security reasons, it's recommended to change your password regularly. Your password should be strong and include:
                          </Text>
                          <ul className="list-disc pl-8">
                            <li>At least 8 characters</li>
                            <li>Upper and lowercase letters</li>
                            <li>Numbers</li>
                            <li>Special characters</li>
                          </ul>
                          <Text variant="small" style={{ color: '#666' }}>
                            This system uses encrypted connections and your password is securely hashed.
                          </Text>
                        </Stack>
                      )}
                    </Stack>
                  </Card>
                </PivotItem>
              </Pivot>

              {/* SIA License Dialog */}
              <Dialog
                hidden={!showAddLicenseDialog}
                onDismiss={() => {
                  setShowAddLicenseDialog(false);
                  setEditingLicense(null);
                  licenseFormik.resetForm();
                }}
                dialogContentProps={{
                  type: DialogType.normal,
                  title: editingLicense ? 'Edit SIA License' : 'Add SIA License',
                  subText: 'Please enter your SIA License details'
                }}
                modalProps={{
                  isBlocking: true,
                  styles: { main: { maxWidth: 500 } }
                }}
              >
                <form onSubmit={licenseFormik.handleSubmit}>
                  <Stack tokens={{ childrenGap: 16 }}>
                    <TextField
                      label="License Number"
                      name="licenseNumber"
                      value={licenseFormik.values.licenseNumber}
                      onChange={licenseFormik.handleChange}
                      onBlur={licenseFormik.handleBlur}
                      errorMessage={
                        licenseFormik.touched.licenseNumber && licenseFormik.errors.licenseNumber
                          ? licenseFormik.errors.licenseNumber
                          : undefined
                      }
                      required
                      disabled={editingLicense !== null}
                    />

                    <Dropdown
                      label="License Type"
                      selectedKey={licenseFormik.values.licenseType}
                      onChange={(_, option) => option && licenseFormik.setFieldValue('licenseType', option.key)}
                      options={licenseTypeOptions}
                      errorMessage={
                        licenseFormik.touched.licenseType && licenseFormik.errors.licenseType
                          ? licenseFormik.errors.licenseType
                          : undefined
                      }
                      required
                    />

                    <DatePicker
                      label="Issue Date"
                      value={licenseFormik.values.issueDate || undefined}
                      onSelectDate={(date) => licenseFormik.setFieldValue('issueDate', date)}
                      isRequired
                      strings={{
                        months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
                        shortMonths: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                        days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                        shortDays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
                        goToToday: 'Go to today',
                        isRequiredErrorMessage: 'Issue date is required'
                      }}
                    />

                    <DatePicker
                      label="Expiry Date"
                      value={licenseFormik.values.expiryDate || undefined}
                      onSelectDate={(date) => licenseFormik.setFieldValue('expiryDate', date)}
                      isRequired
                      minDate={licenseFormik.values.issueDate || undefined}
                      strings={{
                        months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
                        shortMonths: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                        days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                        shortDays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
                        goToToday: 'Go to today',
                        isRequiredErrorMessage: 'Expiry date is required'
                      }}
                    />

                    <Stack tokens={{ childrenGap: 4 }}>
                      <Label required={false}>License Document</Label>
                      <DefaultButton
                        text="Upload License Document"
                        iconProps={{ iconName: 'Upload' }}
                        onClick={() => licenseFileInputRef.current?.click()}
                        className={styles.fileUploadButton}
                      />
                      <input
                        type="file"
                        ref={licenseFileInputRef}
                        onChange={handleLicenseFileChange}
                        accept="image/*,.pdf"
                        style={{ display: 'none' }}
                      />
                      {licenseFormik.values.documentFile && (
                        <Text variant="small">Selected file: {licenseFormik.values.documentFile.name}</Text>
                      )}
                      {editingLicense?.documentUrl && !licenseFormik.values.documentFile && (
                        <div>
                          <Text variant="small">Current document:</Text>
                          <img
                            src={editingLicense.documentUrl}
                            alt="SIA License"
                            className={styles.documentPreview}
                          />
                        </div>
                      )}
                    </Stack>
                  </Stack>

                  <DialogFooter>
                    <PrimaryButton
                      text={editingLicense ? 'Save Changes' : 'Add License'}
                      type="submit"
                      disabled={!licenseFormik.isValid || addingLicense}
                    />
                    <DefaultButton
                      text="Cancel"
                      onClick={() => {
                        setShowAddLicenseDialog(false);
                        setEditingLicense(null);
                        licenseFormik.resetForm();
                      }}
                      disabled={addingLicense}
                    />
                  </DialogFooter>
                </form>
              </Dialog>
            </Stack>
          ) : (
            <Text>Failed to load profile. Please refresh the page.</Text>
          )}
        </Stack>
      </div>
    </MainLayout>
  );
};

export default ProfilePage;
