import { PrismaClient } from '@prisma/client';

/**
 * Normaliza la URL de conexión PostgreSQL para entornos Serverless (Vercel + Supabase Supavisor).
 * Si se detecta el puerto 6543 (Transaction Pooler) o un host pooler de Supabase, garantiza
 * que estén activos ?pgbouncer=true&connection_limit=1&connect_timeout=10 para evitar agotamiento
 * de conexiones y errores "Can't reach database server".
 */
function resolvePooledDatabaseUrl(): string {
  const rawUrl =
    process.env.DATABASE_URL?.trim() ||
    'postgresql://postgres:postgres@localhost:5432/lavadero?sslmode=disable';

  try {
    if (rawUrl.includes(':6543') || rawUrl.includes('pooler.supabase.com')) {
      const parsed = new URL(rawUrl);
      if (!parsed.searchParams.has('pgbouncer')) {
        parsed.searchParams.set('pgbouncer', 'true');
      }
      if (!parsed.searchParams.has('connection_limit')) {
        parsed.searchParams.set('connection_limit', '1');
      }
      if (!parsed.searchParams.has('connect_timeout')) {
        parsed.searchParams.set('connect_timeout', '10');
      }
      return parsed.toString();
    }
  } catch {
    // Si la URL no puede ser parseada por URL estándar, devolver rawUrl intacta
  }

  return rawUrl;
}

const resolvedDatabaseUrl = resolvePooledDatabaseUrl();
process.env.DATABASE_URL = resolvedDatabaseUrl;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: resolvedDatabaseUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

globalForPrisma.prisma = prisma;
