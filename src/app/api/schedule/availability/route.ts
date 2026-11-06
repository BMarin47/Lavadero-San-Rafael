import { NextRequest, NextResponse } from 'next/server';
import {
  ScheduleService,
  getAllowedSlotsForVehicle,
  isAllowedBookingDate,
  MAX_CAPACITY_PER_SLOT,
} from '@/lib/services/schedule.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');
  const vehicleTypeParam =
    searchParams.get('vehicleType') ||
    searchParams.get('vehicletype') ||
    searchParams.get('vehicle_type') ||
    searchParams.get('categoria') ||
    searchParams.get('vehicle') ||
    undefined;

  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json(
      { error: 'Parámetro date inválido. Use formato YYYY-MM-DD.' },
      { status: 400 }
    );
  }

  try {
    const result = await ScheduleService.getAvailability(dateParam, vehicleTypeParam);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    console.warn(
      '[API Availability Fallback]: Error consultando base de datos, usando grilla de respaldo:',
      error?.message || error
    );

    const parts = dateParam.split('-').map(Number);
    const dateObj = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
    const dayOfWeek = dateObj.getUTCDay();

    if (dayOfWeek === 0) {
      return NextResponse.json({
        isOpen: false,
        reasonClosed: 'El lavadero permanece cerrado los días domingos.',
        slots: [],
      });
    }

    if (!isAllowedBookingDate(dateParam)) {
      return NextResponse.json({
        isOpen: false,
        reasonClosed: 'El lavadero permanece cerrado en esta fecha.',
        slots: [],
      });
    }

    const fallbackSlots = getAllowedSlotsForVehicle(vehicleTypeParam, dayOfWeek).map((slot) => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      totalCapacity: MAX_CAPACITY_PER_SLOT,
      bookedCount: 0,
      remainingCapacity: MAX_CAPACITY_PER_SLOT,
      isAvailable: true,
    }));

    return NextResponse.json(
      {
        isOpen: true,
        slots: fallbackSlots,
        fallback: true,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}
