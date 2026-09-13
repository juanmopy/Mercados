'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, ShieldAlert } from 'lucide-react';

export function OperatorLogin() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (code.length !== 4) {
      setError('Ingrese un código de 4 dígitos');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/operator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Error al iniciar sesión');
        setCode('');
        return;
      }
      router.push('/dashboard');
    } catch {
      setError('No fue posible conectar con el servidor. Revise la conexión.');
    } finally {
      setLoading(false);
    }
  };

  const handleDigit = (d: string) => {
    if (code.length < 4) {
      const newCode = code + d;
      setCode(newCode);
      setError('');
    }
  };

  const handleDelete = () => {
    setCode(code.slice(0, -1));
    setError('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-blue-950 to-gray-900">
      <div className="flex items-center gap-3 mb-8">
        <Package className="w-10 h-10 text-green-400" />
        <h1 className="text-3xl font-bold text-white font-display tracking-tight">Mercados</h1>
      </div>
      <p className="text-gray-300 text-lg mb-8 text-center">Paz de Ariporo, Casanare</p>

      <div className="flex gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-16 h-20 rounded-xl border-4 flex items-center justify-center text-4xl font-mono font-bold transition-all ${
              i < code.length
                ? 'border-green-400 bg-green-400/10 text-green-400'
                : 'border-gray-600 bg-gray-800 text-gray-500'
            }`}
          >
            {code[i] ? '•' : ''}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-900/50 border border-red-500 rounded-lg px-4 py-3 mb-4 max-w-sm w-full">
          <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 max-w-xs w-full mb-6">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => {
          if (key === '') return <div key="empty" />;
          if (key === 'del') {
            return (
              <button
                key="del"
                onClick={handleDelete}
                className="h-16 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xl font-bold transition-all active:scale-95"
              >
                ←
              </button>
            );
          }
          return (
            <button
              key={key}
              onClick={() => handleDigit(key)}
              className="h-16 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-2xl font-bold transition-all active:scale-95 border border-gray-700"
            >
              {key}
            </button>
          );
        })}
      </div>

      <button
        onClick={handleSubmit}
        disabled={code.length !== 4 || loading}
        className="w-full max-w-xs py-4 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xl font-bold transition-all active:scale-95"
      >
        {loading ? 'Ingresando...' : 'Ingresar'}
      </button>

      <a href="/admin" className="mt-8 text-gray-500 text-sm hover:text-gray-400 transition-colors">
        Acceso administrador
      </a>
    </div>
  );
}
