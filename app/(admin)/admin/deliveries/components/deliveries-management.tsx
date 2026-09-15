'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, Search, Trash2, Image, CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export function DeliveriesManagement() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ jornadaId: '', operatorId: '', search: '', page: 1 });
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [photoModal, setPhotoModal] = useState<string | null>(null);
  const [correctionDelivery, setCorrectionDelivery] = useState<any>(null);
  const [correctionTimestamp, setCorrectionTimestamp] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correcting, setCorrecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.jornadaId) params.set('jornadaId', filters.jornadaId);
      if (filters.operatorId) params.set('operatorId', filters.operatorId);
      if (filters.search) params.set('search', filters.search);
      params.set('page', String(filters.page));
      params.set('limit', '20');

      const res = await fetch(`/api/deliveries?${params}`);
      if (!res.ok) { router.push('/admin'); return; }
      const data = await res.json();
      setDeliveries(data?.deliveries ?? []);
      setTotalPages(data?.totalPages ?? 1);
      setTotal(data?.total ?? 0);
    } catch { router.push('/admin'); }
    finally { setLoading(false); }
  }, [filters, router]);

  useEffect(() => {
    const init = async () => {
      const [jRes, oRes] = await Promise.all([fetch('/api/jornadas'), fetch('/api/operators')]);
      setJornadas(await jRes.json() ?? []);
      setOperators(await oRes.json() ?? []);
    };
    init();
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta entrega? El beneficiario volverá a estado pendiente.')) return;
    try {
      const res = await fetch(`/api/deliveries/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? 'Error eliminando');
        return;
      }
      toast.success('Entrega eliminada');
      load();
    } catch { toast.error('Error'); }
  };

  const viewPhoto = async (id: string) => {
    try {
      const res = await fetch(`/api/deliveries/${id}`);
      const data = await res.json();
      if (data?.photoUrl) setPhotoModal(data.photoUrl);
      else toast.error('No se pudo cargar la foto');
    } catch { toast.error('Error'); }
  };

  const openCorrection = (delivery: any) => {
    const source = new Date(delivery?.correctedTimestamp ?? delivery?.serverTimestamp ?? Date.now());
    const local = new Date(source.getTime() - source.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setCorrectionDelivery(delivery);
    setCorrectionTimestamp(local);
    setCorrectionReason('');
  };

  const submitCorrection = async () => {
    if (!correctionDelivery || !correctionTimestamp || !correctionReason.trim()) {
      toast.error('Fecha, hora y motivo son requeridos');
      return;
    }
    setCorrecting(true);
    try {
      const res = await fetch(`/api/deliveries/${correctionDelivery.id}/correct-datetime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correctedTimestamp: new Date(correctionTimestamp).toISOString(), reason: correctionReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Error corrigiendo fecha y hora'); return; }
      toast.success('Fecha y hora corregidas');
      setCorrectionDelivery(null);
      load();
    } catch { toast.error('Error de conexión'); }
    finally { setCorrecting(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.push('/admin/dashboard')} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
          <Package className="w-5 h-5 text-primary" />
          <span className="font-bold text-foreground">Entregas</span>
          <span className="text-sm text-muted-foreground ml-2">({total})</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <select value={filters.jornadaId} onChange={(e) => setFilters({ ...filters, jornadaId: e.target.value, page: 1 })} className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm">
            <option value="">Todas las jornadas</option>
            {(jornadas ?? []).map((j: any) => <option key={j?.id} value={j?.id}>{j?.description}</option>)}
          </select>
          <select value={filters.operatorId} onChange={(e) => setFilters({ ...filters, operatorId: e.target.value, page: 1 })} className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm">
            <option value="">Todos los operadores</option>
            {(operators ?? []).map((o: any) => <option key={o?.id} value={o?.id}>{o?.name}</option>)}
          </select>
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Buscar por nombre o cédula" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })} className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Nombre</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Cédula</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Jornada</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium hidden md:table-cell">Operador</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Fecha/Hora</th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(deliveries ?? []).map((d: any) => (
                    <tr key={d?.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-2 px-2 font-medium text-foreground">{d?.beneficiary?.fullName ?? ''}</td>
                      <td className="py-2 px-2 font-mono text-muted-foreground">{d?.beneficiary?.cedula ?? ''}</td>
                      <td className="py-2 px-2 text-muted-foreground hidden md:table-cell">{d?.jornada?.description ?? ''}</td>
                      <td className="py-2 px-2 text-muted-foreground hidden md:table-cell">{d?.operator?.name ?? ''}</td>
                      <td className="py-2 px-2 text-muted-foreground text-xs">
                        {d?.serverTimestamp ? new Date(d.serverTimestamp).toLocaleString('es-CO') : ''}
                        {d?.isPhotoReplaced && <span className="ml-1 text-orange-500" title="Foto reemplazada">📷</span>}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => viewPhoto(d.id)} className="p-1.5 rounded hover:bg-muted" title="Ver foto"><Image className="w-4 h-4 text-blue-600" /></button>
                          {d?.jornada?.status === 'REABIERTA' && <button onClick={() => openCorrection(d)} className="p-1.5 rounded hover:bg-muted" title="Corregir fecha y hora"><CalendarClock className="w-4 h-4 text-orange-600" /></button>}
                          {(d?.jornada?.status === 'ACTIVA' || d?.jornada?.status === 'REABIERTA') && <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-muted" title="Eliminar entrega"><Trash2 className="w-4 h-4 text-red-600" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">Página {filters.page} de {totalPages}</span>
              <div className="flex gap-1">
                <button disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })} className="p-2 rounded-lg hover:bg-muted disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                <button disabled={filters.page >= totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })} className="p-2 rounded-lg hover:bg-muted disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Photo modal */}
      {photoModal && (
        <button type="button" className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 w-full" aria-label="Cerrar fotografía" onClick={() => setPhotoModal(null)}>
          <img src={photoModal} alt="Foto de entrega" className="max-w-full max-h-[80vh] rounded-xl" />
        </button>
      )}

      {correctionDelivery && (
        <dialog open className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 w-full max-w-none h-full max-h-none">
          <div className="bg-card rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 id="correction-title" className="text-lg font-bold text-foreground">Corregir fecha y hora</h2>
            <p className="text-sm text-muted-foreground">{correctionDelivery?.beneficiary?.fullName ?? ''}</p>
            <label className="block text-sm text-muted-foreground"><span>Fecha y hora</span>
              <input type="datetime-local" value={correctionTimestamp} onChange={(e) => setCorrectionTimestamp(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground" />
            </label>
            <label className="block text-sm text-muted-foreground"><span>Motivo</span>
              <textarea value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground" placeholder="Explique la corrección" />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCorrectionDelivery(null)} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm">Cancelar</button>
              <button onClick={submitCorrection} disabled={correcting} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">{correcting ? 'Guardando...' : 'Guardar corrección'}</button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
