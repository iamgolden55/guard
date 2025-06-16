import { ActionFunction, json } from '@remix-run/node';
import { db } from '~/utils/db.server';
import { requireUserId } from '~/utils/session.server';

export const action: ActionFunction = async ({ request }) => {
  const userId = await requireUserId(request);
  
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { shifts } = await request.json();
    
    if (!Array.isArray(shifts) || shifts.length === 0) {
      return json({ error: 'Invalid shifts data' }, { status: 400 });
    }

    // Create all shifts in a transaction
    const createdShifts = await db.$transaction(
      shifts.map(shift => 
        db.shift.create({
          data: {
            venueId: shift.venueId,
            startTime: new Date(shift.startTime),
            endTime: new Date(shift.endTime),
            status: 'DRAFT',
            createdBy: userId,
            updatedBy: userId,
          }
        })
      )
    );

    return json({ success: true, shifts: createdShifts });
  } catch (error) {
    console.error('Error creating shifts:', error);
    return json({ error: 'Failed to create shifts' }, { status: 500 });
  }
}; 