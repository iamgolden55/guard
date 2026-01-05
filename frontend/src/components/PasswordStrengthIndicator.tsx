import React from 'react';
import { ProgressIndicator } from '@fluentui/react';

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface StrengthResult {
  score: number; // 0-5
  label: string;
  color: string;
  percentage: number;
  feedback: string[];
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
  const calculateStrength = (pwd: string): StrengthResult => {
    if (!pwd) {
      return {
        score: 0,
        label: 'No password',
        color: '#d13438',
        percentage: 0,
        feedback: ['Enter a password to see strength']
      };
    }

    let score = 0;
    const feedback: string[] = [];

    // Length check
    if (pwd.length >= 8) {
      score++;
    } else {
      feedback.push('Use at least 8 characters');
    }

    // Uppercase check
    if (/[A-Z]/.test(pwd)) {
      score++;
    } else {
      feedback.push('Add at least one uppercase letter');
    }

    // Lowercase check
    if (/[a-z]/.test(pwd)) {
      score++;
    } else {
      feedback.push('Add at least one lowercase letter');
    }

    // Number check
    if (/\d/.test(pwd)) {
      score++;
    } else {
      feedback.push('Add at least one number');
    }

    // Special character check
    if (/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(pwd)) {
      score++;
    } else {
      feedback.push('Add at least one special character (!@#$%^&*...)');
    }

    // Bonus for length
    if (pwd.length >= 12) {
      score++;
    }

    // Determine label and color
    let label = '';
    let color = '';

    if (score <= 1) {
      label = 'Very Weak';
      color = '#d13438'; // Red
    } else if (score === 2) {
      label = 'Weak';
      color = '#ff8c00'; // Orange
    } else if (score === 3) {
      label = 'Fair';
      color = '#ffaa44'; // Light orange
    } else if (score === 4) {
      label = 'Good';
      color = '#5cb85c'; // Green
    } else if (score === 5) {
      label = 'Strong';
      color = '#107c10'; // Dark green
    } else {
      label = 'Very Strong';
      color = '#107c10'; // Dark green
    }

    return {
      score,
      label,
      color,
      percentage: (score / 5) * 100,
      feedback: feedback.length > 0 ? feedback : ['Password meets all requirements']
    };
  };

  const strength = calculateStrength(password);

  return (
    <div className="password-strength-indicator" style={{ marginTop: '8px' }}>
      <ProgressIndicator
        label={`Password Strength: ${strength.label}`}
        percentComplete={strength.percentage / 100}
        barHeight={4}
        styles={{
          progressBar: {
            backgroundColor: strength.color
          },
          itemName: {
            fontSize: '14px',
            fontWeight: 600,
            color: strength.color
          }
        }}
      />

      {strength.feedback.length > 0 && (
        <div
          style={{
            marginTop: '8px',
            fontSize: '12px',
            color: '#666'
          }}
        >
          <ul style={{
            margin: 0,
            paddingLeft: '20px',
            listStyleType: strength.score === 5 || strength.score === 6 ? 'none' : 'disc'
          }}>
            {strength.feedback.map((item, index) => (
              <li key={index} style={{ marginBottom: '4px' }}>
                {strength.score === 5 || strength.score === 6 ? '✓ ' : ''}
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;
