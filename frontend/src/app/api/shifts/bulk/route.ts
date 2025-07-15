import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to create shifts
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { roles: true },
    });

    const hasPermission = user?.roles.some(
      role => role.name === 'ADMIN' || role.name === 'MANAGER'
    );

    if (!hasPermission) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { shifts } = await request.json();

    if (!Array.isArray(shifts) || shifts.length === 0) {
      return NextResponse.json(
        { message: 'Invalid input: shifts must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate each shift
    for (const shift of shifts) {
      if (!shift.venueId || !shift.startTime || !shift.endTime) {
        return NextResponse.json(
          { message: 'Each shift must have venueId, startTime, and endTime' },
          { status: 400 }
        );
      }
    }

    // Create all shifts in a transaction
    const createdShifts = await prisma.$transaction(
      shifts.map(shift => 
        prisma.shift.create({
          data: {
            venueId: shift.venueId,
            startTime: new Date(shift.startTime),
            endTime: new Date(shift.endTime),
            status: 'DRAFT',
            createdById: session.user.id,
          },
        })
      )
    );

    return NextResponse.json({ 
      message: `Successfully created ${createdShifts.length} shifts`,
      shifts: createdShifts
    });
    
  } catch (error) {
    console.error('Error creating bulk shifts:', error);
    return NextResponse.json(
      { message: 'Failed to create shifts' },
      { status: 500 }
    );
  }
} 