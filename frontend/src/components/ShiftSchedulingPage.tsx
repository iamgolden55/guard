import BulkShiftModal from './modals/BulkShiftModal';

const ShiftSchedulingPage = () => {
  const [bulkModalVisible, setBulkModalVisible] = useState(false);

  const handleBulkCreate = () => {
    setBulkModalVisible(true);
  };

  const handleBulkModalClose = () => {
    setBulkModalVisible(false);
  };

  const handleBulkSuccess = () => {
    // Refresh shifts data after bulk creation
    fetchShifts();
    message.success('Shifts created successfully');
  };

  return (
    <div className="shift-scheduling-page">
      <div className="header-actions">
        <Button type="primary" onClick={() => setModalVisible(true)}>
          New Shift
        </Button>
        <Button onClick={handleBulkCreate}>Bulk Create</Button>
      </div>

      <ShiftModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={handleSuccess}
        data={selectedShift}
        venues={venues}
        staff={staff}
      />

      <BulkShiftModal
        visible={bulkModalVisible}
        onClose={handleBulkModalClose}
        onSuccess={handleBulkSuccess}
        venues={venues}
      />
    </div>
  );
}; 