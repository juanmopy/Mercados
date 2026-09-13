'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, CheckCircle, XCircle, Camera, ArrowLeft } from 'lucide-react';

export function BeneficiaryDetail({ cedula }: { readonly cedula: string }) {
  const router = useRouter();
  const [beneficiary, setBeneficiary] = useState<any>(null);
  const [hasDelivery, setHasDelivery] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/beneficiaries/search?cedula=${cedula}`);
        const data = await res.json();
        if (!data?.found) {
          setError(data?.message ?? 'Beneficiario no encontrado.');
        } else {
          setBeneficiary(data?.beneficiary ?? null);
          setHasDelivery(data?.hasDelivery ?? false);
        }
      } catch {
        setError('Error de conexión.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [cedula]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-950 to-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-950 to-gray-900 px-4 py-6">
        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-5 h-5" /> Volver
        </button>
        <div className="bg-red-900/50 border border-red-500 rounded-xl p-6">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 text-xl text-center">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-950 to-gray-900 px-4 py-6">
      <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-5 h-5" /> Volver
      </button>

      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 mb-6">
        <User className="w-12 h-12 text-blue-400 mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-white text-center mb-2">{beneficiary?.fullName ?? ''}</h2>
        <p className="text-gray-400 text-lg text-center font-mono">CC: {beneficiary?.cedula ?? ''}</p>
      </div>

      {hasDelivery ? (
        <div className="bg-red-900/40 border border-red-500/50 rounded-2xl p-6 mb-6">
          <XCircle className="w-14 h-14 text-red-400 mx-auto mb-3" />
          <div className="bg-red-600 text-white font-bold text-xl px-4 py-2 rounded-lg w-full text-center mb-4">
            YA ENTREGADO
          </div>
          <p className="text-red-300 text-center text-lg">
            Entrega no permitida: este adulto mayor ya tiene un mercado registrado en la jornada actual.
          </p>
        </div>
      ) : (
        <div className="bg-green-900/40 border border-green-500/50 rounded-2xl p-6 mb-6">
          <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-3" />
          <div className="bg-green-500 text-white font-bold text-xl px-4 py-2 rounded-lg w-full text-center mb-4">
            PENDIENTE
          </div>
        </div>
      )}

      {!hasDelivery ? (
        <button
          onClick={() => router.push(`/capture?cedula=${beneficiary?.cedula}&beneficiaryId=${beneficiary?.id}&jornadaId=${beneficiary?.jornadaId}&name=${encodeURIComponent(beneficiary?.fullName ?? '')}`)}
          className="w-full py-5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95"
        >
          <Camera className="w-7 h-7" />
          Tomar fotografía
        </button>
      ) : (
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold transition-all active:scale-95"
        >
          Buscar otro beneficiario
        </button>
      )}
    </div>
  );
}
