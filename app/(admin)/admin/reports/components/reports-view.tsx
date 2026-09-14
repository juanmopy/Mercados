'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, FileText, Plus, Users, Package, TrendingUp, Clock } from 'lucide-react';
import dynamic from 'next/dynamic';

const StatsCharts = dynamic(() => import('../../dashboard/components/stats-charts').then(m => m.StatsCharts), { ssr: false });

export function ReportsView() {
  const router = useRouter();
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [selectedJornada, setSelectedJornada] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/jornadas');
        if (!res.ok) { router.push('/admin'); return; }
        const data = await res.json();
        setJornadas(data ?? []);
        if ((data?.length ?? 0) > 0) setSelectedJornada(data[0]?.id ?? '');
      } catch { router.push('/admin'); }
      finally { setLoading(false); }
    };
    init();
  }, [router]);

  useEffect(() => {
    if (!selectedJornada) return;
    const load = async () => {
      const res = await fetch(`/api/reports/stats?jornadaId=${selectedJornada}`);
      setStats(await res.json());
    };
    load();
  }, [selectedJornada]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.push('/admin/dashboard')} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
          <FileText className="w-5 h-5 text-primary" />
          <span className="font-bold text-foreground">Reportes</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {(jornadas?.length ?? 0) === 0 ? (
          <div className="min-h-[calc(100vh-150px)] flex items-center justify-center">
            <div className="w-full max-w-lg bg-card rounded-xl p-8 text-center" style={{ boxShadow: 'var(--shadow-md)' }}>
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground mb-2">Aún no hay jornadas creadas</h1>
              <p className="text-muted-foreground mb-6">Crea una jornada para comenzar a importar beneficiarios y consultar sus reportes.</p>
              <button onClick={() => router.push('/admin/jornadas')} className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90">
                <Plus className="w-4 h-4" /> Crear jornada
              </button>
            </div>
          </div>
        ) : (
          <>
            <select value={selectedJornada} onChange={(e) => setSelectedJornada(e.target.value)} className="w-full max-w-md px-4 py-2 rounded-lg border border-input bg-background text-foreground mb-6">
              {(jornadas ?? []).map((j: any) => <option key={j?.id} value={j?.id}>{j?.description} ({j?.status})</option>)}
            </select>

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
                      <div className="bg-primary h-2 rounded-full" style={{ width: `${stats?.percentage ?? 0}%` }} />
                    </div>
                  </div>
                </div>
                <StatsCharts byOperator={stats?.byOperator ?? []} byHour={stats?.byHour ?? []} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
