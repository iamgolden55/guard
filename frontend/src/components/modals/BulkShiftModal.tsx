import React, { useState } from 'react';
import { Modal, Form, Button, Row, Col, Select, DatePicker, TimePicker, Checkbox } from 'antd';
import type { CheckboxValueType } from 'antd/es/checkbox/Group';
import dayjs from 'dayjs';
import { bulkCreateShifts } from '../../services/api';
import { Venue } from '../../types';

interface BulkShiftModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  venues: Venue[];
}

const { RangePicker } = DatePicker;

const BulkShiftModal: React.FC<BulkShiftModalProps> = ({ 
  visible, 
  onClose, 
  onSuccess, 
  venues 
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const weekDays = [
    { label: 'Monday', value: 'monday' },
    { label: 'Tuesday', value: 'tuesday' },
    { label: 'Wednesday', value: 'wednesday' },
    { label: 'Thursday', value: 'thursday' },
    { label: 'Friday', value: 'friday' },
    { label: 'Saturday', value: 'saturday' },
    { label: 'Sunday', value: 'sunday' },
  ];

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      const [startDate, endDate] = values.dateRange;
      const selectedDays = values.days || [];
      const venueId = values.venueId;
      const venueName = venues.find(v => v.id === venueId)?.name || '';
      const startTime = values.startTime.format('HH:mm');
      const endTime = values.endTime.format('HH:mm');
      
      // Generate shifts for each selected day within the date range
      const currentDate = dayjs(startDate);
      const shifts = [];
      
      while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
        const dayOfWeek = currentDate.day(); // 0 is Sunday, 1 is Monday, etc.
        const dayName = dayOfWeek === 0 ? 'sunday' : 
                       dayOfWeek === 1 ? 'monday' : 
                       dayOfWeek === 2 ? 'tuesday' : 
                       dayOfWeek === 3 ? 'wednesday' : 
                       dayOfWeek === 4 ? 'thursday' : 
                       dayOfWeek === 5 ? 'friday' : 'saturday';
                       
        if (selectedDays.includes(dayName)) {
          shifts.push({
            venueId,
            venueName,
            date: currentDate.format('YYYY-MM-DD'),
            startTime,
            endTime,
            status: 'draft',
          });
        }
        
        currentDate.add(1, 'day');
      }
      
      if (shifts.length > 0) {
        await bulkCreateShifts(shifts);
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Failed to create bulk shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Bulk Create Shifts"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          loading={loading} 
          onClick={handleSubmit}
        >
          Create Shifts
        </Button>
      ]}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="venueId"
              label="Venue"
              rules={[{ required: true, message: 'Please select a venue' }]}
            >
              <Select placeholder="Select venue">
                {venues.map(venue => (
                  <Select.Option key={venue.id} value={venue.id}>
                    {venue.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              name="dateRange"
              label="Date Range"
              rules={[{ required: true, message: 'Please select date range' }]}
            >
              <RangePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              name="days"
              label="Days of the Week"
              rules={[{ required: true, message: 'Please select at least one day' }]}
            >
              <Checkbox.Group options={weekDays} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="startTime"
              label="Start Time"
              rules={[{ required: true, message: 'Please select start time' }]}
            >
              <TimePicker format="HH:mm" style={{ width: '100%' }} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="endTime"
              label="End Time"
              rules={[
                { required: true, message: 'Please select end time' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || !getFieldValue('startTime') || 
                        value.isAfter(getFieldValue('startTime'))) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('End time must be after start time'));
                  },
                }),
              ]}
            >
              <TimePicker format="HH:mm" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default BulkShiftModal; 