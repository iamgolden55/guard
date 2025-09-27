import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  
  Text,
  Title3,
  Button,
  Radio,
  RadioGroup,
  Dropdown,
  Option,
  Checkbox,
  Field,
  Badge,
  MessageBar,
  
  Spinner,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel
} from '@fluentui/react-components';
import {
  DocumentRegular,
  TableRegular,
  DocumentPdfRegular,
  CodeRegular,
  SettingsRegular,
  InfoRegular,
  ChevronDownRegular
} from '@fluentui/react-icons';
import { ExportFormat, ExportFormatCapability } from '../../types/reports';
import reportService from '../../services/reportService';

interface ExportFormatSelectorProps {
  selectedFormat: ExportFormat;
  onFormatChange: (format: ExportFormat) => void;
  formatOptions?: Record<string, any>;
  onFormatOptionsChange?: (options: Record<string, any>) => void;
  showAdvancedOptions?: boolean;
  disabled?: boolean;
  reportType?: string;
}

const ExportFormatSelector: React.FC<ExportFormatSelectorProps> = ({
  selectedFormat,
  onFormatChange,
  formatOptions = {},
  onFormatOptionsChange,
  showAdvancedOptions = true,
  disabled = false,
  reportType
}) => {
  const [capabilities, setCapabilities] = useState<ExportFormatCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load format capabilities on mount
  useEffect(() => {
    const loadCapabilities = async () => {
      try {
        setLoading(true);
        const formats = await reportService.getExportFormats();
        setCapabilities(Array.isArray(formats) ? formats : []);
      } catch (err) {
        console.error('Failed to load export formats:', err);
        setError('Failed to load export format capabilities');
        // Set default capabilities as fallback
        setCapabilities([
          {
            format: ExportFormat.CSV,
            name: 'CSV',
            description: 'Comma-separated values file',
            supported: true,
            options: []
          },
          {
            format: ExportFormat.EXCEL,
            name: 'Excel',
            description: 'Microsoft Excel file',
            supported: true,
            options: []
          },
          {
            format: ExportFormat.PDF,
            name: 'PDF',
            description: 'Portable document format',
            supported: true,
            options: []
          },
          {
            format: ExportFormat.JSON,
            name: 'JSON',
            description: 'JavaScript object notation',
            supported: true,
            options: []
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadCapabilities();
  }, []);

  const getFormatIcon = (format: ExportFormat) => {
    const iconStyle = { fontSize: '24px' };
    switch (format) {
      case ExportFormat.CSV:
        return <TableRegular style={{ ...iconStyle, color: '#217346' }} />;
      case ExportFormat.EXCEL:
        return <TableRegular style={{ ...iconStyle, color: '#217346' }} />;
      case ExportFormat.PDF:
        return <DocumentPdfRegular style={{ ...iconStyle, color: '#d83b01' }} />;
      case ExportFormat.JSON:
        return <CodeRegular style={{ ...iconStyle, color: '#5c2d91' }} />;
      default:
        return <DocumentRegular style={{ ...iconStyle, color: '#0078d4' }} />;
    }
  };

  const getFormatCapability = (format: ExportFormat): ExportFormatCapability | undefined => {
    return capabilities.find(cap => cap.format === format);
  };

  const handleFormatChange = (format: ExportFormat) => {
    onFormatChange(format);

    // Reset format options when changing format
    if (onFormatOptionsChange) {
      onFormatOptionsChange({});
    }
  };

  const handleOptionChange = (key: string, value: any) => {
    if (onFormatOptionsChange) {
      onFormatOptionsChange({
        ...formatOptions,
        [key]: value
      });
    }
  };

  const getFormatDetails = (format: ExportFormat) => {
    switch (format) {
      case ExportFormat.CSV:
        return {
          title: 'CSV (Spreadsheet Data)',
          subtitle: 'Perfect for Excel, Google Sheets, and data analysis',
          description: 'Use when you need raw data that can be opened in any spreadsheet application. Ideal for further analysis or importing into other systems.',
          useCases: ['Data analysis', 'Importing into Excel', 'System integrations', 'Raw data export'],
          pros: ['Universal compatibility', 'Small file size', 'Easy to process'],
          cons: ['No formatting', 'Limited to tabular data']
        };
      case ExportFormat.EXCEL:
        return {
          title: 'Excel Workbook',
          subtitle: 'Rich formatting with charts, formulas, and multiple sheets',
          description: 'Use when you need professional reports with charts, calculations, and formatting. Best for business presentations and detailed analysis.',
          useCases: ['Business reports', 'Financial analysis', 'Charts and graphs', 'Formatted presentations'],
          pros: ['Rich formatting', 'Multiple sheets', 'Charts and formulas', 'Professional appearance'],
          cons: ['Larger file size', 'Requires Excel to edit']
        };
      case ExportFormat.PDF:
        return {
          title: 'PDF Document',
          subtitle: 'Print-ready reports with consistent formatting',
          description: 'Use when you need to share reports that look the same everywhere. Perfect for archiving, printing, or official documentation.',
          useCases: ['Official reports', 'Archiving', 'Printing', 'Sharing via email'],
          pros: ['Consistent appearance', 'Print-ready', 'Cannot be edited', 'Universal viewing'],
          cons: ['Cannot edit data', 'Larger file size', 'Fixed layout']
        };
      case ExportFormat.JSON:
        return {
          title: 'JSON (Developer Data)',
          subtitle: 'Structured data for applications and APIs',
          description: 'Use when you need data for applications, APIs, or custom processing. Best for developers and system integrations.',
          useCases: ['API integration', 'Web applications', 'Data processing', 'System exports'],
          pros: ['Structured format', 'Easy to parse', 'Supports complex data'],
          cons: ['Technical format', 'Not human-readable', 'Requires programming knowledge']
        };
      default:
        return {
          title: format.toUpperCase(),
          subtitle: 'File format',
          description: 'Standard file format for data export',
          useCases: ['General use'],
          pros: ['Available format'],
          cons: []
        };
    }
  };

  const renderFormatCard = (capability: ExportFormatCapability) => {
    const isSelected = selectedFormat === capability.format;
    const details = getFormatDetails(capability.format);

    return (
      <Card
        key={capability.format}
        style={{
          border: isSelected ? '3px solid #0078d4' : '2px solid #e1e1e1',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          backgroundColor: isSelected ? '#f8f9ff' : '#ffffff',
          transition: 'all 0.2s ease',
          transform: isSelected ? 'translateY(-2px)' : 'none',
          boxShadow: isSelected
            ? '0 8px 16px rgba(0, 120, 212, 0.15)'
            : '0 2px 4px rgba(0, 0, 0, 0.08)'
        }}
        onClick={() => !disabled && handleFormatChange(capability.format)}
        onMouseEnter={(e) => {
          if (!disabled && !isSelected) {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.12)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isSelected) {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08)';
          }
        }}
      >
        <div style={{ padding: '20px' }}>
          {/* Header with icon and selection */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Radio
                checked={isSelected}
                disabled={disabled}
                onChange={() => !disabled && handleFormatChange(capability.format)}
                style={{
                  transform: 'scale(1.2)',
                  accentColor: '#0078d4'
                }}
              />
              <div style={{
                fontSize: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                backgroundColor: isSelected ? '#0078d4' : '#f3f2f1',
                color: isSelected ? '#ffffff' : 'inherit',
                transition: 'all 0.2s ease'
              }}>
                {getFormatIcon(capability.format)}
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <Text
                  weight="bold"
                  style={{
                    fontSize: '18px',
                    color: isSelected ? '#0078d4' : '#323130',
                    lineHeight: '1.2'
                  }}
                >
                  {details.title}
                </Text>
                <Badge
                  appearance={isSelected ? "filled" : "outline"}
                  color={isSelected ? "brand" : "subtle"}
                  size="medium"
                  style={{
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}
                >
                  .{capability.fileExtension || capability.format}
                </Badge>
              </div>

              <Text
                size="medium"
                style={{
                  color: '#605e5c',
                  marginBottom: '12px',
                  fontWeight: '500',
                  lineHeight: '1.3'
                }}
              >
                {details.subtitle}
              </Text>

              <Text
                size="medium"
                style={{
                  color: '#323130',
                  marginBottom: '16px',
                  lineHeight: '1.4'
                }}
              >
                {details.description}
              </Text>

              {/* Use Cases */}
              <div style={{ marginBottom: '14px' }}>
                <Text
                  weight="semibold"
                  size="small"
                  style={{
                    color: '#323130',
                    marginBottom: '6px',
                    display: 'block',
                    textTransform: 'uppercase',
                    fontSize: '11px',
                    letterSpacing: '0.5px'
                  }}
                >
                  Best for:
                </Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {details.useCases.slice(0, 3).map((useCase, index) => (
                    <Badge
                      key={index}
                      size="small"
                      appearance="tint"
                      color={isSelected ? "brand" : "informative"}
                      style={{
                        fontSize: '11px',
                        fontWeight: '500'
                      }}
                    >
                      {useCase}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Capabilities */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {capability.supportsCharts && (
                  <Badge size="small" appearance="filled" color="success">
                    📊 Charts
                  </Badge>
                )}
                {capability.supportsImages && (
                  <Badge size="small" appearance="filled" color="warning">
                    🖼️ Images
                  </Badge>
                )}
                {capability.supportsMultipleSheets && (
                  <Badge size="small" appearance="filled" color="informative">
                    📑 Multi-sheet
                  </Badge>
                )}
                {capability.maxRows && (
                  <Badge size="small" appearance="outline" color="subtle">
                    📈 {capability.maxRows.toLocaleString()} rows max
                  </Badge>
                )}
              </div>

              {/* Quick pros/cons if selected */}
              {isSelected && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: 'rgba(0, 120, 212, 0.05)',
                  borderRadius: '6px',
                  border: '1px solid rgba(0, 120, 212, 0.1)'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <Text
                        weight="semibold"
                        size="small"
                        style={{
                          color: '#107c10',
                          marginBottom: '4px',
                          display: 'block',
                          fontSize: '11px'
                        }}
                      >
                        ✓ ADVANTAGES
                      </Text>
                      {details.pros.slice(0, 2).map((pro, index) => (
                        <Text
                          key={index}
                          size="small"
                          style={{
                            color: '#323130',
                            display: 'block',
                            fontSize: '12px',
                            lineHeight: '1.3'
                          }}
                        >
                          • {pro}
                        </Text>
                      ))}
                    </div>
                    <div>
                      <Text
                        weight="semibold"
                        size="small"
                        style={{
                          color: '#d13438',
                          marginBottom: '4px',
                          display: 'block',
                          fontSize: '11px'
                        }}
                      >
                        ⚠ LIMITATIONS
                      </Text>
                      {details.cons.slice(0, 2).map((con, index) => (
                        <Text
                          key={index}
                          size="small"
                          style={{
                            color: '#323130',
                            display: 'block',
                            fontSize: '12px',
                            lineHeight: '1.3'
                          }}
                        >
                          • {con}
                        </Text>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const renderAdvancedOptions = () => {
    if (!showAdvancedOptions) return null;

    const capability = getFormatCapability(selectedFormat);
    if (!capability) return null;

    return (
      <Accordion collapsible>
        <AccordionItem value="options">
          <AccordionHeader icon={<SettingsRegular />} expandIcon={<ChevronDownRegular />}>
            Format Options
          </AccordionHeader>
          <AccordionPanel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Page Options for PDF */}
              {selectedFormat === ExportFormat.PDF && capability.pageOptions && (
                <div>
                  <Text weight="semibold" style={{ marginBottom: '8px' }}>Page Settings</Text>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Field label="Orientation">
                      <Dropdown
                        value={formatOptions.orientation || 'portrait'}
                        selectedOptions={[formatOptions.orientation || 'portrait']}
                        onOptionSelect={(_, data) => handleOptionChange('orientation', data.optionValue)}
                      >
                        <Option value="portrait">Portrait</Option>
                        <Option value="landscape">Landscape</Option>
                      </Dropdown>
                    </Field>

                    <Field label="Page Size">
                      <Dropdown
                        value={formatOptions.pageSize || 'A4'}
                        selectedOptions={[formatOptions.pageSize || 'A4']}
                        onOptionSelect={(_, data) => handleOptionChange('pageSize', data.optionValue)}
                      >
                        <Option value="A4">A4</Option>
                        <Option value="A3">A3</Option>
                        <Option value="letter">Letter</Option>
                        <Option value="legal">Legal</Option>
                      </Dropdown>
                    </Field>
                  </div>
                </div>
              )}

              {/* Chart Options */}
              {capability.supportsCharts && (
                <Field>
                  <Checkbox
                    label="Include charts and graphs"
                    checked={formatOptions.includeCharts || false}
                    onChange={(_, data) => handleOptionChange('includeCharts', data.checked)}
                  />
                </Field>
              )}

              {/* Image Options */}
              {capability.supportsImages && (
                <Field>
                  <Checkbox
                    label="Include images and logos"
                    checked={formatOptions.includeImages || false}
                    onChange={(_, data) => handleOptionChange('includeImages', data.checked)}
                  />
                </Field>
              )}

              {/* Compression Options */}
              {capability.compressionOptions && capability.compressionOptions.length > 0 && (
                <Field label="Compression">
                  <Dropdown
                    value={formatOptions.compression || 'normal'}
                    selectedOptions={[formatOptions.compression || 'normal']}
                    onOptionSelect={(_, data) => handleOptionChange('compression', data.optionValue)}
                  >
                    {capability.compressionOptions.map(option => (
                      <Option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              )}

              {/* Excel-specific options */}
              {selectedFormat === ExportFormat.EXCEL && (
                <>
                  <Field>
                    <Checkbox
                      label="Create separate sheets for different data types"
                      checked={formatOptions.multipleSheets || false}
                      onChange={(_, data) => handleOptionChange('multipleSheets', data.checked)}
                    />
                  </Field>

                  <Field>
                    <Checkbox
                      label="Include pivot tables"
                      checked={formatOptions.includePivotTables || false}
                      onChange={(_, data) => handleOptionChange('includePivotTables', data.checked)}
                    />
                  </Field>

                  <Field>
                    <Checkbox
                      label="Auto-fit column widths"
                      checked={formatOptions.autoFitColumns !== false} // Default to true
                      onChange={(_, data) => handleOptionChange('autoFitColumns', data.checked)}
                    />
                  </Field>
                </>
              )}

              {/* CSV-specific options */}
              {selectedFormat === ExportFormat.CSV && (
                <Field label="Delimiter">
                  <Dropdown
                    value={formatOptions.delimiter || ','}
                    selectedOptions={[formatOptions.delimiter || ',']}
                    onOptionSelect={(_, data) => handleOptionChange('delimiter', data.optionValue)}
                  >
                    <Option value=",">Comma (,)</Option>
                    <Option value=";">Semicolon (;)</Option>
                    <Option value="\t">Tab</Option>
                    <Option value="|">Pipe (|)</Option>
                  </Dropdown>
                </Field>
              )}

              {/* JSON-specific options */}
              {selectedFormat === ExportFormat.JSON && (
                <>
                  <Field>
                    <Checkbox
                      label="Pretty print (formatted JSON)"
                      checked={formatOptions.prettyPrint !== false} // Default to true
                      onChange={(_, data) => handleOptionChange('prettyPrint', data.checked)}
                    />
                  </Field>

                  <Field>
                    <Checkbox
                      label="Include metadata"
                      checked={formatOptions.includeMetadata || false}
                      onChange={(_, data) => handleOptionChange('includeMetadata', data.checked)}
                    />
                  </Field>
                </>
              )}
            </div>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    );
  };

  if (loading) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <Spinner size="medium" label="Loading export formats..." />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="p-4">
          <MessageBar intent="error">
            {error}
          </MessageBar>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DocumentRegular style={{ fontSize: '20px', color: '#0078d4' }} />
            <Title3 style={{ color: '#323130', margin: 0 }}>Choose Export Format</Title3>
          </div>
          <Text size="medium" style={{ color: '#605e5c', marginTop: '6px' }}>
            Select the format that best fits how you'll use this report
          </Text>
        </CardHeader>
        <div className="p-6" style={{ paddingTop: '20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '20px',
            '@media (max-width: 768px)': {
              gridTemplateColumns: '1fr'
            }
          }}>
            {(capabilities || []).map(capability => renderFormatCard(capability))}
          </div>
        </div>
      </Card>

      {/* Advanced Options */}
      {renderAdvancedOptions()}

      {/* Quick Help Card */}
      <Card style={{ backgroundColor: '#f8f9ff', border: '1px solid #e1dfdd' }}>
        <div className="p-4">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <InfoRegular style={{ fontSize: '16px', color: '#0078d4', marginTop: '2px' }} />
            <div>
              <Text weight="semibold" style={{ color: '#323130', marginBottom: '6px', display: 'block' }}>
                Need help choosing?
              </Text>
              <Text size="medium" style={{ color: '#605e5c', lineHeight: '1.4' }}>
                <strong>CSV</strong> for Excel analysis • <strong>Excel</strong> for presentations • <strong>PDF</strong> for sharing • <strong>JSON</strong> for developers
              </Text>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ExportFormatSelector;