import { NextRequest, NextResponse } from 'next/server';
import { ScheduleService } from '@/lib/services/schedule.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const vehicleTypeParam = searchParams.get('vehicleType') || undefined;

    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { error: 'Parámetro date inválido. Use formato YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    const result = await ScheduleService.getAvailability(dateParam, vehicleTypeParam);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('[API Availability Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno consultando disponibilidad.' },
      { status: 500 }
    );
  }
}
