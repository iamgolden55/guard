import React from 'react';
import {
  MessageBar,
  MessageBarType,
  Text,
  Icon,
  Stack,
  Link
} from '@fluentui/react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ValidationError } from '../../types/onboarding';

interface ValidationSummaryProps {
  errors: ValidationError[];
  warnings?: string[];
  onFieldFocus?: (fieldName: string) => void;
  className?: string;
}

const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  errors,
  warnings = [],
  onFieldFocus,
  className = ''
}) => {
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  const getFieldDisplayName = (fieldName: string): string => {
    // Convert field names to user-friendly labels
    const fieldMap: Record<string, string> = {
      'companyName': 'Company Name',
      'registrationNumber': 'Registration Number',
      'primaryContact.email': 'Primary Contact Email',
      'primaryContact.firstName': 'Primary Contact First Name',
      'primaryContact.lastName': 'Primary Contact Last Name',
      'primaryContact.phone': 'Primary Contact Phone',
      'address.street': 'Street Address',
      'address.city': 'City',
      'address.state': 'State/Province',
      'address.postalCode': 'Postal Code',
      'address.country': 'Country',
      'primaryRegion': 'Primary Region',
      'operatingRegions': 'Operating Regions',
      'staffSize': 'Staff Size',
      'operationalCapacity.maxConcurrentShifts': 'Maximum Concurrent Shifts',
      'deputy.apiKey': 'Deputy API Key',
      'deputy.subdomain': 'Deputy Subdomain',
      'accounting.credentials.clientId': 'Accounting Client ID',
      'adminUsers': 'Admin Users'
    };

    // Handle array field names like adminUsers.0.email
    const arrayFieldPattern = /^adminUsers\.(\d+)\.(.+)$/;
    const arrayMatch = fieldName.match(arrayFieldPattern);
    if (arrayMatch) {
      const index = parseInt(arrayMatch[1]) + 1;
      const subField = arrayMatch[2];
      const subFieldName = subField.charAt(0).toUpperCase() + subField.slice(1);
      return `Admin User ${index} ${subFieldName}`;
    }

    return fieldMap[fieldName] || fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  const handleFieldClick = (fieldName: string) => {
    if (onFieldFocus) {
      onFieldFocus(fieldName);
    }
  };

  return (
    <div className={className}>
      {/* Animated Errors */}
      <AnimatePresence>
        {errors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              // Add subtle shake to draw attention
              x: [0, -2, 2, -2, 2, 0]
            }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{
              duration: 0.4,
              ease: "easeOut",
              x: { duration: 0.5, ease: "easeInOut", delay: 0.2 }
            }}
          >
            <MessageBar
              messageBarType={MessageBarType.error}
              isMultiline={true}
              styles={{
                root: {
                  marginBottom: 16,
                  border: '2px solid #fca5a5',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)'
                }
              }}
            >
              <Stack tokens={{ childrenGap: 8 }}>
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <Text variant="medium" className="font-semibold">
                    Please fix the following errors:
                  </Text>
                </motion.div>
                <Stack tokens={{ childrenGap: 4 }}>
                  {errors.map((error, index) => (
                    <motion.div
                      key={`error-${index}`}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.2 + (index * 0.1) }}
                      whileHover={{ scale: 1.02, x: 4 }}
                      className="flex items-start space-x-2 p-2 rounded-md hover:bg-red-50 transition-colors"
                    >
                      <motion.div
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ duration: 0.3, delay: 0.3 + (index * 0.1), ease: "backOut" }}
                      >
                        <Icon
                          iconName="StatusErrorFull"
                          styles={{ root: { color: '#dc2626', fontSize: 14 } }}
                        />
                      </motion.div>
                      <div className="flex-1">
                        {onFieldFocus ? (
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Link
                              onClick={() => handleFieldClick(error.field)}
                              styles={{
                                root: {
                                  color: '#dc2626',
                                  textDecoration: 'underline',
                                  fontWeight: 500,
                                  transition: 'all 0.2s ease'
                                }
                              }}
                            >
                              {getFieldDisplayName(error.field)}
                            </Link>
                          </motion.div>
                        ) : (
                          <Text variant="small" className="font-medium text-red-700">
                            {getFieldDisplayName(error.field)}
                          </Text>
                        )}
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2, delay: 0.4 + (index * 0.1) }}
                        >
                          <Text variant="small" className="text-red-600 ml-2">
                            {error.message}
                          </Text>
                        </motion.div>
                      </div>
                    </motion.div>
                  ))}
                </Stack>
              </Stack>
            </MessageBar>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warnings */}
      {warnings.length > 0 && (
        <MessageBar
          messageBarType={MessageBarType.warning}
          isMultiline={true}
          styles={{
            root: {
              marginBottom: errors.length > 0 ? 0 : 16
            }
          }}
        >
          <Stack tokens={{ childrenGap: 8 }}>
            <Text variant="medium" className="font-semibold">
              Please note:
            </Text>
            <Stack tokens={{ childrenGap: 4 }}>
              {warnings.map((warning, index) => (
                <div key={`warning-${index}`} className="flex items-start space-x-2">
                  <Icon
                    iconName="Warning"
                    styles={{ root: { color: '#ff8c00', fontSize: 12, marginTop: 2 } }}
                  />
                  <Text variant="small" className="text-orange-700">
                    {warning}
                  </Text>
                </div>
              ))}
            </Stack>
          </Stack>
        </MessageBar>
      )}
    </div>
  );
};

export default ValidationSummary;