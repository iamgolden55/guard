import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Stack,
  Text,
  TextField,
  PrimaryButton,
  DefaultButton,
  Checkbox,
  Dropdown,
  IDropdownOption,
  MessageBar,
  MessageBarType,
  Separator,
  Label,
  Panel,
  PanelType,
  Spinner,
  SpinnerSize,
  IStackTokens
} from '@fluentui/react';
import { employmentTypeService, EmploymentType } from '../../services/employmentTypeService';
import { recruitmentService, RecruitmentApplicationRequest } from '../../services/recruitmentService';

const stackTokens: IStackTokens = { childrenGap: 20 };
const sectionTokens: IStackTokens = { childrenGap: 12 };

interface FormData extends RecruitmentApplicationRequest {
  confirmEmail: string;
}

interface FormErrors {
  [key: string]: string;
}

const licenceTypeOptions = [
  { key: 'door_supervisor', text: 'Door Supervisor' },
  { key: 'security_guard', text: 'Security Guard' },
  { key: 'cctv', text: 'CCTV' },
  { key: 'close_protection', text: 'Close Protection' }
];

const certificationOptions = [
  { key: 'first_aid', text: 'First Aid' },
  { key: 'fire_marshal', text: 'Fire Marshal' },
  { key: 'conflict_management', text: 'Conflict Management' },
  { key: 'customer_service', text: 'Customer Service Training' },
  { key: 'other', text: 'Other (please specify)' }
];

const RecruitmentApplication: React.FC = () => {
  const { companySlug } = useParams<{ companySlug?: string }>();
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [companyInfo, setCompanyInfo] = useState<{ name: string; description?: string; logo?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTermsPanel, setShowTermsPanel] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    // Personal Details
    full_name: '',
    date_of_birth: '',
    email: '',
    confirmEmail: '',
    phone_number: '',
    home_address: '',
    postcode: '',
    
    // SIA Licence Details
    has_sia_licence: false,
    sia_licence_number: '',
    licence_types: [],
    licence_expiry_date: '',
    licence_suspended_revoked: false,
    licence_suspension_details: '',
    
    // Employment Preferences
    employment_type: 0,
    hours_per_week: 0,
    availability_days: false,
    availability_nights: false,
    availability_weekends: false,
    availability_holidays: false,
    willing_to_travel: false,
    has_transport: false,
    has_commitments: false,
    commitments_details: '',
    
    // Experience and Skills
    has_security_experience: false,
    security_experience_details: '',
    certifications: [],
    other_certification_details: '',
    
    // Additional Information
    eligible_to_work_uk: false,
    has_criminal_convictions: false,
    criminal_convictions_details: '',
    
    // Application Details
    digital_signature: ''
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    loadData();
  }, [companySlug]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (companySlug) {
        // Load company-specific data
        const [employmentTypesData, companyData] = await Promise.all([
          recruitmentService.getCompanyEmploymentTypes(companySlug),
          recruitmentService.getCompanyInfo(companySlug)
        ]);

        setEmploymentTypes(employmentTypesData);
        setCompanyInfo(companyData);
      } else {
        // Load general employment types (fallback for legacy /recruitment route)
        const types = await employmentTypeService.getActiveEmploymentTypes();
        const employmentTypesArray = Array.isArray(types) ? types : (types?.results || []);
        setEmploymentTypes(employmentTypesArray);
        setCompanyInfo({ name: 'Mead Security Limited' }); // Default company name
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      if (err.response?.status === 404) {
        setError('Company not found or no longer accepting applications');
      } else {
        setError('Failed to load application form');
      }
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    // Personal Details
    if (!formData.full_name.trim()) errors.full_name = 'Full name is required';
    if (!formData.date_of_birth) errors.date_of_birth = 'Date of birth is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    if (!formData.confirmEmail.trim()) errors.confirmEmail = 'Email confirmation is required';
    if (formData.email !== formData.confirmEmail) errors.confirmEmail = 'Emails do not match';
    if (!formData.phone_number.trim()) errors.phone_number = 'Phone number is required';
    if (!formData.home_address.trim()) errors.home_address = 'Home address is required';
    if (!formData.postcode.trim()) errors.postcode = 'Postcode is required';

    // SIA Licence validation
    if (formData.has_sia_licence) {
      if (!formData.sia_licence_number?.trim()) errors.sia_licence_number = 'SIA licence number is required';
      if (formData.licence_types.length === 0) errors.licence_types = 'At least one licence type must be selected';
      if (!formData.licence_expiry_date) errors.licence_expiry_date = 'Licence expiry date is required';
    }

    if (formData.licence_suspended_revoked && !formData.licence_suspension_details?.trim()) {
      errors.licence_suspension_details = 'Please provide details about licence suspension/revocation';
    }

    // Employment Preferences
    if (!formData.employment_type) errors.employment_type = 'Employment type is required';
    if (formData.hours_per_week <= 0) errors.hours_per_week = 'Hours per week must be greater than 0';
    
    if (!formData.availability_days && !formData.availability_nights && 
        !formData.availability_weekends && !formData.availability_holidays) {
      errors.availability = 'At least one availability option must be selected';
    }

    if (formData.has_commitments && !formData.commitments_details?.trim()) {
      errors.commitments_details = 'Please provide details about your commitments';
    }

    // Experience and Skills
    if (formData.has_security_experience && !formData.security_experience_details?.trim()) {
      errors.security_experience_details = 'Please provide details about your security experience';
    }

    if (formData.certifications.includes('other') && !formData.other_certification_details?.trim()) {
      errors.other_certification_details = 'Please specify your other certifications';
    }

    // Additional Information
    if (!formData.eligible_to_work_uk) errors.eligible_to_work_uk = 'You must be eligible to work in the UK';

    if (formData.has_criminal_convictions && !formData.criminal_convictions_details?.trim()) {
      errors.criminal_convictions_details = 'Please provide details about your criminal convictions';
    }

    // Terms and signature
    if (!termsAccepted) errors.terms = 'You must accept the terms and conditions';
    if (!formData.digital_signature.trim()) errors.digital_signature = 'Digital signature is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setError('Please correct the errors in the form');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Prepare submission data (remove confirmEmail)
      const { confirmEmail, ...submissionData } = formData;

      // Use company-specific endpoint if company slug is available
      const result = companySlug
        ? await recruitmentService.submitCompanyApplication(companySlug, submissionData)
        : await recruitmentService.submitApplication(submissionData);

      setSubmitted(true);
      
    } catch (err: any) {
      // Handle validation errors from Django REST Framework serializer
      if (err.response?.data) {
        const errorData = err.response.data;

        // If it's a simple error message
        if (typeof errorData === 'string') {
          setError(errorData);
        }
        // If it's a detail field
        else if (errorData.detail) {
          setError(errorData.detail);
        }
        // If it's a generic error field
        else if (errorData.error) {
          setError(errorData.error);
        }
        // If it's validation errors from serializer (field-specific errors)
        else if (typeof errorData === 'object') {
          const errorMessages = Object.entries(errorData)
            .map(([field, messages]) => {
              const msgArray = Array.isArray(messages) ? messages : [messages];
              return `${field}: ${msgArray.join(', ')}`;
            })
            .join('; ');
          setError(errorMessages || 'Failed to submit application. Please check your form.');
        } else {
          setError('Failed to submit application. Please try again.');
        }
      } else {
        setError('Failed to submit application. Please try again.');
      }
      console.error('Error submitting application:', err);
      console.error('Error response data:', err.response?.data);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFieldChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleLicenceTypeChange = (option: IDropdownOption, checked?: boolean) => {
    const currentTypes = formData.licence_types;
    if (checked) {
      setFormData(prev => ({
        ...prev,
        licence_types: [...currentTypes, option.key as string]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        licence_types: currentTypes.filter(type => type !== option.key)
      }));
    }
  };

  const handleCertificationChange = (option: IDropdownOption, checked?: boolean) => {
    const currentCerts = formData.certifications;
    if (checked) {
      setFormData(prev => ({
        ...prev,
        certifications: [...currentCerts, option.key as string]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        certifications: currentCerts.filter(cert => cert !== option.key)
      }));
    }
  };

  if (loading) {
    return (
      <Stack horizontalAlign="center" verticalAlign="center" style={{ minHeight: '400px' }}>
        <Spinner label="Loading application form..." size={SpinnerSize.large} />
      </Stack>
    );
  }

  if (submitted) {
    return (
      <Stack tokens={stackTokens} style={{ maxWidth: 600, margin: '0 auto', padding: 40 }}>
        <MessageBar messageBarType={MessageBarType.success}>
          <Text variant="mediumPlus" style={{ fontWeight: 'semibold' }}>
            Application Submitted Successfully!
          </Text>
        </MessageBar>
        
        <Stack tokens={sectionTokens}>
          <Text variant="large">Thank you for your application!</Text>
          <Text>
            Your recruitment application has been submitted successfully. You will receive a confirmation 
            email shortly at {formData.email}.
          </Text>
          <Text>
            Our HR team will review your application and contact you within 5-7 business days.
            If you have any questions, please contact us at {companyInfo?.contact_email || 'our support team'}.
          </Text>
        </Stack>
      </Stack>
    );
  }

  const employmentTypeOptions: IDropdownOption[] = employmentTypes.map(type => ({
    key: type.id,
    text: type.name
  }));

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 40 }}>
      <Stack tokens={stackTokens}>
        {/* Header */}
        <Stack tokens={sectionTokens}>
          <Text variant="xxLarge" style={{ fontWeight: 'bold', color: '#0078d4' }}>
            {companyInfo?.name || 'Security Company'}
          </Text>
          <Text variant="xLarge">Recruitment Questionnaire</Text>
          {companyInfo?.description && (
            <Text style={{ fontStyle: 'italic', color: '#666' }}>
              {companyInfo.description}
            </Text>
          )}
          <Text>
            Thank you for your interest in joining our security team. Please complete all sections
            of this application form. All fields marked with * are required.
          </Text>
        </Stack>

        {error && (
          <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setError(null)}>
            {error}
          </MessageBar>
        )}

        <form onSubmit={handleSubmit}>
          <Stack tokens={stackTokens}>
            
            {/* Personal Details */}
            <Stack tokens={sectionTokens}>
              <Text variant="xLarge" style={{ fontWeight: 'semibold', color: '#0078d4' }}>
                Personal Details
              </Text>
              
              <TextField
                label="Full Name *"
                value={formData.full_name}
                onChange={(_, newValue) => handleFieldChange('full_name', newValue || '')}
                errorMessage={formErrors.full_name}
                required
              />
              
              <Stack tokens={{ childrenGap: 5 }}>
                <Label required>Date of Birth</Label>
                <input
                  type="date"
                  value={formData.date_of_birth || ''}
                  onChange={(e) => handleFieldChange('date_of_birth', e.target.value)}
                  min="1920-01-01"
                  max={new Date().toISOString().split('T')[0]}
                  required
                  className="h-10 px-3 border border-gray-300 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                {formErrors.date_of_birth && (
                  <Text style={{ color: '#d13438', fontSize: '12px' }}>{formErrors.date_of_birth}</Text>
                )}
              </Stack>
              
              <TextField
                label="Email Address *"
                type="email"
                value={formData.email}
                onChange={(_, newValue) => handleFieldChange('email', newValue || '')}
                errorMessage={formErrors.email}
                required
              />
              
              <TextField
                label="Confirm Email Address *"
                type="email"
                value={formData.confirmEmail}
                onChange={(_, newValue) => handleFieldChange('confirmEmail', newValue || '')}
                errorMessage={formErrors.confirmEmail}
                required
              />
              
              <TextField
                label="Phone Number *"
                value={formData.phone_number}
                onChange={(_, newValue) => handleFieldChange('phone_number', newValue || '')}
                errorMessage={formErrors.phone_number}
                required
              />
              
              <TextField
                label="Home Address *"
                multiline
                rows={3}
                value={formData.home_address}
                onChange={(_, newValue) => handleFieldChange('home_address', newValue || '')}
                errorMessage={formErrors.home_address}
                required
              />
              
              <TextField
                label="Postcode *"
                value={formData.postcode}
                onChange={(_, newValue) => handleFieldChange('postcode', newValue || '')}
                errorMessage={formErrors.postcode}
                required
              />
            </Stack>

            <Separator />

            {/* SIA Licence Details */}
            <Stack tokens={sectionTokens}>
              <Text variant="xLarge" style={{ fontWeight: 'semibold', color: '#0078d4' }}>
                SIA Licence Details
              </Text>
              
              <Checkbox
                label="Do you hold a current valid SIA Licence? *"
                checked={formData.has_sia_licence}
                onChange={(_, checked) => handleFieldChange('has_sia_licence', checked || false)}
              />
              
              {formData.has_sia_licence && (
                <Stack tokens={sectionTokens}>
                  <TextField
                    label="SIA Licence Number *"
                    value={formData.sia_licence_number}
                    onChange={(_, newValue) => handleFieldChange('sia_licence_number', newValue || '')}
                    errorMessage={formErrors.sia_licence_number}
                    required
                  />
                  
                  <Label>Type of Licence(s) Held *</Label>
                  <Stack tokens={{ childrenGap: 8 }}>
                    {licenceTypeOptions.map(option => (
                      <Checkbox
                        key={option.key}
                        label={option.text}
                        checked={formData.licence_types.includes(option.key as string)}
                        onChange={(_, checked) => handleLicenceTypeChange(option, checked)}
                      />
                    ))}
                  </Stack>
                  {formErrors.licence_types && (
                    <Text style={{ color: '#d13438', fontSize: '12px' }}>{formErrors.licence_types}</Text>
                  )}
                  
                  <Stack tokens={{ childrenGap: 5 }}>
                    <Label required>Licence Expiry Date</Label>
                    <input
                      type="date"
                      value={formData.licence_expiry_date || ''}
                      onChange={(e) => handleFieldChange('licence_expiry_date', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      required
                      className="h-10 px-3 border border-gray-300 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                    {formErrors.licence_expiry_date && (
                      <Text style={{ color: '#d13438', fontSize: '12px' }}>{formErrors.licence_expiry_date}</Text>
                    )}
                  </Stack>
                </Stack>
              )}
              
              <Checkbox
                label="Have you ever had your licence suspended or revoked?"
                checked={formData.licence_suspended_revoked}
                onChange={(_, checked) => handleFieldChange('licence_suspended_revoked', checked || false)}
              />
              
              {formData.licence_suspended_revoked && (
                <TextField
                  label="If yes, please explain *"
                  multiline
                  rows={3}
                  value={formData.licence_suspension_details}
                  onChange={(_, newValue) => handleFieldChange('licence_suspension_details', newValue || '')}
                  errorMessage={formErrors.licence_suspension_details}
                  required
                />
              )}
            </Stack>

            <Separator />

            {/* Employment Preferences */}
            <Stack tokens={sectionTokens}>
              <Text variant="xLarge" style={{ fontWeight: 'semibold', color: '#0078d4' }}>
                Employment Preferences
              </Text>
              
              <Dropdown
                label="Preferred Employment Type *"
                selectedKey={formData.employment_type}
                options={employmentTypeOptions}
                onChange={(_, option) => handleFieldChange('employment_type', option?.key as number)}
                errorMessage={formErrors.employment_type}
                required
              />
              
              <TextField
                label="How many hours per week are you looking for? *"
                type="number"
                min={1}
                max={168}
                value={formData.hours_per_week.toString()}
                onChange={(_, newValue) => handleFieldChange('hours_per_week', parseInt(newValue || '0'))}
                errorMessage={formErrors.hours_per_week}
                required
              />
              
              <Label>Are you available to work: *</Label>
              <Stack tokens={{ childrenGap: 8 }}>
                <Checkbox
                  label="Days"
                  checked={formData.availability_days}
                  onChange={(_, checked) => handleFieldChange('availability_days', checked || false)}
                />
                <Checkbox
                  label="Nights"
                  checked={formData.availability_nights}
                  onChange={(_, checked) => handleFieldChange('availability_nights', checked || false)}
                />
                <Checkbox
                  label="Weekends"
                  checked={formData.availability_weekends}
                  onChange={(_, checked) => handleFieldChange('availability_weekends', checked || false)}
                />
                <Checkbox
                  label="Public Holidays"
                  checked={formData.availability_holidays}
                  onChange={(_, checked) => handleFieldChange('availability_holidays', checked || false)}
                />
              </Stack>
              {formErrors.availability && (
                <Text style={{ color: '#d13438', fontSize: '12px' }}>{formErrors.availability}</Text>
              )}
              
              <Checkbox
                label="Are you willing to travel nationally for work?"
                checked={formData.willing_to_travel}
                onChange={(_, checked) => handleFieldChange('willing_to_travel', checked || false)}
              />
              
              <Checkbox
                label="Do you have your own transport?"
                checked={formData.has_transport}
                onChange={(_, checked) => handleFieldChange('has_transport', checked || false)}
              />
              
              <Checkbox
                label="Do you have any current commitments that could affect your availability?"
                checked={formData.has_commitments}
                onChange={(_, checked) => handleFieldChange('has_commitments', checked || false)}
              />
              
              {formData.has_commitments && (
                <TextField
                  label="If yes, please explain *"
                  multiline
                  rows={3}
                  value={formData.commitments_details}
                  onChange={(_, newValue) => handleFieldChange('commitments_details', newValue || '')}
                  errorMessage={formErrors.commitments_details}
                  required
                />
              )}
            </Stack>

            <Separator />

            {/* Experience and Skills */}
            <Stack tokens={sectionTokens}>
              <Text variant="xLarge" style={{ fontWeight: 'semibold', color: '#0078d4' }}>
                Experience and Skills
              </Text>
              
              <Checkbox
                label="Do you have previous experience in the security industry?"
                checked={formData.has_security_experience}
                onChange={(_, checked) => handleFieldChange('has_security_experience', checked || false)}
              />
              
              {formData.has_security_experience && (
                <TextField
                  label="If yes, please provide details (roles, companies, length of time) *"
                  multiline
                  rows={4}
                  value={formData.security_experience_details}
                  onChange={(_, newValue) => handleFieldChange('security_experience_details', newValue || '')}
                  errorMessage={formErrors.security_experience_details}
                  required
                />
              )}
              
              <Label>Do you have any of the following certifications/training?</Label>
              <Stack tokens={{ childrenGap: 8 }}>
                {certificationOptions.map(option => (
                  <Checkbox
                    key={option.key}
                    label={option.text}
                    checked={formData.certifications.includes(option.key as string)}
                    onChange={(_, checked) => handleCertificationChange(option, checked)}
                  />
                ))}
              </Stack>
              
              {formData.certifications.includes('other') && (
                <TextField
                  label="Please specify other certifications *"
                  multiline
                  rows={2}
                  value={formData.other_certification_details}
                  onChange={(_, newValue) => handleFieldChange('other_certification_details', newValue || '')}
                  errorMessage={formErrors.other_certification_details}
                  required
                />
              )}
            </Stack>

            <Separator />

            {/* Additional Information */}
            <Stack tokens={sectionTokens}>
              <Text variant="xLarge" style={{ fontWeight: 'semibold', color: '#0078d4' }}>
                Additional Information
              </Text>
              
              <Checkbox
                label="Are you legally eligible to work in the UK? *"
                checked={formData.eligible_to_work_uk}
                onChange={(_, checked) => handleFieldChange('eligible_to_work_uk', checked || false)}
              />
              {formErrors.eligible_to_work_uk && (
                <Text style={{ color: '#d13438', fontSize: '12px' }}>{formErrors.eligible_to_work_uk}</Text>
              )}
              
              <Checkbox
                label="Do you have any unspent criminal convictions?"
                checked={formData.has_criminal_convictions}
                onChange={(_, checked) => handleFieldChange('has_criminal_convictions', checked || false)}
              />
              
              {formData.has_criminal_convictions && (
                <TextField
                  label="If yes, please provide details *"
                  multiline
                  rows={3}
                  value={formData.criminal_convictions_details}
                  onChange={(_, newValue) => handleFieldChange('criminal_convictions_details', newValue || '')}
                  errorMessage={formErrors.criminal_convictions_details}
                  required
                />
              )}
            </Stack>

            <Separator />

            {/* Declaration */}
            <Stack tokens={sectionTokens}>
              <Text variant="xLarge" style={{ fontWeight: 'semibold', color: '#0078d4' }}>
                Declaration
              </Text>
              
              <Text>
                I confirm that the information provided is true and complete to the best of my knowledge. 
                I understand that any false statement may result in my application being rejected or 
                employment being terminated.
              </Text>
              
              <Checkbox
                label="I accept the terms and conditions *"
                checked={termsAccepted}
                onChange={(_, checked) => setTermsAccepted(checked || false)}
              />
              <DefaultButton
                text="View Terms & Conditions"
                onClick={() => setShowTermsPanel(true)}
                style={{ alignSelf: 'flex-start' }}
              />
              {formErrors.terms && (
                <Text style={{ color: '#d13438', fontSize: '12px' }}>{formErrors.terms}</Text>
              )}
              
              <TextField
                label="Digital Signature (Type your full name) *"
                value={formData.digital_signature}
                onChange={(_, newValue) => handleFieldChange('digital_signature', newValue || '')}
                errorMessage={formErrors.digital_signature}
                required
              />
              
              <Text variant="small" style={{ color: '#666' }}>
                Date: {new Date().toLocaleDateString()}
              </Text>
            </Stack>

            {/* Submit Button */}
            <Stack horizontal tokens={{ childrenGap: 16 }} horizontalAlign="center" style={{ marginTop: 30 }}>
              <PrimaryButton
                text={submitting ? "Submitting..." : "Submit Application"}
                type="submit"
                disabled={submitting}
                iconProps={submitting ? { iconName: 'Hourglass' } : { iconName: 'Send' }}
                style={{ minWidth: 150 }}
              />
              {submitting && <Spinner size={SpinnerSize.small} />}
            </Stack>
          </Stack>
        </form>

        {/* Terms Panel */}
        <Panel
          isOpen={showTermsPanel}
          onDismiss={() => setShowTermsPanel(false)}
          type={PanelType.medium}
          headerText="Terms & Conditions"
        >
          <Stack tokens={sectionTokens}>
            <Text variant="medium" style={{ fontWeight: 'semibold' }}>
              {companyInfo?.name || 'Security Company'} - Terms & Conditions
            </Text>
            
            <Text>
              By submitting this application, you agree to the following terms:
            </Text>
            
            <Stack tokens={{ childrenGap: 8 }}>
              <Text>• All information provided must be accurate and truthful</Text>
              <Text>• You consent to background checks and verification of qualifications</Text>
              <Text>• You understand that false information may result in application rejection</Text>
              <Text>• You agree to comply with all company policies and procedures</Text>
              <Text>• You consent to the processing of your personal data for recruitment purposes</Text>
              <Text>• You understand that employment is subject to satisfactory references and checks</Text>
            </Stack>
            
            <Text variant="small">
              Last updated: {new Date().toLocaleDateString()}
            </Text>
          </Stack>
        </Panel>
      </Stack>
    </div>
  );
};

export default RecruitmentApplication;