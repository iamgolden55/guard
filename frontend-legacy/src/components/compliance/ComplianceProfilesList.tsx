import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Input,
  Select,
  SelectOnChangeData,
  Spinner,
  MessageBar,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent
} from '@fluentui/react-components';
import {
  Add24Regular,
  Filter24Regular,
  Search24Regular,
  Eye24Regular,
  Checkmark24Regular,
  Dismiss24Regular
} from '@fluentui/react-icons';
import { ComplianceService } from '../../services/complianceService';
import { ComplianceProfile, RegionalPreset } from '../../types/compliance';
import ComplianceProfileCard from './ComplianceProfileCard';
import ComplianceProfileForm from './ComplianceProfileForm';
import ProfileComparisonModal from './ProfileComparisonModal';
import RegionalPresetSelector from './RegionalPresetSelector';

interface ComplianceProfilesListProps {
  className?: string;
}

const ComplianceProfilesList: React.FC<ComplianceProfilesListProps> = ({ className = '' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedProfiles, setSelectedProfiles] = useState<number[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [showComparisonDialog, setShowComparisonDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ComplianceProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Fetch profiles
  const { data: profilesData, isLoading, error: queryError } = useQuery({
    queryKey: ['compliance-profiles'],
    queryFn: async () => {
      const response = await ComplianceService.getAllProfiles();
      return response.results;
    },
    refetchOnWindowFocus: false,
  });

  // Fetch regional presets
  const { data: regionalPresets } = useQuery({
    queryKey: ['regional-presets'],
    queryFn: async () => {
      const response = await ComplianceService.getRegionalPresets();
      return response.data;
    },
    refetchOnWindowFocus: false,
  });

  // Set active profile mutation
  const setActiveProfileMutation = useMutation({
    mutationFn: (profileId: number) => ComplianceService.setActiveProfile(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-profiles'] });
      setSuccess('Profile activated successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to activate profile');
      setTimeout(() => setError(null), 5000);
    },
  });

  // Apply regional preset mutation
  const applyPresetMutation = useMutation({
    mutationFn: ({ profileId, regionCode }: { profileId: number; regionCode: string }) =>
      ComplianceService.applyRegionalPreset(profileId, regionCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-profiles'] });
      setSuccess('Regional preset applied successfully');
      setShowPresetDialog(false);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to apply regional preset');
      setTimeout(() => setError(null), 5000);
    },
  });

  // Filter profiles
  const filteredProfiles = React.useMemo(() => {
    if (!profilesData) return [];

    return profilesData.filter(profile => {
      const matchesSearch = profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           profile.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter = filterStatus === 'all' ||
                           (filterStatus === 'active' && profile.is_active) ||
                           (filterStatus === 'inactive' && !profile.is_active);

      return matchesSearch && matchesFilter;
    });
  }, [profilesData, searchTerm, filterStatus]);

  const handleProfileSelect = (profileId: number, selected: boolean) => {
    if (selected) {
      setSelectedProfiles(prev => [...prev, profileId]);
    } else {
      setSelectedProfiles(prev => prev.filter(id => id !== profileId));
    }
  };

  const handleSetActive = (profileId: number) => {
    setActiveProfileMutation.mutate(profileId);
  };

  const handleEdit = (profile: ComplianceProfile) => {
    setEditingProfile(profile);
    setShowCreateDialog(true);
  };

  const handleCreateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['compliance-profiles'] });
    setShowCreateDialog(false);
    setEditingProfile(null);
    setSuccess('Profile saved successfully');
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleApplyPreset = (profileId: number, regionCode: string) => {
    applyPresetMutation.mutate({ profileId, regionCode });
  };

  const handleCompareProfiles = () => {
    if (selectedProfiles.length >= 2) {
      setShowComparisonDialog(true);
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <Spinner size="large" label="Loading compliance profiles..." />
      </div>
    );
  }

  if (queryError) {
    return (
      <div className={`${className}`}>
        <MessageBar intent="error">
          Failed to load compliance profiles: {(queryError as Error).message}
        </MessageBar>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Profiles</h1>
          <p className="text-gray-600">Manage organization compliance profiles and regional settings</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            appearance="primary"
            icon={<Add24Regular />}
            onClick={() => setShowCreateDialog(true)}
          >
            Create Profile
          </Button>

          {selectedProfiles.length >= 2 && (
            <Button
              appearance="secondary"
              icon={<Eye24Regular />}
              onClick={handleCompareProfiles}
            >
              Compare ({selectedProfiles.length})
            </Button>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <MessageBar intent="error">
          {error}
        </MessageBar>
      )}

      {success && (
        <MessageBar intent="success">
          {success}
        </MessageBar>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search profiles..."
              value={searchTerm}
              onChange={(_, data) => setSearchTerm(data.value)}
              contentBefore={<Search24Regular />}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter24Regular className="text-gray-500" />
            <Select
              value={filterStatus}
              onSelectionChange={(_, data) => {
                if (data.value) {
                  setFilterStatus(data.value as 'all' | 'active' | 'inactive');
                }
              }}
            >
              <option value="all">All Profiles</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProfiles.map((profile) => (
          <ComplianceProfileCard
            key={profile.id}
            profile={profile}
            selected={selectedProfiles.includes(profile.id)}
            onSelect={(selected) => handleProfileSelect(profile.id, selected)}
            onEdit={() => handleEdit(profile)}
            onSetActive={() => handleSetActive(profile.id)}
            onApplyPreset={(regionCode) => handleApplyPreset(profile.id, regionCode)}
            isSettingActive={setActiveProfileMutation.isPending}
            isApplyingPreset={applyPresetMutation.isPending}
          />
        ))}
      </div>

      {filteredProfiles.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Add24Regular className="text-gray-400 text-2xl" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No profiles found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || filterStatus !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first compliance profile to get started'}
          </p>
          {(!searchTerm && filterStatus === 'all') && (
            <Button
              appearance="primary"
              icon={<Add24Regular />}
              onClick={() => setShowCreateDialog(true)}
            >
              Create Profile
            </Button>
          )}
        </div>
      )}

      {/* Create/Edit Profile Modal */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full mx-4 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingProfile ? 'Edit Profile' : 'Create Compliance Profile'}
              </h2>
              <Button
                appearance="subtle"
                icon={<Dismiss24Regular />}
                onClick={() => {
                  setShowCreateDialog(false);
                  setEditingProfile(null);
                }}
              />
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ComplianceProfileForm
                profile={editingProfile}
                onSuccess={handleCreateSuccess}
                onCancel={() => {
                  setShowCreateDialog(false);
                  setEditingProfile(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Regional Preset Dialog */}
      <Dialog open={showPresetDialog} onOpenChange={(_, data) => setShowPresetDialog(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Apply Regional Preset</DialogTitle>
            <DialogContent>
              {regionalPresets && (
                <RegionalPresetSelector
                  presets={regionalPresets}
                  onSelect={(regionCode) => {
                    if (selectedProfiles.length === 1) {
                      handleApplyPreset(selectedProfiles[0], regionCode);
                    }
                  }}
                  onCancel={() => setShowPresetDialog(false)}
                />
              )}
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Profile Comparison Dialog */}
      <Dialog open={showComparisonDialog} onOpenChange={(_, data) => setShowComparisonDialog(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Compare Profiles</DialogTitle>
            <DialogContent>
              <ProfileComparisonModal
                profileIds={selectedProfiles}
                onClose={() => setShowComparisonDialog(false)}
              />
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default ComplianceProfilesList;