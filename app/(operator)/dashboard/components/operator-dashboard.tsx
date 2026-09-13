'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Camera, LogOut, Package, User } from 'lucide-react';

export function OperatorDashboard() {
  const router = useRouter();
  const [operatorName, setOperatorName] = useState('');
  const [deliveryCount, setDeliveryCount] = useState(0);
  const [activeJornada, setActiveJornada] = useState<any>(null);
  const [cedula, setCedula] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) { router.push('/'); return; }
      const data = await res.json();
      if (data?.type !== 'operator') { router.push('/'); return; }
      setOperatorName(data?.name ?? '');
      setDeliveryCount(data?.deliveryCount ?? 0);

      const jRes = await fetch('/api/jornadas/active');
      const jData = await jRes.json();
      setActiveJornada(jData?.jornada ?? null);
    } catch {
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadSession(); }, [loadSession]);

  const handleSearch = async () => {
    const clean = (cedula ?? '').replace(/\D/g, '');
    if (!clean) { setError('Ingrese un número de cédula'); return; }
    setSearching(true);
    setError('');
    try {
      const res = await fetch(`/api/beneficiaries/search?cedula=${clean}`);
      const data = await res.json();
      if (!data?.found) {
        setError(data?.message ?? 'Beneficiario no encontrado. Verifique el número de cédula digitado.');
        return;
      }
      router.push(`/beneficiary/${clean}`);
    } catch {
      setError('Error de conexión. Intente nuevamente.');
    } finally {
      setSearching(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-950 to-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-950 to-gray-900 px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <User className="w-6 h-6 text-green-400" />
          <span className="text-xl font-bold text-white">{operatorName}</span>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1 text-gray-400 hover:text-red-400 transition-colors">
          <LogOut className="w-5 h-5" />
          <span className="text-sm">Salir</span>
        </button>
      </div>

      <div className="bg-green-600/20 border border-green-500/30 rounded-2xl p-6 mb-6 text-center">
        <Package className="w-10 h-10 text-green-400 mx-auto mb-2" />
        <p className="text-green-300 text-lg">Entregas realizadas</p>
        <p className="text-5xl font-bold text-green-400 font-mono">{deliveryCount}</p>
      </div>

      {activeJornada ? (
        <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-4 mb-6">
          <p className="text-blue-300 text-sm">Jornada activa</p>
          <p className="text-white font-bold text-lg">{activeJornada?.description ?? ''}</p>
        </div>
      ) : (
        <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-xl p-4 mb-6">
          <p className="text-yellow-300 font-bold text-lg text-center">
            No hay jornada habilitada en este momento. Contacte al administrador.
          </p>
        </div>
      )}

      {activeJornada && (
        <>
          <div className="mb-4">
            <label htmlFor="operator-cedula" className="text-gray-300 text-lg mb-2 block">Buscar por cédula</label>
            <input
              id="operator-cedula"
              type="tel"
              value={cedula}
              onChange={(e) => { setCedula(e.target.value); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="Número de cédula"
              className="w-full bg-gray-800 border-2 border-gray-600 focus:border-blue-400 rounded-xl px-4 py-4 text-2xl text-white text-center tracking-widest font-mono placeholder:text-gray-600 outline-none transition-colors"
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={searching || !cedula}
            className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xl font-bold mb-4 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Search className="w-6 h-6" />
            {searching ? 'Buscando...' : 'Buscar'}
          </button>

          <button
            onClick={() => router.push('/scanner')}
            className="w-full py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xl font-bold mb-4 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Camera className="w-6 h-6" />
            Capturar CC
          </button>
        </>
      )}

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-xl px-4 py-3 mb-4">
          <p className="text-red-300 text-center">{error}</p>
        </div>
      )}
    </div>
  );
}
