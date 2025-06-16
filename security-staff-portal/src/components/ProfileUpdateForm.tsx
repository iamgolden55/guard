import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getProfile, updateProfile } from '../services/api';
import { UserRole } from '../types/auth';

interface ProfileData {
  id?: number;
  user?: number;
  phone_number: string;
  date_of_birth?: string;
  national_insurance_number?: string;
  street: string;
  city: string;
  postal_code: string;
  country: string;
  profile_image_url?: string;
  notes?: string;
}

// Fields that normal staff users cannot modify
const IMMUTABLE_FIELDS = ['national_insurance_number', 'date_of_birth'];

const ProfileUpdateForm: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [formData, setFormData] = useState<ProfileData>({
    phone_number: '',
    street: '',
    city: '',
    postal_code: '',
    country: '',
    notes: ''
  });

  const { authState } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await getProfile(authState.user?.id);
        if (response.status === 200) {
          setProfile(response.data);
          setFormData(response.data);
        }
      } catch (err) {
        setError('Failed to load profile');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (authState.isAuthenticated && authState.user) {
      fetchProfile();
    }
  }, [authState.isAuthenticated, authState.user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Create a copy of the form data to filter out immutable fields if needed
      let updateData = { ...formData };
      
      // Filter out immutable fields for regular staff users
      if (authState.user?.role === UserRole.STAFF) {
        IMMUTABLE_FIELDS.forEach(field => {
          if (field in updateData) {
            // Delete the immutable field from the update data
            delete updateData[field as keyof ProfileData];
          }
        });
      }
      
      const response = await updateProfile(profile.id, updateData);
      
      if (response.status === 200) {
        setSuccess(true);
        setProfile(response.data);
        
        // Show success message for 3 seconds
        setTimeout(() => {
          setSuccess(false);
        }, 3000);
      }
    } catch (err) {
      setError('Failed to update profile');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !profile) {
    return <div className="text-center p-4">Loading profile...</div>;
  }

  if (error && !profile) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Update Profile</h1>
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          Profile updated successfully!
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} data-testid="profile-form">
        <div className="mb-4">
          <label className="block mb-2">Phone Number</label>
          <input
            type="text"
            name="phone_number"
            value={formData.phone_number}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            data-testid="phone-input"
          />
        </div>
        
        <div className="mb-4">
          <label className="block mb-2">Street</label>
          <input
            type="text"
            name="street"
            value={formData.street}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            data-testid="street-input"
          />
        </div>
        
        <div className="mb-4">
          <label className="block mb-2">City</label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            data-testid="city-input"
          />
        </div>
        
        <div className="mb-4">
          <label className="block mb-2">Postal Code</label>
          <input
            type="text"
            name="postal_code"
            value={formData.postal_code}
            onChange={handleChange}
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div className="mb-4">
          <label className="block mb-2">Country</label>
          <input
            type="text"
            name="country"
            value={formData.country}
            onChange={handleChange}
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div className="mb-4">
          <label className="block mb-2">Notes</label>
          <textarea
            name="notes"
            value={formData.notes || ''}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            rows={4}
            data-testid="notes-input"
          />
        </div>
        
        {/* Render immutable fields as readonly for staff but editable for admin/manager */}
        {profile?.date_of_birth && (
          <div className="mb-4">
            <label className="block mb-2">Date of Birth</label>
            <input
              type="text"
              name="date_of_birth"
              value={profile.date_of_birth}
              readOnly={authState.user?.role === UserRole.STAFF}
              onChange={authState.user?.role !== UserRole.STAFF ? handleChange : undefined}
              className={`w-full p-2 border rounded ${authState.user?.role === UserRole.STAFF ? 'bg-gray-100' : ''}`}
            />
            {authState.user?.role === UserRole.STAFF && (
              <p className="text-xs text-gray-500 mt-1">This field can only be modified by admins or managers.</p>
            )}
          </div>
        )}
        
        {profile?.national_insurance_number && (
          <div className="mb-4">
            <label className="block mb-2">National Insurance Number</label>
            <input
              type="text"
              name="national_insurance_number"
              value={profile.national_insurance_number}
              readOnly={authState.user?.role === UserRole.STAFF}
              onChange={authState.user?.role !== UserRole.STAFF ? handleChange : undefined}
              className={`w-full p-2 border rounded ${authState.user?.role === UserRole.STAFF ? 'bg-gray-100' : ''}`}
            />
            {authState.user?.role === UserRole.STAFF && (
              <p className="text-xs text-gray-500 mt-1">This field can only be modified by admins or managers.</p>
            )}
          </div>
        )}
        
        <div className="mt-6">
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
            disabled={loading}
            data-testid="submit-button"
          >
            {loading ? 'Updating...' : 'Update Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileUpdateForm; 