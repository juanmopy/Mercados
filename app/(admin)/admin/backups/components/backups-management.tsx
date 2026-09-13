'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Database, Plus, Clock, HardDrive } from 'lucide-react';
import { toast } from 'sonner';

export function BackupsManagement() {
  const router = useRouter();
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/backups');
      if (!res.ok) { router.push('/admin'); return; }
      setBackups(await res.json() ?? []);
    } catch { router.push('/admin'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const createBackup = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/backups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trigger: 'MANUAL' }) });
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Error creando backup'); return; }
      toast.success('Backup creado exitosamente');
      load();
    } catch { toast.error('Error'); }
    finally { setCreating(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/admin/dashboard')} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
            <Database className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">Copias de seguridad</span>
          </div>
          <button onClick={createBackup} disabled={creating} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">
            <Plus className="w-4 h-4" /> {creating ? 'Creando...' : 'Crear backup'}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-3">
          {(backups ?? []).map((b: any) => (
            <div key={b?.id} className="bg-card rounded-xl p-4 flex items-center justify-between" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <div>
                <p className="font-bold text-foreground text-sm">{b?.storagePath ?? ''}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {b?.createdAt ? new Date(b.createdAt).toLocaleString('es-CO') : ''}</span>
                  <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> {b?.sizeBytes ? `${Math.round((b.sizeBytes ?? 0) / 1024)} KB` : 'N/A'}</span>
                  <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{b?.trigger ?? ''}</span>
                </div>
                {b?.jornada && <p className="text-xs text-muted-foreground mt-1">Jornada: {b.jornada?.description ?? ''}</p>}
              </div>
            </div>
          ))}

          {(backups?.length ?? 0) === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay copias de seguridad</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
