import { BRAND_CONFIG } from '@/lib/config';

/**
 * Configuración y utilidades de Superadministrador para Lavadero San Rafael.
 * Garantiza privilegios totales de administración al correo autorizado.
 */

export const SUPERADMIN_EMAILS = [
  ...BRAND_CONFIG.superAdminEmails,
];

/**
 * Determina si un correo electrónico corresponde al Superadministrador.
 */
export function isSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  const envAdmin = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  return (
    SUPERADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === normalized) ||
    (!!envAdmin && normalized === envAdmin)
  );
}

/**
 * Validador estricto para APIs del lado del servidor.
 * Retorna true si el usuario actual es Superadministrador.
 */
export function verifySuperAdmin(user?: { email?: string | null } | null): boolean {
  if (!user || !user.email) return false;
  return isSuperAdmin(user.email);
}
