'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '@supabase/supabase-js';
import {
  Calendar,
  Clock,
  Car,
  ShieldCheck,
  Users,
  Bell,
  Search,
  Filter,
  RefreshCw,
  PlusCircle,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  MessageCircle,
  Send,
  Loader2,
  Sparkles,
  ArrowLeft,
  LogOut,
  X,
  Phone,
  Mail,
  Smartphone,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface AdminTurno {
  id: string;
  user_id: string;
  nombre_cliente: string;
  client_email?: string | null;
  client_phone?: string | null;
  vehiculo: string;
  categoria: string;
  precio: number;
  indicaciones?: string | null;
  estado: string;
  date: string;
  time: string;
  fecha_creacion: string;
}

interface AdminUserItem {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: 'ADMIN' | 'CUSTOMER';
  createdAt: string;
  turnosCount: number;
}

export default function AdminClient({ user }: { user: User }) {
  const router = useRouter();
  const supabase = createClient();

  // Estados de pestañas
  const [activeTab, setActiveTab] = useState<'turnos' | 'push' | 'users'>('turnos');

  // Estados para Turnos
  const [turnos, setTurnos] = useState<AdminTurno[]>([]);
  const [loadingTurnos, setLoadingTurnos] = useState(true);
  const [searchTurno, setSearchTurno] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [editingTurno, setEditingTurno] = useState<AdminTurno | null>(null);
  const [isUpdatingTurno, setIsUpdatingTurno] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [whatsAppModal, setWhatsAppModal] = useState<{
    isOpen: boolean;
    url: string;
    clientName: string;
    phone: string;
    vehicle: string;
    date: string;
    time: string;
  } | null>(null);

  // Estados para Push
  const [pushCount, setPushCount] = useState<number>(0);
  const [loadingPush, setLoadingPush] = useState(false);
  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [pushUrl, setPushUrl] = useState('/dashboard');
  const [sendingPush, setSendingPush] = useState(false);
  const [pushResult, setPushResult] = useState<{
    sent: number;
    failed: number;
    msg: string;
  } | null>(null);

  // Estados para Usuarios
  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchUser, setSearchUser] = useState('');
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'CUSTOMER' as 'CUSTOMER' | 'ADMIN',
  });
  const [creatingUser, setCreatingUser] = useState(false);

  // Estado general de Toast
  const [toast, setToast] = useState<{
    title: string;
    msg: string;
    type?: 'success' | 'warning' | 'error' | 'info';
  } | null>(null);

  const showToast = (
    title: string,
    msg: string,
    type: 'success' | 'warning' | 'error' | 'info' = 'info'
  ) => {
    setToast({ title, msg, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // ==========================================
  // CARGA DE DATOS
  // ==========================================
  const loadTurnos = async () => {
    try {
      setLoadingTurnos(true);
      const res = await fetch('/api/admin/turnos', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (json.success && Array.isArray(json.turnos)) {
        setTurnos(json.turnos);
      } else {
        console.warn('No se pudieron cargar turnos de admin:', json.error);
      }
    } catch (err) {
      console.error('Error al cargar turnos:', err);
    } finally {
      setLoadingTurnos(false);
    }
  };

  const loadPushInfo = async () => {
    try {
      setLoadingPush(true);
      const res = await fetch('/api/admin/push', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (json.success) {
        setPushCount(json.count || 0);
      }
    } catch (err) {
      console.error('Error al cargar push info:', err);
    } finally {
      setLoadingPush(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (json.success && Array.isArray(json.users)) {
        setUsersList(json.users);
      }
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadTurnos();
    loadPushInfo();
    loadUsers();
  }, []);

  // ==========================================
  // GESTIÓN DE TURNOS (ACCIONES ADMIN)
  // ==========================================
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const targetTurno = turnos.find((t) => t.id === id);

    try {
      if (newStatus === 'cancelado') {
        setCancellingId(id);
        // Filtrar inmediatamente del estado local de React para que desaparezca al instante de la pantalla
        setTurnos((prev) => prev.filter((t) => t.id !== id));
      } else {
        // Optimistic update visual para otros estados (ej: confirmado)
        setTurnos((prev) =>
          prev.map((t) => (t.id === id ? { ...t, estado: newStatus } : t))
        );
      }

      const res = await fetch('/api/admin/turnos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.error || 'No se pudo actualizar el estado.');
      }

      // Sincronización en tiempo real inmediata con la base de datos y revalidación de Next.js
      await loadTurnos();
      router.refresh();

      if (newStatus === 'cancelado') {
        showToast(
          'Turno Cancelado',
          'El turno fue cancelado y retirado de los turnos activos. Se emitieron las alertas por correo y WhatsApp.',
          'warning'
        );

        if (json.whatsAppUrl) {
          // Intentar abrir WhatsApp automáticamente
          try {
            window.open(json.whatsAppUrl, '_blank', 'noopener,noreferrer');
          } catch (_) {}

          // Abrir modal interactivo de confirmación y enlace directo de WhatsApp
          setWhatsAppModal({
            isOpen: true,
            url: json.whatsAppUrl,
            clientName: json.turno?.nombre_cliente || targetTurno?.nombre_cliente || 'Cliente',
            phone: json.turno?.client_phone || targetTurno?.client_phone || '',
            vehicle: json.turno?.vehiculo || targetTurno?.vehiculo || 'Vehículo',
            date: json.turno?.date || targetTurno?.date || '',
            time: json.turno?.time || targetTurno?.time || '',
          });
        }
      } else {
        showToast(
          'Turno Actualizado',
          `El estado del turno fue cambiado a "${newStatus}" exitosamente.`,
          'success'
        );
      }
    } catch (err: any) {
      showToast('Error', err.message || 'Falló la actualización.', 'error');
      await loadTurnos();
    } finally {
      setCancellingId(null);
    }
  };


  const handleSaveTurnoModification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTurno) return;

    try {
      setIsUpdatingTurno(true);
      const res = await fetch('/api/admin/turnos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTurno.id,
          date: editingTurno.date,
          time: editingTurno.time,
          vehicle: editingTurno.vehiculo,
          price: editingTurno.precio,
          notes: editingTurno.indicaciones,
          status: editingTurno.estado,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Error al guardar los cambios.');
      }

      setTurnos((prev) =>
        prev.map((t) => (t.id === editingTurno.id ? { ...editingTurno } : t))
      );

      showToast(
        'Turno Modificado',
        `La reserva fue reprogramada para el día ${editingTurno.date} a las ${editingTurno.time}.`,
        'success'
      );
      setEditingTurno(null);
    } catch (err: any) {
      showToast('Error', err.message || 'No se pudo guardar la modificación.', 'error');
    } finally {
      setIsUpdatingTurno(false);
    }
  };

  const handleDeleteTurno = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar permanentemente este turno? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setTurnos((prev) => prev.filter((t) => t.id !== id));
      const res = await fetch(`/api/admin/turnos?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Error al eliminar el turno.');
      }

      showToast('Turno Eliminado', 'El turno fue borrado permanentemente.', 'warning');
    } catch (err: any) {
      showToast('Error', err.message || 'No se pudo eliminar el turno.', 'error');
      loadTurnos();
    }
  };

  // Filtrado de Turnos
  const filteredTurnos = useMemo(() => {
    return turnos.filter((t) => {
      const q = searchTurno.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.nombre_cliente.toLowerCase().includes(q) ||
        (t.client_email && t.client_email.toLowerCase().includes(q)) ||
        (t.client_phone && t.client_phone.includes(q)) ||
        t.vehiculo.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q);

      const isCancelled =
        t.estado.toLowerCase() === 'cancelado' ||
        t.estado.toLowerCase() === 'cancelled';

      let matchesStatus = true;
      if (statusFilter === 'todos' || statusFilter === 'activos') {
        // En los turnos activos (vista principal), NO se muestran los cancelados
        matchesStatus = !isCancelled;
      } else if (statusFilter === 'cancelado') {
        matchesStatus = isCancelled;
      } else if (statusFilter === 'todos_registros') {
        matchesStatus = true;
      } else {
        matchesStatus = t.estado.toLowerCase() === statusFilter.toLowerCase();
      }

      const matchesDate = !dateFilter || t.date === dateFilter;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [turnos, searchTurno, statusFilter, dateFilter]);

  // Métricas de Turnos
  const stats = useMemo(() => {
    const confirmados = turnos.filter(
      (t) => t.estado === 'confirmado' || t.estado === 'confirmed'
    ).length;
    const pendientes = turnos.filter(
      (t) => t.estado === 'pendiente' || t.estado === 'pending'
    ).length;
    const cancelados = turnos.filter(
      (t) => t.estado === 'cancelado' || t.estado === 'cancelled'
    ).length;
    const activos = confirmados + pendientes;
    const ingresos = turnos
      .filter((t) => t.estado !== 'cancelado' && t.estado !== 'cancelled')
      .reduce((sum, t) => sum + (Number(t.precio) || 0), 0);

    return { total: activos, totalGeneral: turnos.length, confirmados, pendientes, cancelados, ingresos };
  }, [turnos]);

  // ==========================================
  // NOTIFICACIONES PUSH MANUALES
  // ==========================================
  const handleSendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTitle.trim() || !pushMessage.trim()) {
      showToast('Faltan Campos', 'Completá el título y mensaje de la notificación.', 'warning');
      return;
    }

    try {
      setSendingPush(true);
      setPushResult(null);

      const res = await fetch('/api/admin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pushTitle.trim(),
          message: pushMessage.trim(),
          url: pushUrl.trim(),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Fallo al despachar las notificaciones push.');
      }

      setPushResult({
        sent: json.sentCount || 0,
        failed: json.failedCount || 0,
        msg: json.message || 'Notificación despachada.',
      });

      showToast(
        'Notificación Enviada',
        `Entregadas con éxito a ${json.sentCount || 0} dispositivos registrados.`,
        'success'
      );

      // Limpiar formulario opcionalmente
      setPushTitle('');
      setPushMessage('');
      loadPushInfo();
    } catch (err: any) {
      showToast('Error Push', err.message || 'No se pudo enviar la notificación push.', 'error');
    } finally {
      setSendingPush(false);
    }
  };

  const setTemplate = (title: string, msg: string, url: string = '/dashboard') => {
    setPushTitle(title);
    setPushMessage(msg);
    setPushUrl(url);
  };

  // ==========================================
  // GESTIÓN DE USUARIOS
  // ==========================================
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.email || !newUserData.password) {
      showToast('Campos Incompletos', 'Ingresá correo y contraseña válida.', 'warning');
      return;
    }

    try {
      setCreatingUser(true);
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserData),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Error al crear el usuario.');
      }

      showToast(
        'Usuario Creado',
        `El usuario "${newUserData.email}" fue registrado con éxito.`,
        'success'
      );

      setShowCreateUserModal(false);
      setNewUserData({
        email: '',
        password: '',
        fullName: '',
        phone: '',
        role: 'CUSTOMER',
      });
      loadUsers();
    } catch (err: any) {
      showToast('Error al Crear', err.message || 'No se pudo crear el usuario.', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (email.toLowerCase() === 'bruno.marin.soporte@gmail.com') {
      showToast('Acción Bloqueada', 'No podés eliminar tu propia cuenta de Superadministrador.', 'error');
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario "${email}" y todos sus registros asociados?`)) {
      return;
    }

    try {
      setUsersList((prev) => prev.filter((u) => u.id !== userId));
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Error al eliminar el usuario.');
      }

      showToast('Usuario Eliminado', `La cuenta "${email}" fue eliminada del sistema.`, 'warning');
    } catch (err: any) {
      showToast('Error', err.message || 'No se pudo eliminar el usuario.', 'error');
      loadUsers();
    }
  };

  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const q = searchUser.toLowerCase().trim();
      return (
        !q ||
        u.email.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q) ||
        u.phone.includes(q)
      );
    });
  }, [usersList, searchUser]);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 selection:bg-cyan-500 selection:text-slate-950 pb-20">
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 right-4 z-50 max-w-md w-full p-4 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-start gap-3 ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
                : toast.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/30 text-amber-200'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/30 text-rose-200'
                : 'bg-slate-900/90 border-white/10 text-cyan-200'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
            {toast.type === 'error' && <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />}
            <div className="flex-1">
              <h5 className="font-extrabold text-sm text-white">{toast.title}</h5>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{toast.msg}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOPBAR SUPERADMIN */}
      <header className="sticky top-0 z-40 bg-[#070b14]/80 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="group flex items-center gap-2.5 transition-transform active:scale-95"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 via-cyan-500 to-emerald-400 p-[1px] shadow-lg shadow-cyan-500/20">
                <div className="w-full h-full bg-[#0d1322] rounded-[15px] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
                </div>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block leading-none">
                  AquaShine
                </span>
                <span className="text-sm font-black text-white tracking-tight">
                  San Rafael <span className="text-cyan-400">• Admin</span>
                </span>
              </div>
            </Link>

            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Superadministrador</span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] text-xs font-bold transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mi Vista Cliente</span>
            </Link>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black transition-all active:scale-95 shadow-md shadow-cyan-500/20"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ver Sitio Web</span>
            </Link>

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/');
                router.refresh();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6 sm:space-y-8">
        {/* BANNER IDENTIDAD SUPERADMIN */}
        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900/90 via-[#0e172a] to-slate-900/90 border border-cyan-500/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-extrabold uppercase tracking-wider mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Privilegios Totales Activos</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Panel de <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-cyan-400">Superadministrador</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Conectado como <strong className="text-cyan-300">{user.email}</strong>. Control integral de reservas, notificaciones y clientes.
              </p>
            </div>

            {/* Selector de Pestañas Principales */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-black/40 border border-white/[0.08] backdrop-blur-md">
              <button
                onClick={() => setActiveTab('turnos')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeTab === 'turnos'
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Turnos Activos ({stats.total})</span>
              </button>

              <button
                onClick={() => setActiveTab('push')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeTab === 'push'
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Bell className="w-4 h-4" />
                <span>Push ({pushCount})</span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Usuarios ({usersList.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* PESTAÑA 1: GESTIÓN DE TURNOS                                  */}
        {/* ============================================================== */}
        {activeTab === 'turnos' && (
          <section className="space-y-6">
            {/* Tarjetas de Métricas de Turnos */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/[0.06] backdrop-blur-md">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Turnos Activos</span>
                <p className="text-xl sm:text-2xl font-black text-white mt-1">{stats.total}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/50 border border-emerald-500/20 backdrop-blur-md">
                <span className="text-[10px] font-extrabold uppercase text-emerald-400 block">Confirmados</span>
                <p className="text-xl sm:text-2xl font-black text-emerald-300 mt-1">{stats.confirmados}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/50 border border-amber-500/20 backdrop-blur-md">
                <span className="text-[10px] font-extrabold uppercase text-amber-400 block">Pendientes</span>
                <p className="text-xl sm:text-2xl font-black text-amber-300 mt-1">{stats.pendientes}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/50 border border-rose-500/20 backdrop-blur-md">
                <span className="text-[10px] font-extrabold uppercase text-rose-400 block">Cancelados</span>
                <p className="text-xl sm:text-2xl font-black text-rose-300 mt-1">{stats.cancelados}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/50 border border-cyan-500/20 backdrop-blur-md col-span-2 sm:col-span-1">
                <span className="text-[10px] font-extrabold uppercase text-cyan-400 block">Ingresos Est.</span>
                <p className="text-xl sm:text-2xl font-black text-cyan-300 mt-1">
                  ${stats.ingresos.toLocaleString('es-AR')}
                </p>
              </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[220px] relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, vehículo o teléfono..."
                  value={searchTurno}
                  onChange={(e) => setSearchTurno(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/60 border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Filtro de Estado */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-950/60 border border-white/[0.08] text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="todos">Turnos Activos (Confirmados y Pendientes)</option>
                  <option value="confirmado">Solo Confirmados</option>
                  <option value="pendiente">Solo Pendientes</option>
                  <option value="cancelado">Cancelados (Historial)</option>
                  <option value="todos_registros">Todos los Registros (Inc. Cancelados)</option>
                </select>

                {/* Filtro de Fecha */}
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950/60 border border-white/[0.08] text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                  title="Filtrar por fecha específica"
                />

                {(searchTurno || statusFilter !== 'todos' || dateFilter) && (
                  <button
                    onClick={() => {
                      setSearchTurno('');
                      setStatusFilter('todos');
                      setDateFilter('');
                    }}
                    className="p-2 rounded-xl text-slate-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.08] text-xs font-bold transition-colors"
                    title="Limpiar filtros"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={loadTurnos}
                  disabled={loadingTurnos}
                  className="p-2 rounded-xl text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-xs font-bold transition-all disabled:opacity-50"
                  title="Refrescar lista"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingTurnos ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Listado de Turnos */}
            {loadingTurnos ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-cyan-400" />
                <p className="text-xs">Cargando turnos de todos los clientes...</p>
              </div>
            ) : filteredTurnos.length === 0 ? (
              <div className="p-12 rounded-3xl bg-slate-900/30 border border-white/[0.06] text-center space-y-3">
                <Calendar className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="text-base font-extrabold text-white">No se encontraron turnos</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {turnos.length === 0
                    ? 'Aún no se han generado reservas en el sistema.'
                    : 'Ningún turno coincide con los filtros de búsqueda aplicados.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTurnos.map((t) => {
                  const isConfirmado = t.estado === 'confirmado' || t.estado === 'confirmed' || t.estado === 'completado';
                  const isCancelado = t.estado === 'cancelado' || t.estado === 'cancelled';
                  const isPendiente = !isConfirmado && !isCancelado;

                  // Número para WhatsApp
                  const rawPhone = (t.client_phone || '').replace(/\D/g, '');
                  const cleanPhone = rawPhone.startsWith('549')
                    ? rawPhone
                    : rawPhone.startsWith('54')
                    ? `549${rawPhone.slice(2).replace(/^0+/, '')}`
                    : `549${rawPhone.replace(/^0+/, '')}`;

                  return (
                    <motion.div
                      key={t.id}
                      className="p-5 rounded-2xl bg-slate-900/60 border border-white/[0.08] hover:border-cyan-500/30 transition-all space-y-4 shadow-xl"
                    >
                      {/* Cabecera del Turno */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                              #{t.id.slice(0, 8)}
                            </span>
                            <span className="text-[10px] text-slate-400">• {t.categoria}</span>
                          </div>
                          <h4 className="text-base font-black text-white">{t.vehiculo}</h4>
                        </div>

                        {/* Badge de Estado */}
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${
                            isConfirmado
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : isCancelado
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {isConfirmado && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                          {isCancelado && <XCircle className="w-3 h-3 text-rose-400" />}
                          {isPendiente && <Clock className="w-3 h-3 text-amber-400" />}
                          <span>{t.estado}</span>
                        </span>
                      </div>

                      {/* Datos del Cliente y Horario */}
                      <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-950/50 border border-white/[0.04] text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Cliente:</span>
                          <span className="text-white font-bold">{t.nombre_cliente}</span>
                          {t.client_email && (
                            <span className="text-[11px] text-cyan-400 block truncate" title={t.client_email}>
                              {t.client_email}
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Fecha y Hora:</span>
                          <span className="text-white font-extrabold block">📅 {t.date}</span>
                          <span className="text-cyan-300 font-bold block">⏰ {t.time}</span>
                        </div>
                      </div>

                      {t.indicaciones && (
                        <p className="text-xs text-amber-300/90 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 leading-relaxed">
                          📝 <strong>Nota:</strong> {t.indicaciones}
                        </p>
                      )}

                      {/* Acciones del Superadministrador */}
                      <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                        {/* Botones de Cambio Rápido de Estado */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleUpdateStatus(t.id, 'confirmado')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                            title="Confirmar reserva"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Confirmar</span>
                          </button>

                          <button
                            onClick={() => handleUpdateStatus(t.id, 'cancelado')}
                            disabled={cancellingId === t.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                            title="Cancelar reserva y notificar por email y WhatsApp"
                          >
                            {cancellingId === t.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            <span>{cancellingId === t.id ? 'Cancelando...' : 'Cancelar'}</span>
                          </button>

                          {/* Botón Modificar Horario / Fecha */}
                          <button
                            onClick={() => setEditingTurno(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all cursor-pointer"
                            title="Modificar fecha u horario"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Modificar</span>
                          </button>
                        </div>

                        {/* WhatsApp y Eliminar */}
                        <div className="flex items-center gap-1.5">
                          {isCancelado && cleanPhone && (
                            <a
                              href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                                `Hola ${t.nombre_cliente}, te contactamos de AquaShine San Rafael para informarte que tu turno de ${t.vehiculo} para el día ${t.date} a las ${t.time} ha sido CANCELADO. Podés consultar por este medio o ingresar a https://lavadero-san-rafael.vercel.app/ para reprogramar.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/35 text-emerald-300 text-xs font-bold transition-all"
                              title="Reenviar alerta de cancelación por WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="hidden sm:inline">Aviso WhatsApp</span>
                            </a>
                          )}

                          {!isCancelado && cleanPhone && (
                            <a
                              href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                                `Hola ${t.nombre_cliente}, te escribo desde la administración de AquaShine San Rafael sobre tu turno de ${t.vehiculo} del día ${t.date} a las ${t.time}.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors"
                              title="Chat WhatsApp con cliente"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}

                          <button
                            onClick={() => handleDeleteTurno(t.id)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/20 transition-colors cursor-pointer"
                            title="Eliminar permanentemente del registro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 2: NOTIFICACIONES PUSH MANUALES                        */}
        {/* ============================================================== */}
        {activeTab === 'push' && (
          <section className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Formulario de Redacción */}
              <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900/60 border border-white/[0.08] backdrop-blur-md space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <Bell className="w-5 h-5 text-cyan-400" />
                      <span>Redactar Notificación Push</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Envía avisos directos a la pantalla y barra de notificaciones de los clientes
                    </p>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>{pushCount} dispositivos activos</span>
                  </span>
                </div>

                {/* Plantillas Rápidas */}
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    💡 Plantillas Rápidas Sugeridas:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setTemplate(
                          '🎉 ¡Promo Especial Fin de Semana!',
                          'Lavado completo con 20% OFF y cera protectora de regalo en AquaShine San Rafael.',
                          '/dashboard'
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.06] text-xs font-medium transition-all"
                    >
                      Promo 20% OFF
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setTemplate(
                          '📅 Nuevos Horarios Disponibles',
                          'Abrimos nuevos cupos de atención para esta semana. ¡Asegurá tu turno antes de que se agoten!',
                          '/'
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.06] text-xs font-medium transition-all"
                    >
                      Nuevos Cupos Abiertos
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setTemplate(
                          '✨ Tu auto merece brillar',
                          '¿Hace cuánto no lavás tu vehículo? Reservá en 2 minutos desde nuestra Web App.',
                          '/'
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.06] text-xs font-medium transition-all"
                    >
                      Recordatorio General
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSendPush} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Título de la Notificación:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 🎉 ¡Promo Especial en AquaShine!"
                      value={pushTitle}
                      onChange={(e) => setPushTitle(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950/70 border border-white/[0.08] text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Mensaje / Cuerpo de la Notificación:
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Escribe el mensaje claro y atractivo que verán los usuarios en su pantalla..."
                      value={pushMessage}
                      onChange={(e) => setPushMessage(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950/70 border border-white/[0.08] text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      URL de Destino al hacer Clic (Opcional):
                    </label>
                    <input
                      type="text"
                      placeholder="/dashboard o /"
                      value={pushUrl}
                      onChange={(e) => setPushUrl(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-white/[0.08] text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sendingPush || pushCount === 0}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 active:scale-98 text-slate-950 font-black text-sm shadow-xl shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingPush ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Despachando notificaciones a los dispositivos...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Enviar Notificación Push a {pushCount} Dispositivos</span>
                      </>
                    )}
                  </button>
                </form>

                {pushResult && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1">
                    <p className="font-extrabold text-sm">{pushResult.msg}</p>
                    <p>Entregadas con éxito: {pushResult.sent} • Fallidas / expiradas: {pushResult.failed}</p>
                  </div>
                )}
              </div>

              {/* Vista Previa en Vivo de la Notificación */}
              <div className="p-6 rounded-3xl bg-slate-900/40 border border-white/[0.08] space-y-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  📱 Vista Previa en Dispositivo:
                </span>

                <div className="p-4 rounded-2xl bg-[#0c1220] border border-white/[0.12] shadow-2xl space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-cyan-500/30 flex items-center justify-center">
                        <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
                      </div>
                      <span className="font-bold text-slate-200">AquaShine San Rafael</span>
                    </div>
                    <span>ahora</span>
                  </div>

                  <h5 className="font-extrabold text-sm text-white">
                    {pushTitle.trim() || 'Título de la Notificación'}
                  </h5>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {pushMessage.trim() || 'Aquí aparecerá el texto de la notificación que los clientes verán en sus celulares o computadoras.'}
                  </p>

                  <div className="pt-2 border-t border-white/[0.05] flex justify-end">
                    <span className="text-[10px] text-cyan-400 font-bold uppercase">
                      Tocar para abrir → {pushUrl || '/dashboard'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] text-xs text-slate-400 space-y-2">
                  <p className="font-bold text-slate-200">¿Cómo funciona Web Push?</p>
                  <p className="text-[11px] leading-relaxed">
                    Las notificaciones se envían a través del Service Worker y llegan incluso con el navegador cerrado si el usuario aceptó las notificaciones.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 3: GESTIÓN DE USUARIOS                                 */}
        {/* ============================================================== */}
        {activeTab === 'users' && (
          <section className="space-y-6">
            {/* Cabecera y Botón Nuevo Usuario */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <span>Usuarios de la Aplicación ({usersList.length})</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Visualizá, creá manualmente y administrá las cuentas registradas
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCreateUserModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all active:scale-95 shadow-lg shadow-cyan-500/20 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Crear Nuevo Usuario</span>
                </button>

                <button
                  onClick={loadUsers}
                  disabled={loadingUsers}
                  className="p-2.5 rounded-xl text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-xs font-bold transition-all"
                  title="Refrescar usuarios"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Búsqueda de Usuario */}
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por correo, nombre o teléfono..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/60 border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            {/* Tabla / Lista de Usuarios */}
            {loadingUsers ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-cyan-400" />
                <p className="text-xs">Cargando usuarios...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 rounded-3xl bg-slate-900/30 border border-white/[0.06] text-center space-y-3">
                <Users className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="text-base font-extrabold text-white">No se encontraron usuarios</h4>
                <p className="text-xs text-slate-400">Prueba con otro término de búsqueda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUsers.map((u) => {
                  const isSuper = u.role === 'ADMIN' || u.email.toLowerCase() === 'bruno.marin.soporte@gmail.com';

                  return (
                    <div
                      key={u.id}
                      className={`p-5 rounded-2xl border transition-all space-y-3 ${
                        isSuper
                          ? 'bg-cyan-950/20 border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                          : 'bg-slate-900/50 border-white/[0.06] hover:border-white/[0.12]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md inline-block mb-1 ${
                              isSuper
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isSuper ? '🛡️ Superadmin' : '👤 Cliente'}
                          </span>
                          <h4 className="text-sm font-black text-white">{u.fullName}</h4>
                        </div>

                        <span className="text-[10px] font-bold text-slate-400 bg-white/[0.05] px-2 py-1 rounded-lg">
                          {u.turnosCount} turno{u.turnosCount === 1 ? '' : 's'}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-slate-300">
                        <div className="flex items-center gap-2 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{u.email}</span>
                        </div>
                        {u.phone && u.phone !== 'No registrada' && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{u.phone}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between text-[11px] text-slate-400">
                        <span>Alta: {u.createdAt ? u.createdAt.split('T')[0] : 'N/A'}</span>

                        {!isSuper && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Eliminar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ============================================================== */}
      {/* MODAL: MODIFICAR TURNO (FECHA / HORARIO / DETALLES)            */}
      {/* ============================================================== */}
      <AnimatePresence>
        {editingTurno && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg p-6 rounded-3xl bg-[#0d1322] border border-cyan-500/30 shadow-2xl space-y-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider">
                    Modificar Turno #{editingTurno.id.slice(0, 8)}
                  </span>
                  <h3 className="text-lg font-black text-white">Reprogramar Reserva</h3>
                </div>
                <button
                  onClick={() => setEditingTurno(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-white/[0.04] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveTurnoModification} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Fecha del Lavado:
                    </label>
                    <input
                      type="date"
                      value={editingTurno.date}
                      onChange={(e) =>
                        setEditingTurno({ ...editingTurno, date: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950/70 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Horario Programado:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 10:00 a 12:00 hs"
                      value={editingTurno.time}
                      onChange={(e) =>
                        setEditingTurno({ ...editingTurno, time: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950/70 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Estado:
                    </label>
                    <select
                      value={editingTurno.estado}
                      onChange={(e) =>
                        setEditingTurno({ ...editingTurno, estado: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950/70 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="confirmado">Confirmado</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="cancelado">Cancelado</option>
                      <option value="completado">Completado</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Monto ($ ARS):
                    </label>
                    <input
                      type="number"
                      value={editingTurno.precio}
                      onChange={(e) =>
                        setEditingTurno({ ...editingTurno, precio: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950/70 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Vehículo (Marca / Modelo):
                  </label>
                  <input
                    type="text"
                    value={editingTurno.vehiculo}
                    onChange={(e) =>
                      setEditingTurno({ ...editingTurno, vehiculo: e.target.value })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/70 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Indicaciones / Observaciones:
                  </label>
                  <textarea
                    rows={2}
                    value={editingTurno.indicaciones || ''}
                    onChange={(e) =>
                      setEditingTurno({ ...editingTurno, indicaciones: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/70 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>

                <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTurno(null)}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 text-xs font-bold transition-colors"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isUpdatingTurno}
                    className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-black text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
                  >
                    {isUpdatingTurno ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Guardar Modificación</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* MODAL: CREAR NUEVO USUARIO MANUEL                              */}
      {/* ============================================================== */}
      <AnimatePresence>
        {showCreateUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-3xl bg-[#0d1322] border border-cyan-500/30 shadow-2xl space-y-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider">
                    Administración de Usuarios
                  </span>
                  <h3 className="text-lg font-black text-white">Crear Nuevo Usuario</h3>
                </div>
                <button
                  onClick={() => setShowCreateUserModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-white/[0.04] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Correo Electrónico:
                  </label>
                  <input
                    type="email"
                    placeholder="cliente@ejemplo.com"
                    value={newUserData.email}
                    onChange={(e) =>
                      setNewUserData({ ...newUserData, email: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Contraseña Inicial (mínimo 6 caracteres):
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={newUserData.password}
                    onChange={(e) =>
                      setNewUserData({ ...newUserData, password: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-cyan-500"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Nombre Completo:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Carlos Gómez"
                    value={newUserData.fullName}
                    onChange={(e) =>
                      setNewUserData({ ...newUserData, fullName: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Teléfono / WhatsApp:
                  </label>
                  <input
                    type="tel"
                    placeholder="Ej: +54 9 260 412-3456"
                    value={newUserData.phone}
                    onChange={(e) =>
                      setNewUserData({ ...newUserData, phone: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Rol Asignado:
                  </label>
                  <select
                    value={newUserData.role}
                    onChange={(e) =>
                      setNewUserData({
                        ...newUserData,
                        role: e.target.value as 'CUSTOMER' | 'ADMIN',
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="CUSTOMER">Cliente Estándar</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateUserModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 text-xs font-bold transition-colors"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-black text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
                  >
                    {creatingUser ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PlusCircle className="w-3.5 h-3.5" />
                    )}
                    <span>Guardar Usuario</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: ALERTA DE CANCELACIÓN POR WHATSAPP */}
      {whatsAppModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-emerald-500/10 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/20">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Notificación Disparada
                  </span>
                  <h3 className="text-lg font-black text-white mt-1">
                    Alerta de Cancelación por WhatsApp
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setWhatsAppModal(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/[0.06] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Cliente:</span>
                <span className="text-white font-bold">{whatsAppModal.clientName}</span>
              </div>
              {whatsAppModal.phone && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Teléfono:</span>
                  <span className="text-emerald-400 font-bold">{whatsAppModal.phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Vehículo:</span>
                <span className="text-white font-bold">{whatsAppModal.vehicle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Fecha y Hora:</span>
                <span className="text-cyan-300 font-bold">
                  {whatsAppModal.date} • {whatsAppModal.time}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              El estado ha sido actualizado a <strong className="text-rose-400">Cancelado</strong> en la base de datos y el correo electrónico fue enviado. Hacé clic abajo para abrir o enviar el mensaje prearmado al WhatsApp del cliente:
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <a
                href={whatsAppModal.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setWhatsAppModal(null)}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-emerald-500/25 transition-all active:scale-95 text-center cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 fill-slate-950" />
                <span>Abrir WhatsApp del Cliente</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(whatsAppModal.url);
                  showToast('Enlace Copiado', 'URL de WhatsApp copiada al portapapeles.', 'success');
                }}
                className="py-3 px-4 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-xs font-bold transition-colors border border-white/[0.08]"
              >
                Copiar Enlace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}
