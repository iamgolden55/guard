import React, { useState, useEffect } from 'react';
import { Header, Container, CloudscapeTable, StatusIndicator, EmptyState, ConfirmationModal, SpaceBetween, Alert, KeyValuePairs } from '../../components/cloudscape';
import Flashbar, { useFlashbar } from '../../components/cloudscape/Flashbar';
import type { ColumnDefinition } from '../../components/cloudscape/CloudscapeTable';
import { recruitmentService, RecruitmentApplication, ApplicationFilters } from '../../services/recruitmentService';
import { employmentTypeService, EmploymentType } from '../../services/employmentTypeService';
import companyService from '../../services/companyService';
import useIsMobile from '../../hooks/useIsMobile';

const statusFilterOptions = [
  { key: '', label: 'All applications' },
  { key: 'pending', label: 'Pending review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const RecruitmentManagement: React.FC = () => {
  const [applications, setApplications] = useState<RecruitmentApplication[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const { items: flashItems, addFlash, removeFlash } = useFlashbar();

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

      const apps = Array.isArray(applicationsData) ? applicationsData : ((applicationsData as any)?.results || []);
      const empTypes = Array.isArray(employmentTypesData) ? employmentTypesData : ((employmentTypesData as any)?.results || []);

      console.log('Applications loaded:', apps);
      console.log('Employment types loaded:', empTypes);
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

      setApplications(apps);
      setEmploymentTypes(empTypes);
    } catch (err) {
      addFlash({ type: 'error', content: 'Failed to load data' });
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (message: string) => {
    addFlash({ type: 'success', content: message });
  };

  const copyRecruitmentUrl = async () => {
    try {
      await navigator.clipboard.writeText(recruitmentUrl);
      showSuccess('Recruitment URL copied to clipboard!');
    } catch (err) {
      addFlash({ type: 'error', content: 'Failed to copy URL to clipboard' });
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
      addFlash({ type: 'error', content: 'Failed to approve application' });
      console.error('Error approving application:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApplication || !adminNotes.trim()) {
      addFlash({ type: 'error', content: 'Rejection notes are required' });
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
      addFlash({ type: 'error', content: 'Failed to reject application' });
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
      addFlash({ type: 'error', content: 'Failed to convert application to user' });
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

  const employmentTypeOptions = [
    { key: '', label: 'All employment types' },
    ...(Array.isArray(employmentTypes) ? employmentTypes.map(type => ({ key: String(type.id), label: type.name })) : [])
  ];

  const columns: ColumnDefinition<RecruitmentApplication>[] = [
    {
      id: 'status',
      header: 'Status',
      width: 130,
      cell: (item) => {
        switch (item.status) {
          case 'pending':
            return <StatusIndicator type="pending">Pending</StatusIndicator>;
          case 'approved':
            return <StatusIndicator type="success">Approved</StatusIndicator>;
          case 'rejected':
            return <StatusIndicator type="error">Rejected</StatusIndicator>;
          default:
            return <StatusIndicator type="info">{item.status}</StatusIndicator>;
        }
      },
    },
    {
      id: 'applicant',
      header: 'Applicant',
      cell: (item) => (
        <button
          onClick={() => openDetailsPanel(item)}
          className="text-left group"
        >
          <p className="text-sm font-medium text-gray-900 group-hover:text-red-600 transition-colors">{item.full_name}</p>
          <p className="text-xs text-gray-500">{item.email}</p>
        </button>
      ),
    },
    {
      id: 'employment_type',
      header: 'Employment type',
      cell: (item) => (
        <span className="text-sm text-gray-700">{item.employment_type_details?.name || 'Unknown'}</span>
      ),
    },
    {
      id: 'sia_licence',
      header: 'SIA licence',
      width: 120,
      cell: (item) => (
        item.has_sia_licence
          ? <StatusIndicator type="success">Yes</StatusIndicator>
          : <StatusIndicator type="error">No</StatusIndicator>
      ),
    },
    {
      id: 'application_date',
      header: 'Applied',
      width: 130,
      cell: (item) => (
        <span className="text-sm text-gray-700">{new Date(item.application_date).toLocaleDateString()}</span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      minWidth: 280,
      cell: (item) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openDetailsPanel(item)}
            className="px-3 h-8 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
          >
            View application
          </button>
          {item.status === 'pending' && (
            <>
              <button
                onClick={() => openApprovalDialog(item)}
                className="px-3 h-8 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => openRejectionDialog(item)}
                className="px-3 h-8 text-xs font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300 transition-colors"
              >
                Reject
              </button>
            </>
          )}
          {item.status === 'approved' && !item.converted_to_user && (
            <button
              onClick={() => openConvertDialog(item)}
              className="px-3 h-8 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
            >
              Convert to user
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        counter={`${applications.length}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50 transition-colors"
            >
              Refresh
            </button>
          </div>
        }
      >
        Recruitment management
      </Header>

      <Flashbar items={flashItems} onDismiss={removeFlash} />

      {/* Recruitment link section */}
      {recruitmentUrl && (
        <Container
          header={
            <Header variant="h2" description="Share this unique link with candidates to apply for positions at your company. Only employment types for your company will be shown.">
              Company recruitment link
            </Header>
          }
        >
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="text"
              value={recruitmentUrl}
              readOnly
              className="flex-1 h-10 px-3 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <div className="flex gap-2">
              <button
                onClick={copyRecruitmentUrl}
                title="Copy recruitment URL"
                className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
              >
                Copy URL
              </button>
              <button
                onClick={() => window.open(recruitmentUrl, '_blank')}
                title="Open recruitment page"
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
              >
                Open page
              </button>
            </div>
          </div>
        </Container>
      )}

      {/* Filters */}
      <Container>
        <SpaceBetween size="m">
          <input
            type="text"
            placeholder="Search by name, email, or phone"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent min-w-[160px]"
            >
              {statusFilterOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>

            <select
              value={filters.employment_type || ''}
              onChange={(e) => setFilters({
                ...filters,
                employment_type: e.target.value ? parseInt(e.target.value) : undefined
              })}
              className="h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent min-w-[200px]"
            >
              {employmentTypeOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>

            <input
              type="date"
              placeholder="Start date"
              value={filters.start_date || ''}
              onChange={(e) => setFilters({
                ...filters,
                start_date: e.target.value || undefined
              })}
              className="h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />

            <input
              type="date"
              placeholder="End date"
              value={filters.end_date || ''}
              onChange={(e) => setFilters({
                ...filters,
                end_date: e.target.value || undefined
              })}
              className="h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </SpaceBetween>
      </Container>

      {/* Applications table */}
      <CloudscapeTable
        items={filteredApplications}
        columnDefinitions={columns}
        loading={loading}
        loadingText="Loading applications"
        trackBy="id"
        header={
          <Header variant="h2" counter={`${filteredApplications.length}`}>
            Applications
          </Header>
        }
        empty={
          <EmptyState
            title="No applications found"
            description="Try adjusting your search criteria or filters."
            variant="no-match"
          />
        }
      />

      {/* Application details slide-over panel */}
      {isDetailsPanelOpen && selectedApplication && (
        <div className="fixed inset-0 z-[2000] flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setIsDetailsPanelOpen(false)}
            aria-hidden="true"
          />
          {/* Panel */}
          <div className={`absolute right-0 top-0 h-full bg-white shadow-xl overflow-y-auto ${isMobile ? 'w-full' : 'w-[640px] max-w-full'}`}>
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Application details</h2>
              <button
                onClick={() => setIsDetailsPanelOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close panel"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <SpaceBetween size="l">
                {/* Personal details */}
                <Container header={<Header variant="h3">Personal details</Header>}>
                  <KeyValuePairs
                    columns={2}
                    items={[
                      { label: 'Name', value: selectedApplication.full_name },
                      { label: 'Date of birth', value: new Date(selectedApplication.date_of_birth).toLocaleDateString() },
                      { label: 'Email', value: selectedApplication.email },
                      { label: 'Phone', value: selectedApplication.phone_number },
                      { label: 'Address', value: selectedApplication.home_address },
                      { label: 'Postcode', value: selectedApplication.postcode },
                    ]}
                  />
                </Container>

                {/* SIA licence details */}
                <Container header={<Header variant="h3">SIA licence details</Header>}>
                  <KeyValuePairs
                    columns={2}
                    items={[
                      {
                        label: 'Has SIA licence',
                        value: selectedApplication.has_sia_licence
                          ? <StatusIndicator type="success">Yes</StatusIndicator>
                          : <StatusIndicator type="error">No</StatusIndicator>
                      },
                      ...(selectedApplication.has_sia_licence ? [
                        { label: 'Licence number', value: selectedApplication.sia_licence_number },
                        { label: 'Licence types', value: selectedApplication.licence_types.join(', ') },
                        { label: 'Expiry date', value: selectedApplication.licence_expiry_date ? new Date(selectedApplication.licence_expiry_date).toLocaleDateString() : 'N/A' },
                      ] : []),
                      {
                        label: 'Suspended/Revoked',
                        value: selectedApplication.licence_suspended_revoked
                          ? <StatusIndicator type="error">Yes</StatusIndicator>
                          : <StatusIndicator type="success">No</StatusIndicator>
                      },
                      ...(selectedApplication.licence_suspended_revoked ? [
                        { label: 'Suspension details', value: selectedApplication.licence_suspension_details },
                      ] : []),
                    ]}
                  />
                </Container>

                {/* Employment preferences */}
                <Container header={<Header variant="h3">Employment preferences</Header>}>
                  <KeyValuePairs
                    columns={2}
                    items={[
                      { label: 'Employment type', value: selectedApplication.employment_type_details?.name },
                      { label: 'Hours per week', value: selectedApplication.hours_per_week },
                      {
                        label: 'Availability',
                        value: (
                          <div className="flex flex-col gap-1">
                            <span>Days: {selectedApplication.availability_days ? 'Yes' : 'No'}</span>
                            <span>Nights: {selectedApplication.availability_nights ? 'Yes' : 'No'}</span>
                            <span>Weekends: {selectedApplication.availability_weekends ? 'Yes' : 'No'}</span>
                            <span>Holidays: {selectedApplication.availability_holidays ? 'Yes' : 'No'}</span>
                          </div>
                        ),
                      },
                      {
                        label: 'Willing to travel',
                        value: selectedApplication.willing_to_travel ? 'Yes' : 'No',
                      },
                      {
                        label: 'Has transport',
                        value: selectedApplication.has_transport ? 'Yes' : 'No',
                      },
                      {
                        label: 'Has commitments',
                        value: selectedApplication.has_commitments ? 'Yes' : 'No',
                      },
                      ...(selectedApplication.has_commitments ? [
                        { label: 'Commitment details', value: selectedApplication.commitments_details },
                      ] : []),
                    ]}
                  />
                </Container>

                {/* Experience and skills */}
                <Container header={<Header variant="h3">Experience and skills</Header>}>
                  <KeyValuePairs
                    columns={2}
                    items={[
                      {
                        label: 'Security experience',
                        value: selectedApplication.has_security_experience ? 'Yes' : 'No',
                      },
                      ...(selectedApplication.has_security_experience ? [
                        { label: 'Experience details', value: selectedApplication.security_experience_details },
                      ] : []),
                      {
                        label: 'Certifications',
                        value: selectedApplication.certifications.join(', ') || 'None',
                      },
                      ...(selectedApplication.certifications.includes('other') ? [
                        { label: 'Other certifications', value: selectedApplication.other_certification_details },
                      ] : []),
                    ]}
                  />
                </Container>

                {/* Additional information */}
                <Container header={<Header variant="h3">Additional information</Header>}>
                  <KeyValuePairs
                    columns={2}
                    items={[
                      {
                        label: 'Eligible to work in UK',
                        value: selectedApplication.eligible_to_work_uk
                          ? <StatusIndicator type="success">Yes</StatusIndicator>
                          : <StatusIndicator type="error">No</StatusIndicator>
                      },
                      {
                        label: 'Criminal convictions',
                        value: selectedApplication.has_criminal_convictions
                          ? <StatusIndicator type="warning">Yes</StatusIndicator>
                          : <StatusIndicator type="success">No</StatusIndicator>
                      },
                      ...(selectedApplication.has_criminal_convictions ? [
                        { label: 'Conviction details', value: selectedApplication.criminal_convictions_details },
                      ] : []),
                    ]}
                  />
                </Container>

                {/* Application status */}
                <Container header={<Header variant="h3">Application status</Header>}>
                  <KeyValuePairs
                    columns={2}
                    items={[
                      {
                        label: 'Status',
                        value: (() => {
                          switch (selectedApplication.status) {
                            case 'pending': return <StatusIndicator type="pending">Pending</StatusIndicator>;
                            case 'approved': return <StatusIndicator type="success">Approved</StatusIndicator>;
                            case 'rejected': return <StatusIndicator type="error">Rejected</StatusIndicator>;
                            default: return selectedApplication.status;
                          }
                        })(),
                      },
                      { label: 'Applied', value: new Date(selectedApplication.application_date).toLocaleString() },
                      ...(selectedApplication.reviewed_at ? [
                        { label: 'Reviewed', value: new Date(selectedApplication.reviewed_at).toLocaleString() },
                        { label: 'Reviewed by', value: selectedApplication.reviewed_by_details?.username },
                      ] : []),
                      ...(selectedApplication.admin_notes ? [
                        { label: 'Admin notes', value: selectedApplication.admin_notes },
                      ] : []),
                      ...(selectedApplication.converted_to_user ? [
                        { label: 'Converted to user', value: selectedApplication.converted_user_details?.username },
                      ] : []),
                      { label: 'Digital signature', value: selectedApplication.digital_signature },
                    ]}
                  />
                </Container>

                {/* Action buttons */}
                {selectedApplication.status === 'pending' && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openApprovalDialog(selectedApplication)}
                      className="px-4 h-9 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
                    >
                      Approve application
                    </button>
                    <button
                      onClick={() => openRejectionDialog(selectedApplication)}
                      className="px-4 h-9 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300 transition-colors"
                    >
                      Reject application
                    </button>
                  </div>
                )}

                {selectedApplication.status === 'approved' && !selectedApplication.converted_to_user && (
                  <button
                    onClick={() => openConvertDialog(selectedApplication)}
                    className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                  >
                    Convert to user account
                  </button>
                )}
              </SpaceBetween>
            </div>
          </div>
        </div>
      )}

      {/* Approval dialog */}
      {isApprovalDialogOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setIsApprovalDialogOpen(false)}
            aria-hidden="true"
          />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full" role="dialog" aria-modal="true">
            <div className="px-6 pt-6 pb-0">
              <h2 className="text-lg font-semibold text-gray-900">Approve application</h2>
              <p className="text-sm text-gray-500 mt-1">
                Are you sure you want to approve the application from {selectedApplication?.full_name}?
              </p>
            </div>
            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin notes (optional)</label>
              <textarea
                rows={3}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add any notes about this approval..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
              <button
                onClick={() => setIsApprovalDialogOpen(false)}
                disabled={submitting}
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="px-4 h-9 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Approving...' : 'Approve application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection dialog */}
      {isRejectionDialogOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setIsRejectionDialogOpen(false)}
            aria-hidden="true"
          />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full" role="dialog" aria-modal="true">
            <div className="px-6 pt-6 pb-0">
              <h2 className="text-lg font-semibold text-gray-900">Reject application</h2>
              <p className="text-sm text-gray-500 mt-1">
                Please provide a reason for rejecting the application from {selectedApplication?.full_name}.
              </p>
            </div>
            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rejection reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Please provide a detailed reason for rejection..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                required
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
              <button
                onClick={() => setIsRejectionDialogOpen(false)}
                disabled={submitting}
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={submitting || !adminNotes.trim()}
                className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Rejecting...' : 'Reject application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to user dialog */}
      <ConfirmationModal
        visible={isConvertDialogOpen}
        header="Convert to user account"
        confirmLabel="Convert to user"
        cancelLabel="Cancel"
        onConfirm={handleConvertToUser}
        onCancel={() => setIsConvertDialogOpen(false)}
        loading={submitting}
      >
        <p>
          This will create a user account for <span className="font-medium">{selectedApplication?.full_name}</span> and
          grant them access to the system. Are you sure you want to proceed?
        </p>
      </ConfirmationModal>
    </SpaceBetween>
  );
};

export default RecruitmentManagement;
