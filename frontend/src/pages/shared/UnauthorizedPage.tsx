import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <div className="max-w-lg p-8 bg-white rounded-xl shadow-sm border border-gray-200 text-center space-y-5">
        <svg className="w-16 h-16 text-red-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h2 className="text-xl font-semibold text-gray-900">Access denied</h2>
        <p className="text-sm text-gray-500">
          You do not have permission to access this page. Contact your administrator if you believe you should have access.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="px-5 h-10 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Go to dashboard
          </button>
          <button
            onClick={handleLogout}
            className="px-5 h-10 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
