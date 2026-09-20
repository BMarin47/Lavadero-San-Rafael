import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vehicleType = searchParams.get('vehicleType') || 'CAR';

    const plans = await prisma.subscriptionPlan.findMany({
      where: {
        vehicleType,
        isActive: true,
      },
      orderBy: { monthlyPrice: 'asc' },
    });

    return NextResponse.json(plans);
  } catch (error: any) {
    console.error('[Plans API Error]:', error);
    return NextResponse.json({ error: 'Error obteniendo catálogo de planes.' }, { status: 500 });
  }
}
