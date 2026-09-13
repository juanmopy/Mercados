'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera, RotateCcw, CheckCircle, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export function CaptureView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cedula = searchParams?.get('cedula') ?? '';
  const beneficiaryId = searchParams?.get('beneficiaryId') ?? '';
  const jornadaId = searchParams?.get('jornadaId') ?? '';
  const beneficiaryName = searchParams?.get('name') ?? '';

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<'camera' | 'preview' | 'uploading' | 'success' | 'error'>('camera');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [cameraError, setCameraError] = useState('');

  const startCamera = useCallback(async () => {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError('No fue posible acceder a la cámara. Verifique permisos del navegador e intente nuevamente.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks?.()?.forEach?.((t: any) => t?.stop?.());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (phase === 'camera') startCamera();
    return () => stopCamera();
  }, [phase, startCamera, stopCamera]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          setCapturedUrl(URL.createObjectURL(blob));
          setPhase('preview');
          stopCamera();
        }
      },
      'image/jpeg',
      0.75
    );
  }, [stopCamera]);

  const retake = useCallback(() => {
    setCapturedBlob(null);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl('');
    setPhase('camera');
  }, [capturedUrl]);

  const confirmAndUpload = useCallback(async () => {
    if (!capturedBlob) return;
    setPhase('uploading');
    setUploadProgress(10);

    try {
      // 1. Upload photo
      const formData = new FormData();
      formData.append('photo', capturedBlob, 'photo.jpg');
      formData.append('deviceTimestamp', new Date().toISOString());

      setUploadProgress(30);
      const uploadRes = await fetch('/api/photos/upload', { method: 'POST', body: formData });
      if (!uploadRes.ok) {
        const d = await uploadRes.json().catch(() => ({}));
        throw new Error((d as any)?.error ?? 'Error subiendo foto');
      }
      const uploadData = await uploadRes.json();
      setUploadProgress(60);

      // 2. Create delivery
      const deliveryRes = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beneficiaryCedula: cedula,
          jornadaId: uploadData?.jornadaId ?? jornadaId,
          photoPath: uploadData?.photoPath ?? '',
          deviceTimestamp: uploadData?.uploadedAt ?? new Date().toISOString(),
        }),
      });
      setUploadProgress(90);

      if (!deliveryRes.ok) {
        const d = await deliveryRes.json().catch(() => ({}));
        throw new Error((d as any)?.error ?? 'Error registrando entrega');
      }

      setUploadProgress(100);
      setPhase('success');
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'No fue posible registrar la entrega. Revise la conexión e intente nuevamente. La información no se guardó.');
      setPhase('error');
    }
  }, [capturedBlob, cedula, jornadaId]);

  // Camera error
  if (cameraError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-950 to-gray-900 px-4 py-6 flex flex-col items-center justify-center">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <p className="text-red-300 text-xl text-center mb-6">{cameraError}</p>
        <button onClick={() => router.push('/dashboard')} className="py-3 px-6 rounded-xl bg-blue-600 text-white text-lg font-bold">
          Volver al inicio
        </button>
      </div>
    );
  }

  // Success
  if (phase === 'success') {
    return (
      <div className="min-h-screen bg-green-900 flex flex-col items-center justify-center px-4">
        <CheckCircle className="w-20 h-20 text-green-300 mb-6" />
        <h2 className="text-3xl font-bold text-white text-center mb-4">
          Entrega registrada correctamente
        </h2>
        <p className="text-green-200 text-xl text-center mb-8">
          para {decodeURIComponent(beneficiaryName)}
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full max-w-sm py-4 rounded-xl bg-white text-green-900 text-xl font-bold transition-all active:scale-95"
        >
          Registrar otra entrega
        </button>
      </div>
    );
  }

  // Error
  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-950 to-gray-900 px-4 py-6 flex flex-col items-center justify-center">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <p className="text-red-300 text-xl text-center mb-6">{errorMsg}</p>
        <button onClick={retake} className="w-full max-w-sm py-4 rounded-xl bg-blue-600 text-white text-xl font-bold mb-3">
          Intentar nuevamente
        </button>
        <button onClick={() => router.push('/dashboard')} className="w-full max-w-sm py-3 rounded-xl bg-gray-700 text-white text-lg font-bold">
          Volver al inicio
        </button>
      </div>
    );
  }

  // Uploading
  if (phase === 'uploading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-950 to-gray-900 px-4 py-6 flex flex-col items-center justify-center">
        <Loader2 className="w-16 h-16 text-blue-400 animate-spin mb-6" />
        <p className="text-white text-xl mb-4">Registrando entrega...</p>
        <div className="w-full max-w-sm bg-gray-800 rounded-full h-4 overflow-hidden">
          <div
            className="bg-blue-500 h-full transition-all duration-500 rounded-full"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
        <p className="text-gray-400 mt-2">{uploadProgress}%</p>
      </div>
    );
  }

  // Preview
  if (phase === 'preview') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-950 to-gray-900 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          {capturedUrl && (
            <img src={capturedUrl} alt="Foto capturada" className="max-w-full max-h-[60vh] rounded-xl" />
          )}
        </div>
        <div className="p-4 space-y-3">
          <p className="text-gray-300 text-center text-lg mb-2">
            {decodeURIComponent(beneficiaryName)} - CC: {cedula}
          </p>
          <button
            onClick={confirmAndUpload}
            className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <CheckCircle className="w-6 h-6" />
            Confirmar y registrar entrega
          </button>
          <button
            onClick={retake}
            className="w-full py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-lg font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <RotateCcw className="w-5 h-5" />
            Repetir foto
          </button>
        </div>
      </div>
    );
  }

  // Camera view
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 bg-black/80">
        <button onClick={() => router.back()} className="text-white flex items-center gap-1">
          <ArrowLeft className="w-5 h-5" /> Volver
        </button>
        <p className="text-gray-300 text-sm">CC: {cedula}</p>
      </div>
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-4 bg-black/80">
        <button
          onClick={capturePhoto}
          className="w-full py-5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95"
        >
          <Camera className="w-7 h-7" />
          Capturar foto
        </button>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
