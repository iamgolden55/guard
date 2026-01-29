# Add Toast Notifications

Add toast notifications to React components for user feedback on actions.

## Prerequisites

The project uses a `useToast` hook from `../../components/shared/ToastNotificationSystem`. Ensure it's imported:

```tsx
import { useToast } from '../../components/shared/ToastNotificationSystem';
```

And initialized in the component:

```tsx
const toast = useToast();
```

## Toast Methods

- `toast.showSuccess(title: string, message: string)` - Green success toast
- `toast.showError(title: string, message: string)` - Red error toast
- `toast.showWarning(title: string, message: string)` - Yellow warning toast
- `toast.showInfo(title: string, message: string)` - Blue info toast

Toasts auto-dismiss after 4 seconds.

## Process

1. **Identify the handlers** that need toast notifications (CRUD operations, status changes, etc.)

2. **For each handler, add:**
   - Success toast after successful API call with descriptive message including entity name
   - Error toast in catch block replacing `setError()` calls

3. **Update dependency arrays** to include `toast` for `useCallback` hooks

## Pattern Examples

### Success after update:
```tsx
toast.showSuccess('Staff Updated', `${formData.firstName} ${formData.lastName}'s profile has been updated.`);
```

### Success with status change:
```tsx
if (newStatus) {
  toast.showSuccess('Staff Activated', `${staff.firstName} ${staff.lastName} has been activated.`);
} else {
  toast.showSuccess('Staff Deactivated', `${staff.firstName} ${staff.lastName} has been deactivated.`);
}
```

### Error handling:
```tsx
} catch (err) {
  console.error('Failed to update staff:', err);
  toast.showError('Update Failed', 'Failed to update staff. Please try again.');
}
```

### With entity name lookup:
```tsx
const employmentTypeName = employmentTypes.find(et => et.id === selectedEmploymentType)?.name || 'Employment type';
toast.showSuccess('Employment Type Assigned', `${selectedStaff.firstName} ${selectedStaff.lastName} is now assigned as ${employmentTypeName}.`);
```

## Checklist

- [ ] Import `useToast` hook
- [ ] Initialize `const toast = useToast()` in component
- [ ] Add success toasts after successful API calls
- [ ] Replace `setError()` calls with `toast.showError()` in catch blocks
- [ ] Add `toast` to useCallback dependency arrays
- [ ] Test each action to verify toasts appear correctly

## Common Toast Titles

| Action | Success Title | Error Title |
|--------|--------------|-------------|
| Create | "[Entity] Created" | "Creation Failed" |
| Update | "[Entity] Updated" | "Update Failed" |
| Delete | "[Entity] Deleted" | "Delete Failed" |
| Activate | "[Entity] Activated" | "Activation Failed" |
| Deactivate | "[Entity] Deactivated" | "Deactivation Failed" |
| Assign | "[Entity] Assigned" | "Assignment Failed" |

## Notes

- Keep messages concise but informative
- Include the entity name in messages when available
- Use consistent title casing
- Error messages should guide the user ("Please try again")
