import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { isSuperAdmin } from '@/lib/auth/admin';
import AdminClient from './AdminClient';

export const metadata = {
  title: 'Panel de Superadministrador | AquaShine San Rafael',
  description: 'Panel exclusivo de control para gestión de turnos, notificaciones push y usuarios.',
};

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/admin');
  }

  if (!isSuperAdmin(user.email)) {
    redirect('/dashboard');
  }

  return <AdminClient user={user} />;
}
