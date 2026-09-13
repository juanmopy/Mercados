'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Plus, Play, Square, RotateCcw, Trash2, ArrowLeft, Users, Package, Eye } from 'lucide-react';
import { toast } from 'sonner';

export function JornadasManagement() {
  const router = useRouter();
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newJornada, setNewJornada] = useState({ description: '', officialDate: '', allowEarly: false, allowLate: false });

  const loadJornadas = useCallback(async () => {
    try {
      const res = await fetch('/api/jornadas');
      if (!res.ok) { router.push('/admin'); return; }
      const data = await res.json();
      setJornadas(data ?? []);
    } catch { router.push('/admin'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { loadJornadas(); }, [loadJornadas]);

  const handleCreate = async () => {
    if (!newJornada.description || !newJornada.officialDate) { toast.error('Complete todos los campos'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/jornadas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newJornada),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Error'); return; }
      toast.success('Jornada creada exitosamente');
      setShowCreate(false);
      setNewJornada({ description: '', officialDate: '', allowEarly: false, allowLate: false });
      loadJornadas();
    } catch { toast.error('Error de conexión'); }
    finally { setCreating(false); }
  };

  const handleAction = async (id: string, action: string) => {
    if (!confirm(`¿Está seguro de ${action} esta jornada?`)) return;
    try {
      const endpoint = action === 'delete' ? `/api/jornadas/${id}` : `/api/jornadas/${id}/${action}`;
      const method = action === 'delete' ? 'DELETE' : 'POST';
      const res = await fetch(endpoint, { method });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Error'); return; }
      const actionLabels: Record<string, string> = { activate: 'activada', close: 'cerrada', reopen: 'reabierta', delete: 'eliminada' };
      toast.success(`Jornada ${actionLabels[action] ?? 'actualizada'}`);
      loadJornadas();
    } catch { toast.error('Error de conexión'); }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      CONFIGURADA: 'bg-yellow-100 text-yellow-800',
      ACTIVA: 'bg-green-100 text-green-800',
      REABIERTA: 'bg-blue-100 text-blue-800',
      CERRADA: 'bg-gray-100 text-gray-800',
    };
    return <span className={`px-2 py-1 rounded-md text-xs font-bold ${colors[status] ?? 'bg-gray-100 text-gray-800'}`}>{status}</span>;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/admin/dashboard')} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
            <Calendar className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">Jornadas</span>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Nueva
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {showCreate && (
          <div className="bg-card rounded-xl p-6 mb-6" style={{ boxShadow: 'var(--shadow-md)' }}>
            <h3 className="text-lg font-bold text-foreground mb-4">Crear nueva jornada</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="new-jornada-description" className="text-sm text-muted-foreground block mb-1">Descripción</label>
                <input id="new-jornada-description" type="text" value={newJornada.description} onChange={(e) => setNewJornada({ ...newJornada, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground" placeholder="Entrega de Mercados - Jornada 1" />
              </div>
              <div>
                <label htmlFor="new-jornada-date" className="text-sm text-muted-foreground block mb-1">Fecha oficial</label>
                <input id="new-jornada-date" type="date" value={newJornada.officialDate} onChange={(e) => setNewJornada({ ...newJornada, officialDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground" />
              </div>
              <div className="flex gap-4">
                <label htmlFor="allow-early" className="flex items-center gap-2 text-sm text-foreground">
                  <input id="allow-early" type="checkbox" checked={newJornada.allowEarly} onChange={(e) => setNewJornada({ ...newJornada, allowEarly: e.target.checked })} className="rounded" />
                  <span>Permitir anticipadas</span>
                </label>
                <label htmlFor="allow-late" className="flex items-center gap-2 text-sm text-foreground">
                  <input id="allow-late" type="checkbox" checked={newJornada.allowLate} onChange={(e) => setNewJornada({ ...newJornada, allowLate: e.target.checked })} className="rounded" />
                  <span>Permitir posteriores</span>
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={creating} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-50">
                  {creating ? 'Creando...' : 'Crear jornada'}
                </button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {(jornadas ?? []).map((j: any) => (
            <div key={j?.id} className="bg-card rounded-xl p-4" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-foreground">{j?.description ?? ''}</h3>
                  <p className="text-sm text-muted-foreground">Fecha: {j?.officialDate ? new Date(j.officialDate).toLocaleDateString('es-CO') : ''}</p>
                </div>
                {statusBadge(j?.status ?? '')}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {j?._count?.beneficiaries ?? 0} beneficiarios</span>
                <span className="flex items-center gap-1"><Package className="w-4 h-4" /> {j?._count?.deliveries ?? 0} entregas</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => router.push(`/admin/jornadas/${j?.id}`)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:bg-accent hover:text-accent-foreground">
                  <Eye className="w-3 h-3" /> Ver detalle
                </button>
                {(j?.status === 'CONFIGURADA' || j?.status === 'CERRADA') && (
                  <>
                    {j?.status === 'CONFIGURADA' && <button onClick={() => handleAction(j.id, 'activate')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-100 text-green-800 text-xs font-bold hover:bg-green-200">
                      <Play className="w-3 h-3" /> Activar
                    </button>}
                    <button onClick={() => handleAction(j.id, 'delete')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 text-red-800 text-xs font-bold hover:bg-red-200">
                      <Trash2 className="w-3 h-3" /> Eliminar
                    </button>
                  </>
                )}
                {(j?.status === 'ACTIVA' || j?.status === 'REABIERTA') && (
                  <button onClick={() => handleAction(j.id, 'close')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-100 text-orange-800 text-xs font-bold hover:bg-orange-200">
                    <Square className="w-3 h-3" /> Cerrar
                  </button>
                )}
                {j?.status === 'CERRADA' && (
                  <button onClick={() => handleAction(j.id, 'reopen')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-800 text-xs font-bold hover:bg-blue-200">
                    <RotateCcw className="w-3 h-3" /> Reabrir
                  </button>
                )}
              </div>
            </div>
          ))}

          {(jornadas?.length ?? 0) === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay jornadas creadas</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
