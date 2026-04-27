import React from 'react';

interface FormSectionProps {
  children: React.ReactNode;
  header?: string;
  description?: string;
  className?: string;
}

const FormSection: React.FC<FormSectionProps> = ({
  children,
  header,
  description,
  className = '',
}) => {
  return (
    <div className={`${className}`}>
      {(header || description) && (
        <div className="mb-4">
          {header && (
            <h3 className="text-base font-semibold text-gray-900">{header}</h3>
          )}
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>
      )}
      <div className="flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
};

export default FormSection;
