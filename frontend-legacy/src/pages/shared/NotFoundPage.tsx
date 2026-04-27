import type React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <div className="max-w-lg p-8 bg-white rounded-xl shadow-sm border border-gray-200 text-center space-y-5">
        <svg className="w-16 h-16 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <h1 className="text-5xl font-bold text-gray-900">404</h1>
        <h2 className="text-xl font-semibold text-gray-900">Page not found</h2>
        <p className="text-sm text-gray-500">The page you are looking for does not exist or has been moved.</p>
        <button
          onClick={() => navigate('/')}
          className="px-5 h-10 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
        >
          Go to dashboard
        </button>
      </div>
    </div>
  );
};

export default NotFoundPage;
