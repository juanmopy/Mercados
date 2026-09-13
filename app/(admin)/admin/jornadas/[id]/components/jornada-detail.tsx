'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, Play, Square, RotateCcw, FileText, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export function JornadaDetail({ jornadaId }: Readonly<{ jornadaId: string }>) {
  const router = useRouter();
  const [jornada, setJornada] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingZip, setGeneratingZip] = useState(false);
  const [operators, setOperators] = useState<any[]>([]);
  const [pdfOperatorId, setPdfOperatorId] = useState('');
  const [pdfFromDate, setPdfFromDate] = useState('');
  const [pdfToDate, setPdfToDate] = useState('');
  const [pdfCedulaFrom, setPdfCedulaFrom] = useState('');
  const [pdfCedulaTo, setPdfCedulaTo] = useState('');
  const [pdfCedulas, setPdfCedulas] = useState('');
  const [pdfOrder, setPdfOrder] = useState('time');

  const loadJornada = useCallback(async () => {
    try {
      const res = await fetch(`/api/jornadas/${jornadaId}`);
      if (!res.ok) { router.push('/admin/jornadas'); return; }
      const data = await res.json();
      setJornada(data);
    } catch { router.push('/admin/jornadas'); }
    finally { setLoading(false); }
  }, [jornadaId, router]);

  useEffect(() => {
    loadJornada();
    fetch('/api/operators').then((res) => res.ok ? res.json() : []).then(setOperators).catch(() => setOperators([]));
  }, [loadJornada]);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', 'preview');
      const res = await fetch(`/api/jornadas/${jornadaId}/import-excel`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Error'); return; }
      setPreview(data);
    } catch { toast.error('Error procesando archivo'); }
    finally { setUploading(false); }
  };

  const confirmImport = async () => {
    setImporting(true);
    try {
      const fileInput = document.querySelector<HTMLInputElement>('#excel-upload');
      const file = fileInput?.files?.[0];
      if (!file) { toast.error('Seleccione un archivo'); return; }
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', 'import');
      const res = await fetch(`/api/jornadas/${jornadaId}/import-excel`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Error en la importación'); return; }
      toast.success(`${data?.imported ?? 0} beneficiarios importados exitosamente`);
      setPreview(null);
      loadJornada();
    } catch { toast.error('Error importando'); }
    finally { setImporting(false); }
  };

  const handleAction = async (action: string) => {
    if (!confirm(`¿Está seguro de ${action} esta jornada?`)) return;
    try {
      const res = await fetch(`/api/jornadas/${jornadaId}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? 'Error'); return; }
      toast.success('Acción completada');
      loadJornada();
    } catch { toast.error('Error de conexión'); }
  };

  const handlePdf = async () => {
    setGeneratingPdf(true);
    try {
      const params = new URLSearchParams({ jornadaId, order: pdfOrder });
      if (pdfOperatorId) params.set('operatorId', pdfOperatorId);
      if (pdfFromDate) params.set('fromDate', pdfFromDate);
      if (pdfToDate) params.set('toDate', pdfToDate);
      if (pdfCedulaFrom) params.set('cedulaFrom', pdfCedulaFrom);
      if (pdfCedulaTo) params.set('cedulaTo', pdfCedulaTo);
      if (pdfCedulas.trim()) params.set('cedulas', pdfCedulas);
      const res = await fetch(`/api/reports/pdf?${params.toString()}`);
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Error generando PDF'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `jornada_${jornadaId}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF descargado');
    } catch { toast.error('Error generando PDF'); }
    finally { setGeneratingPdf(false); }
  };

  const handleZip = async () => {
    setGeneratingZip(true);
    try {
      const res = await fetch(`/api/reports/zip?jornadaId=${jornadaId}`);
      if (!res.ok) { const d = await res.json(); toast.error(d?.error ?? 'Error generando ZIP'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `fotos_jornada_${jornadaId}.zip`; a.click();
      URL.revokeObjectURL(url);
      toast.success('ZIP descargado');
    } catch { toast.error('Error generando ZIP'); }
    finally { setGeneratingZip(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>;

  const statusColors: Record<string, string> = {
    CONFIGURADA: 'bg-yellow-100 text-yellow-800',
    ACTIVA: 'bg-green-100 text-green-800',
    REABIERTA: 'bg-blue-100 text-blue-800',
    CERRADA: 'bg-gray-200 text-gray-800',
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-2">
          <button onClick={() => router.push('/admin/jornadas')} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
          <span className="font-bold text-foreground">{jornada?.description ?? 'Jornada'}</span>
          <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${statusColors[jornada?.status ?? ''] ?? ''}`}>{jornada?.status}</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Info */}
        <div className="bg-card rounded-xl p-6" style={{ boxShadow: 'var(--shadow-md)' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-muted-foreground text-sm">Fecha oficial</p><p className="font-bold text-foreground">{jornada?.officialDate ? new Date(jornada.officialDate).toLocaleDateString('es-CO') : ''}</p></div>
            <div><p className="text-muted-foreground text-sm">Beneficiarios</p><p className="font-bold text-foreground text-xl">{jornada?._count?.beneficiaries ?? 0}</p></div>
            <div><p className="text-muted-foreground text-sm">Entregas</p><p className="font-bold text-foreground text-xl">{jornada?._count?.deliveries ?? 0}</p></div>
            <div><p className="text-muted-foreground text-sm">Creada por</p><p className="font-bold text-foreground">{jornada?.admin?.name ?? ''}</p></div>
          </div>
        </div>

        {jornada?.status === 'CERRADA' && (
          <div className="bg-card rounded-xl p-6 space-y-4" style={{ boxShadow: 'var(--shadow-md)' }}>
            <h3 className="font-bold text-foreground flex items-center gap-2"><FileText className="w-5 h-5" /> Filtros del PDF</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block text-sm text-muted-foreground"><span>Operador</span>
                <select value={pdfOperatorId} onChange={(e) => setPdfOperatorId(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground">
                  <option value="">Todos los operadores</option>
                  {operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.name}</option>)}
                </select>
              </label>
              <label className="block text-sm text-muted-foreground"><span>Orden</span>
                <select value={pdfOrder} onChange={(e) => setPdfOrder(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground">
                  <option value="time">Hora de entrega</option>
                  <option value="cedula">Cédula</option>
                </select>
              </label>
              <label className="block text-sm text-muted-foreground"><span>Desde fecha</span>
                <input type="date" value={pdfFromDate} onChange={(e) => setPdfFromDate(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground" />
              </label>
              <label className="block text-sm text-muted-foreground"><span>Hasta fecha</span>
                <input type="date" value={pdfToDate} onChange={(e) => setPdfToDate(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground" />
              </label>
              <label className="block text-sm text-muted-foreground"><span>Cédula desde</span>
                <input value={pdfCedulaFrom} onChange={(e) => setPdfCedulaFrom(e.target.value)} inputMode="numeric" className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground" />
              </label>
              <label className="block text-sm text-muted-foreground"><span>Cédula hasta</span>
                <input value={pdfCedulaTo} onChange={(e) => setPdfCedulaTo(e.target.value)} inputMode="numeric" className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground" />
              </label>
            </div>
            <label className="block text-sm text-muted-foreground"><span>Cédulas específicas, separadas por coma</span>
              <input value={pdfCedulas} onChange={(e) => setPdfCedulas(e.target.value)} placeholder="123456789, 987654321" className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground" />
            </label>
            <p className="text-xs text-muted-foreground">El PDF solo incluye entregas cuya fotografía esté disponible.</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {jornada?.status === 'CONFIGURADA' && <button onClick={() => handleAction('activate')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white font-bold text-sm hover:bg-green-700"><Play className="w-4 h-4" /> Activar jornada</button>}
          {(jornada?.status === 'ACTIVA' || jornada?.status === 'REABIERTA') && (
            <button onClick={() => handleAction('close')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white font-bold text-sm hover:bg-orange-700"><Square className="w-4 h-4" /> Cerrar jornada</button>
          )}
          {jornada?.status === 'CERRADA' && (
            <>
              <button onClick={() => handleAction('reopen')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-bold text-sm hover:bg-blue-700"><RotateCcw className="w-4 h-4" /> Reabrir</button>
              <button onClick={handlePdf} disabled={generatingPdf} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 disabled:opacity-50">
                <FileText className="w-4 h-4" /> {generatingPdf ? 'Generando...' : 'Descargar PDF'}
              </button>
              <button onClick={handleZip} disabled={generatingZip} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 disabled:opacity-50">
                <Download className="w-4 h-4" /> {generatingZip ? 'Generando...' : 'Descargar ZIP'}
              </button>
            </>
          )}
        </div>

        {/* Excel import (only for CONFIGURADA) */}
        {jornada?.status === 'CONFIGURADA' && (
          <div className="bg-card rounded-xl p-6" style={{ boxShadow: 'var(--shadow-md)' }}>
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><Upload className="w-5 h-5" /> Importar beneficiarios desde Excel</h3>
            <p className="text-muted-foreground text-sm mb-4">El archivo debe tener dos columnas: Nombre Completo y Cédula</p>
            <input id="excel-upload" type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" />

            {uploading && <p className="text-muted-foreground mt-3">Procesando archivo...</p>}

            {preview && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-foreground font-bold">{preview?.totalValid ?? 0} beneficiarios válidos</span>
                </div>
                {(preview?.totalErrors ?? 0) > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-destructive font-bold">{preview?.totalErrors ?? 0} registros con errores</span>
                  </div>
                )}
                {(preview?.duplicates?.length ?? 0) > 0 && (
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <p className="text-yellow-800 font-bold text-sm">Cédulas duplicadas en el archivo:</p>
                    {(preview?.duplicates ?? []).map((d: any) => (
                      <p key={d?.cedula} className="text-yellow-700 text-sm">CC {d?.cedula} (filas {(d?.rows ?? []).join(', ')})</p>
                    ))}
                  </div>
                )}

                {(preview?.totalErrors ?? 0) === 0 && (
                  <button onClick={confirmImport} disabled={importing} className="px-4 py-2 rounded-lg bg-green-600 text-white font-bold text-sm hover:bg-green-700 disabled:opacity-50">
                    {importing ? 'Importando...' : `Confirmar importación de ${preview?.totalValid ?? 0} beneficiarios`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
