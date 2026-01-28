import type React from 'react';
import { useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { BentoDashboard } from '../../components';

const BentoDashboardPage: React.FC = () => {
  const { authState } = useAuth();
  const navigate = useNavigate();

  // Verify user is admin before rendering
  useEffect(() => {
    if (!authState.user || !authState.currentMembership) {
      return;
    }

    const membershipRole = authState.currentMembership.role.toLowerCase();
    const isAdmin = membershipRole === 'admin' || membershipRole === 'owner';

    if (!isAdmin) {
      navigate('/dashboard', { replace: true });
    }
  }, [authState.user, authState.currentMembership, navigate]);

  // Early return if user is not admin
  if (authState.user && authState.currentMembership) {
    const membershipRole = authState.currentMembership.role.toLowerCase();
    const isAdmin = membershipRole === 'admin' || membershipRole === 'owner';

    if (!isAdmin) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <BentoDashboard />;
};

export default BentoDashboardPage;
