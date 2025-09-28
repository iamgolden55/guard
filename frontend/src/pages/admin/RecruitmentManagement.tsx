import React, { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  DetailsList,
  DetailsListLayoutMode,
  IColumn,
  SelectionMode,
  CommandBar,
  ICommandBarItemProps,
  SearchBox,
  Dropdown,
  IDropdownOption,
  DatePicker,
  DefaultButton,
  PrimaryButton,
  Panel,
  PanelType,
  Dialog,
  DialogFooter,
  DialogContent,
  TextField,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  Label,
  Separator,
  Icon,
  TooltipHost,
  Persona,
  PersonaSize,
  ConstrainMode,
  CheckboxVisibility,
  IconButton
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { recruitmentService, RecruitmentApplication, ApplicationFilters } from '../../services/recruitmentService';
import { employmentTypeService, EmploymentType } from '../../services/employmentTypeService';
import companyService from '../../services/companyService';
import ApplicationCard from '../../components/ApplicationCard';
import useIsMobile from '../../hooks/useIsMobile';

const statusOptions: IDropdownOption[] = [
  { key: '', text: 'All Applications' },
  { key: 'pending', text: 'Pending Review' },
  { key: 'approved', text: 'Approved' },
  { key: 'rejected', text: 'Rejected' }
];

const RecruitmentManagement: React.FC = () => {
  const [applications, setApplications] = useState<RecruitmentApplication[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isMobile = useIsMobile();
  
  // Filters
  const [filters, setFilters] = useState<ApplicationFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  
  // Panels and dialogs
  const [selectedApplication, setSelectedApplication] = useState<RecruitmentApplication | null>(null);
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [isRejectionDialogOpen, setIsRejectionDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  
  // Form states
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [companySlug, setCompanySlug] = useState<string | null>(null);
  const [recruitmentUrl, setRecruitmentUrl] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [applicationsData, employmentTypesData, companyData] = await Promise.all([
        recruitmentService.getApplications(filters).catch(err => {
          console.error('Applications fetch error:', err);
          console.error('Full error:', err.response?.data || err);
          return [];
        }),
        employmentTypeService.getEmploymentTypes().catch(err => {
          console.error('Employment types fetch error:', err);
          console.error('Full error:', err.response?.data || err);
          return [];
        }),
        companyService.getCurrentCompanyContext().catch(err => {
          console.error('Company fetch error:', err);
          return null;
        })
      ]);
      
      const applications = Array.isArray(applicationsData) ? applicationsData : (applicationsData?.results || []);
      const employmentTypes = Array.isArray(employmentTypesData) ? employmentTypesData : (employmentTypesData?.results || []);
      
      console.log('Applications loaded:', applications);
      console.log('Employment types loaded:', employmentTypes);
      console.log('Company data loaded:', companyData);

      // Process company data and generate recruitment URL
      if (companyData?.company?.slug) {
        const slug = companyData.company.slug;
        setCompanySlug(slug);
        const baseUrl = window.location.origin;
        const url = `${baseUrl}/apply/${slug}`;
        setRecruitmentUrl(url);
        console.log('Setting recruitment URL:', url);
      } else {
        console.log('No company slug found in data:', companyData);
      }

      setApplications(applications);
      setEmploymentTypes(employmentTypes);
    } catch (err) {
      setError('Failed to load data');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const copyRecruitmentUrl = async () => {
    try {
      await navigator.clipboard.writeText(recruitmentUrl);
      showSuccess('Recruitment URL copied to clipboard!');
    } catch (err) {
      setError('Failed to copy URL to clipboard');
    }
  };

  const handleApprove = async () => {
    if (!selectedApplication) return;
    
    try {
      setSubmitting(true);
      await recruitmentService.approveApplication(selectedApplication.id, adminNotes);
      setIsApprovalDialogOpen(false);
      setAdminNotes('');
      await loadData();
      showSuccess('Application approved successfully');
    } catch (err) {
      setError('Failed to approve application');
      console.error('Error approving application:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApplication || !adminNotes.trim()) {
      setError('Rejection notes are required');
      return;
    }
    
    try {
      setSubmitting(true);
      await recruitmentService.rejectApplication(selectedApplication.id, adminNotes);
      setIsRejectionDialogOpen(false);
      setAdminNotes('');
      await loadData();
      showSuccess('Application rejected successfully');
    } catch (err) {
      setError('Failed to reject application');
      console.error('Error rejecting application:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvertToUser = async () => {
    if (!selectedApplication) return;
    
    try {
      setSubmitting(true);
      const result = await recruitmentService.convertToUser(selectedApplication.id);
      setIsConvertDialogOpen(false);
      await loadData();
      showSuccess(`Application converted to user account: ${result.user.username}`);
    } catch (err) {
      setError('Failed to convert application to user');
      console.error('Error converting application:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const openDetailsPanel = (application: RecruitmentApplication) => {
    setSelectedApplication(application);
    setIsDetailsPanelOpen(true);
  };

  const openApprovalDialog = (application: RecruitmentApplication) => {
    setSelectedApplication(application);
    setAdminNotes('');
    setIsApprovalDialogOpen(true);
  };

  const openRejectionDialog = (application: RecruitmentApplication) => {
    setSelectedApplication(application);
    setAdminNotes('');
    setIsRejectionDialogOpen(true);
  };

  const openConvertDialog = (application: RecruitmentApplication) => {
    setSelectedApplication(application);
    setIsConvertDialogOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return { iconName: 'Clock', color: '#ffb900' };
      case 'approved':
        return { iconName: 'CheckMark', color: '#107c10' };
      case 'rejected':
        return { iconName: 'Cancel', color: '#d13438' };
      default:
        return { iconName: 'Unknown', color: '#666' };
    }
  };

  const filteredApplications = Array.isArray(applications) ? applications.filter(app => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        app.full_name.toLowerCase().includes(query) ||
        app.email.toLowerCase().includes(query) ||
        app.phone_number.includes(query)
      );
    }
    return true;
  }) : [];

  const columns: IColumn[] = [
    {
      key: 'status',
      name: 'Status',
      fieldName: 'status',
      minWidth: 120,
      maxWidth: 140,
      isResizable: true,
      onRender: (item: RecruitmentApplication) => {
        const statusIcon = getStatusIcon(item.status);
        return (
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
            <Icon iconName={statusIcon.iconName} style={{ color: statusIcon.color }} />
            <Text style={{ textTransform: 'capitalize' }}>{item.status}</Text>
          </Stack>
        );
      }
    },
    {
      key: 'applicant',
      name: 'Applicant',
      fieldName: 'full_name',
      minWidth: 250,
      maxWidth: 350,
      isResizable: true,
      onRender: (item: RecruitmentApplication) => (
        <Persona
          text={item.full_name}
          secondaryText={item.email}
          size={PersonaSize.size32}
          onClick={() => openDetailsPanel(item)}
          style={{ cursor: 'pointer' }}
        />
      )
    },
    {
      key: 'employment_type',
      name: 'Employment Type',
      fieldName: 'employment_type',
      minWidth: 180,
      maxWidth: 220,
      isResizable: true,
      onRender: (item: RecruitmentApplication) => (
        <Text>{item.employment_type_details?.name || 'Unknown'}</Text>
      )
    },
    {
      key: 'sia_licence',
      name: 'SIA Licence',
      fieldName: 'has_sia_licence',
      minWidth: 120,
      maxWidth: 140,
      isResizable: true,
      onRender: (item: RecruitmentApplication) => (
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }}>
          <Icon 
            iconName={item.has_sia_licence ? 'CheckMark' : 'Cancel'} 
            style={{ color: item.has_sia_licence ? '#107c10' : '#d13438' }}
          />
          <Text>{item.has_sia_licence ? 'Yes' : 'No'}</Text>
        </Stack>
      )
    },
    {
      key: 'application_date',
      name: 'Applied',
      fieldName: 'application_date',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: RecruitmentApplication) => (
        <Text>{new Date(item.application_date).toLocaleDateString()}</Text>
      )
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 280,
      maxWidth: 300,
      isResizable: true,
      onRender: (item: RecruitmentApplication) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          <DefaultButton
            text="View"
            iconProps={{ iconName: 'View' }}
            onClick={() => openDetailsPanel(item)}
          />
          {item.status === 'pending' && (
            <>
              <PrimaryButton
                text="Approve"
                iconProps={{ iconName: 'CheckMark' }}
                onClick={() => openApprovalDialog(item)}
              />
              <DefaultButton
                text="Reject"
                iconProps={{ iconName: 'Cancel' }}
                onClick={() => openRejectionDialog(item)}
                style={{ color: '#d13438' }}
              />
            </>
          )}
          {item.status === 'approved' && !item.converted_to_user && (
            <PrimaryButton
              text="Convert"
              iconProps={{ iconName: 'AddFriend' }}
              onClick={() => openConvertDialog(item)}
            />
          )}
        </Stack>
      )
    }
  ];

  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: { iconName: 'Refresh' },
      onClick: loadData
    },
    {
      key: 'export',
      text: 'Export',
      iconProps: { iconName: 'Download' },
      onClick: () => {
        // TODO: Implement export functionality
        console.log('Export functionality to be implemented');
      }
    }
  ];

  const employmentTypeOptions: IDropdownOption[] = [
    { key: '', text: 'All Employment Types' },
    ...(Array.isArray(employmentTypes) ? employmentTypes.map(type => ({ key: type.id, text: type.name })) : [])
  ];

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: isMobile ? 16 : 20 }} style={{ padding: isMobile ? '0 8px' : '0 16px' }}>
        <Stack 
          horizontal={!isMobile} 
          horizontalAlign="space-between" 
          verticalAlign="center"
          tokens={{ childrenGap: isMobile ? 8 : 0 }}
        >
          <Text variant={isMobile ? "xLarge" : "xxLarge"}>Recruitment Management</Text>
          <Text variant={isMobile ? "small" : "medium"} style={{ color: '#666' }}>
            Total: {applications.length} applications
          </Text>
        </Stack>

        {/* Recruitment Link Section */}
        {recruitmentUrl && (
          <Stack tokens={{ childrenGap: 12 }} styles={{
            root: {
              backgroundColor: '#f3f2f1',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #edebe9'
            }
          }}>
            <Text variant="large" style={{ fontWeight: 600 }}>
              Company Recruitment Link
            </Text>
            <Text variant="medium" style={{ color: '#666' }}>
              Share this unique link with candidates to apply for positions at your company.
              Only employment types for your company will be shown.
            </Text>
            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
              <TextField
                value={recruitmentUrl}
                readOnly
                style={{ flex: 1 }}
                styles={{
                  root: { maxWidth: isMobile ? '100%' : '500px' },
                  fieldGroup: { backgroundColor: 'white' }
                }}
              />
              <TooltipHost content="Copy recruitment URL">
                <IconButton
                  iconProps={{ iconName: 'Copy' }}
                  title="Copy URL"
                  onClick={copyRecruitmentUrl}
                  styles={{
                    root: {
                      backgroundColor: '#0078d4',
                      color: 'white',
                      borderRadius: '4px'
                    },
                    rootHovered: {
                      backgroundColor: '#106ebe'
                    }
                  }}
                />
              </TooltipHost>
              <TooltipHost content="Open recruitment page">
                <IconButton
                  iconProps={{ iconName: 'NavigateExternalInline' }}
                  title="Open URL"
                  onClick={() => window.open(recruitmentUrl, '_blank')}
                  styles={{
                    root: {
                      backgroundColor: '#107c10',
                      color: 'white',
                      borderRadius: '4px'
                    },
                    rootHovered: {
                      backgroundColor: '#0e6f0e'
                    }
                  }}
                />
              </TooltipHost>
            </Stack>
          </Stack>
        )}

        {error && (
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={false}
            onDismiss={() => setError(null)}
          >
            {error}
          </MessageBar>
        )}

        {successMessage && (
          <MessageBar
            messageBarType={MessageBarType.success}
            isMultiline={false}
            onDismiss={() => setSuccessMessage(null)}
          >
            {successMessage}
          </MessageBar>
        )}

        {/* Filters */}
        <Stack tokens={{ childrenGap: isMobile ? 12 : 16 }}>
          <SearchBox
            placeholder="Search by name, email, or phone"
            value={searchQuery}
            onChange={(_, newValue) => setSearchQuery(newValue || '')}
            style={{ 
              width: '100%',
              maxWidth: isMobile ? 'none' : '400px'
            }}
          />
          
          <Stack horizontal={!isMobile} tokens={{ childrenGap: 12 }} wrap>
            <Dropdown
              placeholder="Filter by status"
              options={statusOptions}
              selectedKey={filters.status || ''}
              onChange={(_, option) => setFilters({ ...filters, status: option?.key as string })}
              style={{ 
                minWidth: isMobile ? '100%' : '150px',
                maxWidth: isMobile ? 'none' : '150px'
              }}
            />
            
            <Dropdown
              placeholder="Filter by employment type"
              options={employmentTypeOptions}
              selectedKey={filters.employment_type || ''}
              onChange={(_, option) => setFilters({ 
                ...filters, 
                employment_type: option?.key ? parseInt(option.key as string) : undefined 
              })}
              style={{ 
                minWidth: isMobile ? '100%' : '200px',
                maxWidth: isMobile ? 'none' : '200px'
              }}
            />
            
            <Stack horizontal={!isMobile} tokens={{ childrenGap: 8 }}>
              <DatePicker
                placeholder="Start date"
                value={filters.start_date ? new Date(filters.start_date) : undefined}
                onSelectDate={(date) => setFilters({ 
                  ...filters, 
                  start_date: date?.toISOString().split('T')[0] 
                })}
                styles={{
                  root: { 
                    width: isMobile ? '100%' : '140px'
                  }
                }}
              />
              
              <DatePicker
                placeholder="End date"
                value={filters.end_date ? new Date(filters.end_date) : undefined}
                onSelectDate={(date) => setFilters({ 
                  ...filters, 
                  end_date: date?.toISOString().split('T')[0] 
                })}
                styles={{
                  root: { 
                    width: isMobile ? '100%' : '140px'
                  }
                }}
              />
            </Stack>
          </Stack>
        </Stack>

        <CommandBar 
          items={commandBarItems} 
          styles={{
            root: {
              padding: isMobile ? '0 8px' : '0 16px'
            }
          }}
        />

        {loading ? (
          <Spinner label="Loading applications..." size={SpinnerSize.large} />
        ) : isMobile ? (
          <Stack tokens={{ childrenGap: 12 }}>
            {filteredApplications.length > 0 ? (
              filteredApplications.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  onView={openDetailsPanel}
                  onApprove={application.status === 'pending' ? openApprovalDialog : undefined}
                  onReject={application.status === 'pending' ? openRejectionDialog : undefined}
                  onConvert={application.status === 'approved' && !application.converted_to_user ? openConvertDialog : undefined}
                  isMobile={true}
                />
              ))
            ) : (
              <Stack 
                horizontalAlign="center" 
                verticalAlign="center" 
                style={{ 
                  padding: '40px 20px',
                  textAlign: 'center'
                }}
              >
                <Icon iconName="SearchIssue" style={{ fontSize: '48px', color: '#666', marginBottom: '16px' }} />
                <Text variant="mediumPlus" style={{ color: '#666' }}>
                  No applications found
                </Text>
                <Text variant="medium" style={{ color: '#999' }}>
                  Try adjusting your search criteria or filters
                </Text>
              </Stack>
            )}
          </Stack>
        ) : (
          <DetailsList
            items={filteredApplications}
            columns={columns}
            setKey="set"
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.none}
            isHeaderVisible={true}
            constrainMode={ConstrainMode.unconstrained}
            checkboxVisibility={CheckboxVisibility.hidden}
          />
        )}

        {/* Application Details Panel */}
        <Panel
          isOpen={isDetailsPanelOpen}
          onDismiss={() => setIsDetailsPanelOpen(false)}
          type={isMobile ? PanelType.custom : PanelType.large}
          customWidth={isMobile ? '100%' : undefined}
          headerText="Application Details"
          styles={{
            main: {
              paddingTop: isMobile ? '48px' : '16px'
            },
            content: {
              paddingLeft: isMobile ? '16px' : '24px',
              paddingRight: isMobile ? '16px' : '24px'
            }
          }}
        >
          {selectedApplication && (
            <Stack tokens={{ childrenGap: 20 }}>
              {/* Personal Details */}
              <Stack tokens={{ childrenGap: 12 }}>
                <Text variant="large" style={{ fontWeight: 'semibold' }}>
                  Personal Details
                </Text>
                <Stack tokens={{ childrenGap: 8 }}>
                  <Text><strong>Name:</strong> {selectedApplication.full_name}</Text>
                  <Text><strong>Date of Birth:</strong> {new Date(selectedApplication.date_of_birth).toLocaleDateString()}</Text>
                  <Text><strong>Email:</strong> {selectedApplication.email}</Text>
                  <Text><strong>Phone:</strong> {selectedApplication.phone_number}</Text>
                  <Text><strong>Address:</strong> {selectedApplication.home_address}</Text>
                  <Text><strong>Postcode:</strong> {selectedApplication.postcode}</Text>
                </Stack>
              </Stack>

              <Separator />

              {/* SIA Licence Details */}
              <Stack tokens={{ childrenGap: 12 }}>
                <Text variant="large" style={{ fontWeight: 'semibold' }}>
                  SIA Licence Details
                </Text>
                <Stack tokens={{ childrenGap: 8 }}>
                  <Text><strong>Has SIA Licence:</strong> {selectedApplication.has_sia_licence ? 'Yes' : 'No'}</Text>
                  {selectedApplication.has_sia_licence && (
                    <>
                      <Text><strong>Licence Number:</strong> {selectedApplication.sia_licence_number}</Text>
                      <Text><strong>Licence Types:</strong> {selectedApplication.licence_types.join(', ')}</Text>
                      <Text><strong>Expiry Date:</strong> {selectedApplication.licence_expiry_date ? new Date(selectedApplication.licence_expiry_date).toLocaleDateString() : 'N/A'}</Text>
                    </>
                  )}
                  <Text><strong>Suspended/Revoked:</strong> {selectedApplication.licence_suspended_revoked ? 'Yes' : 'No'}</Text>
                  {selectedApplication.licence_suspended_revoked && (
                    <Text><strong>Details:</strong> {selectedApplication.licence_suspension_details}</Text>
                  )}
                </Stack>
              </Stack>

              <Separator />

              {/* Employment Preferences */}
              <Stack tokens={{ childrenGap: 12 }}>
                <Text variant="large" style={{ fontWeight: 'semibold' }}>
                  Employment Preferences
                </Text>
                <Stack tokens={{ childrenGap: 8 }}>
                  <Text><strong>Employment Type:</strong> {selectedApplication.employment_type_details?.name}</Text>
                  <Text><strong>Hours per Week:</strong> {selectedApplication.hours_per_week}</Text>
                  <Text><strong>Availability:</strong></Text>
                  <Stack style={{ marginLeft: 16 }}>
                    <Text>• Days: {selectedApplication.availability_days ? 'Yes' : 'No'}</Text>
                    <Text>• Nights: {selectedApplication.availability_nights ? 'Yes' : 'No'}</Text>
                    <Text>• Weekends: {selectedApplication.availability_weekends ? 'Yes' : 'No'}</Text>
                    <Text>• Holidays: {selectedApplication.availability_holidays ? 'Yes' : 'No'}</Text>
                  </Stack>
                  <Text><strong>Willing to Travel:</strong> {selectedApplication.willing_to_travel ? 'Yes' : 'No'}</Text>
                  <Text><strong>Has Transport:</strong> {selectedApplication.has_transport ? 'Yes' : 'No'}</Text>
                  <Text><strong>Has Commitments:</strong> {selectedApplication.has_commitments ? 'Yes' : 'No'}</Text>
                  {selectedApplication.has_commitments && (
                    <Text><strong>Commitment Details:</strong> {selectedApplication.commitments_details}</Text>
                  )}
                </Stack>
              </Stack>

              <Separator />

              {/* Experience and Skills */}
              <Stack tokens={{ childrenGap: 12 }}>
                <Text variant="large" style={{ fontWeight: 'semibold' }}>
                  Experience and Skills
                </Text>
                <Stack tokens={{ childrenGap: 8 }}>
                  <Text><strong>Security Experience:</strong> {selectedApplication.has_security_experience ? 'Yes' : 'No'}</Text>
                  {selectedApplication.has_security_experience && (
                    <Text><strong>Experience Details:</strong> {selectedApplication.security_experience_details}</Text>
                  )}
                  <Text><strong>Certifications:</strong> {selectedApplication.certifications.join(', ') || 'None'}</Text>
                  {selectedApplication.certifications.includes('other') && (
                    <Text><strong>Other Certifications:</strong> {selectedApplication.other_certification_details}</Text>
                  )}
                </Stack>
              </Stack>

              <Separator />

              {/* Additional Information */}
              <Stack tokens={{ childrenGap: 12 }}>
                <Text variant="large" style={{ fontWeight: 'semibold' }}>
                  Additional Information
                </Text>
                <Stack tokens={{ childrenGap: 8 }}>
                  <Text><strong>Eligible to Work in UK:</strong> {selectedApplication.eligible_to_work_uk ? 'Yes' : 'No'}</Text>
                  <Text><strong>Criminal Convictions:</strong> {selectedApplication.has_criminal_convictions ? 'Yes' : 'No'}</Text>
                  {selectedApplication.has_criminal_convictions && (
                    <Text><strong>Conviction Details:</strong> {selectedApplication.criminal_convictions_details}</Text>
                  )}
                </Stack>
              </Stack>

              <Separator />

              {/* Application Status */}
              <Stack tokens={{ childrenGap: 12 }}>
                <Text variant="large" style={{ fontWeight: 'semibold' }}>
                  Application Status
                </Text>
                <Stack tokens={{ childrenGap: 8 }}>
                  <Text><strong>Status:</strong> {selectedApplication.status}</Text>
                  <Text><strong>Applied:</strong> {new Date(selectedApplication.application_date).toLocaleString()}</Text>
                  {selectedApplication.reviewed_at && (
                    <>
                      <Text><strong>Reviewed:</strong> {new Date(selectedApplication.reviewed_at).toLocaleString()}</Text>
                      <Text><strong>Reviewed By:</strong> {selectedApplication.reviewed_by_details?.username}</Text>
                    </>
                  )}
                  {selectedApplication.admin_notes && (
                    <Text><strong>Admin Notes:</strong> {selectedApplication.admin_notes}</Text>
                  )}
                  {selectedApplication.converted_to_user && (
                    <Text><strong>Converted to User:</strong> {selectedApplication.converted_user_details?.username}</Text>
                  )}
                  <Text><strong>Digital Signature:</strong> {selectedApplication.digital_signature}</Text>
                </Stack>
              </Stack>

              {/* Action Buttons */}
              {selectedApplication.status === 'pending' && (
                <Stack horizontal tokens={{ childrenGap: 12 }}>
                  <PrimaryButton
                    text="Approve Application"
                    iconProps={{ iconName: 'CheckMark' }}
                    onClick={() => openApprovalDialog(selectedApplication)}
                  />
                  <DefaultButton
                    text="Reject Application"
                    iconProps={{ iconName: 'Cancel' }}
                    onClick={() => openRejectionDialog(selectedApplication)}
                  />
                </Stack>
              )}

              {selectedApplication.status === 'approved' && !selectedApplication.converted_to_user && (
                <PrimaryButton
                  text="Convert to User Account"
                  iconProps={{ iconName: 'AddFriend' }}
                  onClick={() => openConvertDialog(selectedApplication)}
                />
              )}
            </Stack>
          )}
        </Panel>

        {/* Approval Dialog */}
        <Dialog
          hidden={!isApprovalDialogOpen}
          onDismiss={() => setIsApprovalDialogOpen(false)}
          dialogContentProps={{
            type: 'normal',
            title: 'Approve Application',
            subText: `Are you sure you want to approve the application from ${selectedApplication?.full_name}?`
          }}
        >
          <DialogContent>
            <TextField
              label="Admin Notes (Optional)"
              multiline
              rows={3}
              value={adminNotes}
              onChange={(_, newValue) => setAdminNotes(newValue || '')}
              placeholder="Add any notes about this approval..."
            />
          </DialogContent>
          <DialogFooter>
            <PrimaryButton
              text="Approve"
              onClick={handleApprove}
              disabled={submitting}
            />
            <DefaultButton
              text="Cancel"
              onClick={() => setIsApprovalDialogOpen(false)}
              disabled={submitting}
            />
          </DialogFooter>
        </Dialog>

        {/* Rejection Dialog */}
        <Dialog
          hidden={!isRejectionDialogOpen}
          onDismiss={() => setIsRejectionDialogOpen(false)}
          dialogContentProps={{
            type: 'normal',
            title: 'Reject Application',
            subText: `Please provide a reason for rejecting the application from ${selectedApplication?.full_name}.`
          }}
        >
          <DialogContent>
            <TextField
              label="Rejection Reason *"
              multiline
              rows={4}
              value={adminNotes}
              onChange={(_, newValue) => setAdminNotes(newValue || '')}
              placeholder="Please provide a detailed reason for rejection..."
              required
            />
          </DialogContent>
          <DialogFooter>
            <PrimaryButton
              text="Reject"
              onClick={handleReject}
              disabled={submitting || !adminNotes.trim()}
              style={{ backgroundColor: '#d13438' }}
            />
            <DefaultButton
              text="Cancel"
              onClick={() => setIsRejectionDialogOpen(false)}
              disabled={submitting}
            />
          </DialogFooter>
        </Dialog>

        {/* Convert to User Dialog */}
        <Dialog
          hidden={!isConvertDialogOpen}
          onDismiss={() => setIsConvertDialogOpen(false)}
          dialogContentProps={{
            type: 'normal',
            title: 'Convert to User Account',
            subText: `This will create a user account for ${selectedApplication?.full_name} and grant them access to the system. Are you sure you want to proceed?`
          }}
        >
          <DialogFooter>
            <PrimaryButton
              text="Convert"
              onClick={handleConvertToUser}
              disabled={submitting}
            />
            <DefaultButton
              text="Cancel"
              onClick={() => setIsConvertDialogOpen(false)}
              disabled={submitting}
            />
          </DialogFooter>
        </Dialog>
      </Stack>
    </MainLayout>
  );
};

export default RecruitmentManagement;