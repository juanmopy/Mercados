'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Package, Clock, LogOut, Shield, Database, TrendingUp, Calendar } from 'lucide-react';
import dynamic from 'next/dynamic';

const StatsCharts = dynamic(() => import('./stats-charts').then(m => m.StatsCharts), { ssr: false });

export function AdminDashboard() {
  const router = useRouter();
  const [adminName, setAdminName] = useState('');
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [selectedJornada, setSelectedJornada] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) { router.push('/admin'); return; }
      const data = await res.json();
      if (data?.type !== 'admin') { router.push('/admin'); return; }
      setAdminName(data?.name ?? '');
    } catch {
      router.push('/admin');
    }
  }, [router]);

  const loadJornadas = useCallback(async () => {
    try {
      const res = await fetch('/api/jornadas');
      const data = await res.json();
      setJornadas(data ?? []);
      if ((data?.length ?? 0) > 0) {
        const active = (data ?? []).find((j: any) => j?.status === 'ACTIVA');
        setSelectedJornada(active?.id ?? data[0]?.id ?? '');
      }
    } catch {}
  }, []);

  const loadStats = useCallback(async (jornadaId: string) => {
    if (!jornadaId) return;
    try {
      const res = await fetch(`/api/reports/stats?jornadaId=${jornadaId}`);
      const data = await res.json();
      setStats(data);
    } catch {}
  }, []);

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      await loadJornadas();
      setLoading(false);
    };
    init();
  }, [checkAuth, loadJornadas]);

  useEffect(() => {
    if (selectedJornada) loadStats(selectedJornada);
  }, [selectedJornada, loadStats]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;
  }

  const navItems = [
    { label: 'Jornadas', icon: Calendar, href: '/admin/jornadas' },
    { label: 'Operadores', icon: Users, href: '/admin/operators' },
    { label: 'Entregas', icon: Package, href: '/admin/deliveries' },
    { label: 'Backups', icon: Database, href: '/admin/backups' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <span className="font-bold text-foreground font-display">Mercados Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">{adminName}</span>
            <button onClick={handleLogout} className="text-muted-foreground hover:text-destructive transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {navItems.map((item) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card hover:bg-accent text-card-foreground hover:text-accent-foreground transition-all text-sm font-medium"
              style={{ boxShadow: 'var(--shadow-sm)' }}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Jornada selector */}
        <div className="mb-6">
          <label htmlFor="dashboard-jornada" className="text-sm text-muted-foreground mb-1 block">Seleccionar jornada</label>
          <select
            id="dashboard-jornada"
            value={selectedJornada}
            onChange={(e) => setSelectedJornada(e.target.value)}
            className="w-full max-w-md px-4 py-2 rounded-lg border border-input bg-background text-foreground"
          >
            {(jornadas ?? []).map((j: any) => (
              <option key={j?.id} value={j?.id}>
                {j?.description} ({j?.status})
              </option>
            ))}
          </select>
        </div>

        {/* Stats cards */}
        {stats && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-card rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
                <Users className="w-6 h-6 text-blue-500 mb-2" />
                <p className="text-muted-foreground text-sm">Total beneficiarios</p>
                <p className="text-2xl font-bold text-foreground font-mono">{stats?.totalBeneficiaries ?? 0}</p>
              </div>
              <div className="bg-card rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
                <Package className="w-6 h-6 text-green-500 mb-2" />
                <p className="text-muted-foreground text-sm">Entregas</p>
                <p className="text-2xl font-bold text-foreground font-mono">{stats?.totalDeliveries ?? 0}</p>
              </div>
              <div className="bg-card rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
                <Clock className="w-6 h-6 text-orange-500 mb-2" />
                <p className="text-muted-foreground text-sm">Pendientes</p>
                <p className="text-2xl font-bold text-foreground font-mono">{stats?.pending ?? 0}</p>
              </div>
              <div className="bg-card rounded-xl p-4" style={{ boxShadow: 'var(--shadow-md)' }}>
                <TrendingUp className="w-6 h-6 text-purple-500 mb-2" />
                <p className="text-muted-foreground text-sm">Avance</p>
                <p className="text-2xl font-bold text-foreground font-mono">{stats?.percentage ?? 0}%</p>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${stats?.percentage ?? 0}%` }} />
                </div>
              </div>
            </div>

            <StatsCharts byOperator={stats?.byOperator ?? []} byHour={stats?.byHour ?? []} />
          </>
        )}
      </div>
    </div>
  );
}
