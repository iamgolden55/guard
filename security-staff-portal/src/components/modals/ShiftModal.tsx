import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Row, Col, Select, DatePicker, TimePicker } from 'antd';
import dayjs from 'dayjs';
import { Shift, createShift, updateShift } from '../../services/api';
import { Venue, Staff } from '../../types';

interface ShiftModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shift?: Shift;
  venues: Venue[];
  staff: Staff[];
}

const ShiftModal: React.FC<ShiftModalProps> = ({ 
  visible, 
  onClose, 
  onSuccess, 
  shift, 
  venues, 
  staff 
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const isEditing = !!shift;

  useEffect(() => {
    if (visible && shift) {
      form.setFieldsValue({
        venueId: shift.venueId,
        staffId: shift.staffId || undefined,
        date: dayjs(shift.date),
        startTime: dayjs(shift.startTime, 'HH:mm'),
        endTime: dayjs(shift.endTime, 'HH:mm'),
      });
    } else if (visible) {
      form.resetFields();
    }
  }, [visible, shift, form]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      const shiftData = {
        venueId: values.venueId,
        venueName: venues.find(v => v.id === values.venueId)?.name || '',
        staffId: values.staffId,
        staffName: values.staffId ? staff.find(s => s.id === values.staffId)?.name || '' : undefined,
        date: values.date.format('YYYY-MM-DD'),
        startTime: values.startTime.format('HH:mm'),
        endTime: values.endTime.format('HH:mm'),
        status: 'draft' as const,
      };

      if (isEditing && shift) {
        await updateShift(shift.id, shiftData);
      } else {
        await createShift(shiftData);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to save shift:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={isEditing ? 'Edit Shift' : 'Create New Shift'}
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
          {isEditing ? 'Update' : 'Create'}
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
              name="staffId"
              label="Assign Staff (optional)"
            >
              <Select placeholder="Select staff member" allowClear>
                {staff.map(member => (
                  <Select.Option key={member.id} value={member.id}>
                    {member.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={24}>
            <Form.Item
              name="date"
              label="Shift Date"
              rules={[{ required: true, message: 'Please select a date' }]}
            >
              <DatePicker style={{ width: '100%' }} />
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

export default ShiftModal; 