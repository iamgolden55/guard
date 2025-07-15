import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Grid,
  Typography,
  Divider,
} from "@mui/material";
import { DatePicker, TimePicker } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { useVenues } from "~/hooks/useVenues";
import { bulkCreateShifts } from "~/services/api";
import { format } from "date-fns";

interface BulkShiftModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkShiftModal({ open, onClose, onSuccess }: BulkShiftModalProps) {
  const { venues } = useVenues();
  const [venueId, setVenueId] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setVenueId("");
    setStartDate(null);
    setEndDate(null);
    setStartTime(null);
    setEndTime(null);
    setError("");
  };

  const handleSubmit = async () => {
    setError("");
    
    // Validate form
    if (!venueId || !startDate || !endDate || !startTime || !endTime) {
      setError("All fields are required");
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setError("End date must be after start date");
      return;
    }

    try {
      setLoading(true);
      
      // Generate shifts for each day in the date range
      const shifts = [];
      const currentDate = new Date(startDate);
      const lastDate = new Date(endDate);
      
      while (currentDate <= lastDate) {
        // Create shift datetime by combining date and time
        const shiftStartTime = new Date(currentDate);
        shiftStartTime.setHours(
          startTime.getHours(),
          startTime.getMinutes(),
          0,
          0
        );
        
        const shiftEndTime = new Date(currentDate);
        shiftEndTime.setHours(
          endTime.getHours(),
          endTime.getMinutes(),
          0,
          0
        );
        
        // Handle case where end time is earlier than start time (overnight shift)
        if (shiftEndTime < shiftStartTime) {
          shiftEndTime.setDate(shiftEndTime.getDate() + 1);
        }
        
        shifts.push({
          venueId,
          startTime: shiftStartTime.toISOString(),
          endTime: shiftEndTime.toISOString(),
        });
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Send to API
      await bulkCreateShifts(shifts);
      
      resetForm();
      onSuccess();
    } catch (err) {
      console.error("Error creating shifts:", err);
      setError("Failed to create shifts. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Bulk Create Shifts</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Create multiple shifts across a date range for a specific venue
          </Typography>
          
          {error && (
            <Typography color="error" variant="body2" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}
          
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel id="venue-label">Venue</InputLabel>
                <Select
                  labelId="venue-label"
                  value={venueId}
                  onChange={(e) => setVenueId(e.target.value)}
                  label="Venue"
                >
                  {venues?.map((venue) => (
                    <MenuItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Date Range
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Shift Times
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TimePicker
                label="Start Time"
                value={startTime}
                onChange={(newValue) => setStartTime(newValue)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TimePicker
                label="End Time"
                value={endTime}
                onChange={(newValue) => setEndTime(newValue)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            color="primary" 
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Shifts"}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
} 