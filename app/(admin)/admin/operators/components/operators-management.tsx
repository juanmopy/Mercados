'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, Plus, Unlock, Power, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function OperatorsManagement() {
  const router = useRouter();
  const [operators, setOperators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newOp, setNewOp] = useState({ name: '' });
  const [creating, setCreating] = useState(false);
  const [createdCode, setCreatedCode] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/operators');
      if (!res.ok) { router.push('/admin'); return; }
      setOperators(await res.json() ?? []);
    } catch { router.push('/admin'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newOp.name.trim()) { toast.error('El nombre del operador es requerido'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/operators', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newOp) });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Error'); return; }
      setCreatedCode(data?.code ?? '');
      toast.success('Operador creado. Guarde el código generado.');
      setShowCreate(false);
      setNewOp({ name: '' });
      load();
    } catch { toast.error('Error'); }
    finally { setCreating(false); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/operators/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !current }) });
      if (!res.ok) { toast.error('Error'); return; }
      toast.success(current ? 'Operador desactivado' : 'Operador activado');
      load();
    } catch { toast.error('Error'); }
  };

  const unblock = async (id: string) => {
    try {
      const res = await fetch(`/api/operators/${id}/unblock`, { method: 'POST' });
      if (!res.ok) { toast.error('Error'); return; }
      toast.success('Operador desbloqueado');
      load();
    } catch { toast.error('Error'); }
  };

  const regenerateCode = async (id: string) => {
    try {
      const res = await fetch(`/api/operators/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regenerateCode: true }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Error'); return; }
      setCreatedCode(data?.code ?? '');
      toast.success('Código regenerado. Guarde el nuevo código.');
      load();
    } catch { toast.error('Error'); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/admin/dashboard')} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
            <Users className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">Operadores</span>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {showCreate && (
          <div className="bg-card rounded-xl p-6 mb-6" style={{ boxShadow: 'var(--shadow-md)' }}>
            <h3 className="font-bold text-foreground mb-4">Crear operador</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Nombre completo" value={newOp.name} onChange={(e) => setNewOp({ ...newOp, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground" />
              <p className="text-sm text-muted-foreground">El sistema generará automáticamente un código único de 4 dígitos.</p>
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={creating} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">{creating ? 'Creando...' : 'Crear'}</button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {createdCode && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
            <p className="font-bold text-green-900">Código generado</p>
            <p className="text-sm text-green-800 mt-1">Entréguelo al operador. No se volverá a mostrar.</p>
            <p className="font-mono text-4xl tracking-[0.5em] text-green-900 mt-4">{createdCode}</p>
            <button onClick={() => setCreatedCode('')} className="mt-4 px-3 py-2 rounded-lg bg-green-700 text-white text-sm font-bold">Ocultar código</button>
          </div>
        )}

        <div className="space-y-3">
          {(operators ?? []).map((op: any) => {
            const isBlocked = op?.blockedUntil && new Date(op.blockedUntil) > new Date();
            return (
              <div key={op?.id} className="bg-card rounded-xl p-4 flex items-center justify-between" style={{ boxShadow: 'var(--shadow-sm)' }}>
                <div>
                  <p className="font-bold text-foreground">{op?.name ?? ''}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${op?.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {op?.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                    {isBlocked && <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">Bloqueado</span>}
                    <span className="text-xs text-muted-foreground">{op?._count?.deliveries ?? 0} entregas</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleActive(op.id, op.isActive)} className="p-2 rounded-lg hover:bg-muted" title={op?.isActive ? 'Desactivar' : 'Activar'}>
                    <Power className={`w-4 h-4 ${op?.isActive ? 'text-green-600' : 'text-red-600'}`} />
                  </button>
                  {isBlocked && (
                    <button onClick={() => unblock(op.id)} className="p-2 rounded-lg hover:bg-muted" title="Desbloquear">
                      <Unlock className="w-4 h-4 text-orange-600" />
                    </button>
                  )}
                  <button onClick={() => regenerateCode(op.id)} className="p-2 rounded-lg hover:bg-muted" title="Regenerar código">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
