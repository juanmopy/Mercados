'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  Loader2,
  RefreshCcw,
  Search,
  SwitchCamera,
} from 'lucide-react';

type ScannerPhase = 'camera' | 'processing' | 'result';

const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: { ideal: 'environment' },
  width: { ideal: 1920 },
  height: { ideal: 1080 },
};

function cameraErrorMessage(error: unknown): string {
  if (!window.isSecureContext) {
    return 'La cámara requiere HTTPS. Abra la aplicación desde una dirección segura.';
  }

  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'El permiso de cámara está bloqueado. Habilítelo en la configuración del navegador.';
    }
    if (error.name === 'NotFoundError') {
      return 'No se encontró una cámara disponible en este dispositivo.';
    }
    if (error.name === 'NotReadableError') {
      return 'Otra aplicación está utilizando la cámara. Ciérrela e intente nuevamente.';
    }
  }

  return 'No fue posible abrir la cámara posterior. Puede ingresar la cédula manualmente.';
}

function extractCedulaCandidates(text: string): string[] {
  const matches = text.match(/\d(?:[\s.,-]?\d){2,9}/g) ?? [];
  return Array.from(
    new Set(
      matches
        .map((match) => match.replace(/\D/g, ''))
        .filter((value) => value.length >= 3 && value.length <= 10)
    )
  ).sort((a, b) => b.length - a.length);
}

export function ScannerView() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef(0);

  const [phase, setPhase] = useState<ScannerPhase>('camera');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState('');
  const [cedula, setCedula] = useState('');
  const [candidates, setCandidates] = useState<string[]>([]);
  const [cameraError, setCameraError] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [searching, setSearching] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      const requestId = ++requestRef.current;
      stopCamera();
      setCameraError('');

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new DOMException('API de cámara no disponible', 'NotSupportedError');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? {
                deviceId: { exact: deviceId },
                width: CAMERA_CONSTRAINTS.width,
                height: CAMERA_CONSTRAINTS.height,
              }
            : CAMERA_CONSTRAINTS,
          audio: false,
        });

        if (requestRef.current !== requestId) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        setActiveDeviceId(track?.getSettings().deviceId ?? deviceId ?? '');

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const available = await navigator.mediaDevices.enumerateDevices();
        if (requestRef.current === requestId) {
          setDevices(available.filter((item) => item.kind === 'videoinput'));
        }
      } catch (cameraError: unknown) {
        if (requestRef.current === requestId) {
          stopCamera();
          setCameraError(cameraErrorMessage(cameraError));
        }
      }
    },
    [stopCamera]
  );

  useEffect(() => {
    void startCamera();
    return () => {
      requestRef.current += 1;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const switchCamera = useCallback(() => {
    if (devices.length < 2) return;
    const currentIndex = devices.findIndex((device) => device.deviceId === activeDeviceId);
    const nextDevice = devices[(currentIndex + 1 + devices.length) % devices.length];
    if (nextDevice?.deviceId) void startCamera(nextDevice.deviceId);
  }, [activeDeviceId, devices, startCamera]);

  const scanCedula = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setError('Espere a que la cámara termine de cargar.');
      return;
    }

    setError('');
    setProgress(0);
    setPhase('processing');

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const cropWidth = Math.round(sourceWidth * 0.9);
    const cropHeight = Math.round(sourceHeight * 0.42);
    const sourceX = Math.round((sourceWidth - cropWidth) / 2);
    const sourceY = Math.round((sourceHeight - cropHeight) / 2);

    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      setError('No fue posible preparar la imagen para lectura.');
      setPhase('camera');
      return;
    }

    context.drawImage(
      video,
      sourceX,
      sourceY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    const pixels = context.getImageData(0, 0, cropWidth, cropHeight);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const gray =
        pixels.data[index] * 0.299 +
        pixels.data[index + 1] * 0.587 +
        pixels.data[index + 2] * 0.114;
      const contrasted = gray > 145 ? 255 : 0;
      pixels.data[index] = contrasted;
      pixels.data[index + 1] = contrasted;
      pixels.data[index + 2] = contrasted;
    }
    context.putImageData(pixels, 0, 0);

    stopCamera();

    try {
      const { createWorker, PSM } = await import('tesseract.js');
      const worker = await createWorker('eng', undefined, {
        logger: (message) => {
          if (message.status === 'recognizing text') {
            setProgress(Math.round(message.progress * 100));
          }
        },
      });

      try {
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789.- ',
          tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        });
        const result = await worker.recognize(canvas);
        const found = extractCedulaCandidates(result.data.text);
        setCandidates(found);
        setCedula(found[0] ?? '');
        if (!found.length) {
          setError('No se reconoció un número. Puede repetir la foto o escribir la cédula manualmente.');
        }
      } finally {
        await worker.terminate();
      }
    } catch {
      setError('No fue posible completar el OCR. Verifique la conexión o escriba la cédula manualmente.');
    } finally {
      setPhase('result');
    }
  }, [stopCamera]);

  const retry = useCallback(() => {
    setError('');
    setCedula('');
    setCandidates([]);
    setPhase('camera');
    void startCamera(activeDeviceId || undefined);
  }, [activeDeviceId, startCamera]);

  const findBeneficiary = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const cleanCedula = cedula.replace(/\D/g, '');
      if (!cleanCedula) {
        setError('Ingrese un número de cédula.');
        return;
      }

      setSearching(true);
      setError('');
      try {
        const response = await fetch(
          `/api/beneficiaries/search?cedula=${encodeURIComponent(cleanCedula)}`
        );
        const data = await response.json();
        if (response.status === 401) {
          router.push('/');
          return;
        }
        if (!response.ok || !data?.found) {
          setError(data?.message ?? 'Beneficiario no encontrado. Verifique la cédula.');
          return;
        }
        router.push(`/beneficiary/${cleanCedula}`);
      } catch {
        setError('Error de conexión. Intente nuevamente.');
      } finally {
        setSearching(false);
      }
    },
    [cedula, router]
  );

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-5 text-white">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-300"
          >
            <ArrowLeft className="h-5 w-5" /> Volver
          </button>
          <span className="text-sm text-gray-400">Lectura de cédula</span>
        </div>

        {phase === 'camera' && (
          <>
            <div className="relative overflow-hidden rounded-2xl bg-black">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="aspect-[3/4] w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-x-[5%] top-1/2 aspect-[2.15/1] -translate-y-1/2 rounded-xl border-4 border-green-400 shadow-[0_0_0_999px_rgba(0,0,0,0.4)]" />
              <p className="absolute inset-x-4 bottom-4 rounded-lg bg-black/70 p-2 text-center text-sm">
                Ubique el número de la cédula dentro del recuadro
              </p>
            </div>

            {cameraError && (
              <p role="alert" className="rounded-xl bg-red-950 p-3 text-red-200">
                {cameraError}
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-xl bg-amber-950 p-3 text-amber-200">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void scanCedula()}
                disabled={Boolean(cameraError)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 py-4 text-xl font-bold disabled:bg-gray-700"
              >
                <Camera className="h-6 w-6" /> Leer número
              </button>
              {devices.length > 1 && (
                <button
                  type="button"
                  onClick={switchCamera}
                  aria-label="Cambiar cámara"
                  className="rounded-xl bg-blue-600 px-5"
                >
                  <SwitchCamera className="h-7 w-7" />
                </button>
              )}
            </div>

            {cameraError && (
              <button
                type="button"
                onClick={() => setPhase('result')}
                className="w-full rounded-xl bg-gray-700 py-3 font-semibold"
              >
                Ingresar cédula manualmente
              </button>
            )}
          </>
        )}

        {phase === 'processing' && (
          <section className="flex min-h-[65vh] flex-col items-center justify-center text-center">
            <Loader2 className="mb-5 h-16 w-16 animate-spin text-green-400" />
            <h1 className="text-2xl font-bold">Leyendo la cédula...</h1>
            <p className="mt-2 text-gray-300">Primera lectura: puede tardar unos segundos</p>
            <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </section>
        )}

        {phase === 'result' && (
          <form onSubmit={findBeneficiary} className="space-y-5 pt-6">
            <div className="text-center">
              <CheckCircle className="mx-auto mb-3 h-14 w-14 text-green-400" />
              <h1 className="text-2xl font-bold">Confirme el número</h1>
              <p className="mt-2 text-gray-300">Corrija la lectura antes de buscar.</p>
            </div>

            {candidates.length > 1 && (
              <div className="flex flex-wrap justify-center gap-2">
                {candidates.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() => setCedula(candidate)}
                    className="rounded-lg bg-gray-800 px-4 py-2 font-mono text-lg"
                  >
                    {candidate}
                  </button>
                ))}
              </div>
            )}

            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              autoFocus
              value={cedula}
              onChange={(event) => {
                setCedula(event.target.value.replace(/\D/g, ''));
                setError('');
              }}
              placeholder="Número de cédula"
              aria-label="Número de cédula"
              className="w-full rounded-xl border-2 border-gray-600 bg-gray-800 px-4 py-4 text-center font-mono text-3xl tracking-widest outline-none focus:border-blue-400"
            />

            {error && (
              <p role="alert" className="rounded-xl bg-red-950 p-3 text-center text-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={searching || !cedula}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-xl font-bold disabled:bg-gray-700"
            >
              {searching ? <Loader2 className="h-6 w-6 animate-spin" /> : <Search className="h-6 w-6" />}
              {searching ? 'Buscando...' : 'Buscar beneficiario'}
            </button>
            <button
              type="button"
              onClick={retry}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-700 py-3 font-semibold"
            >
              <RefreshCcw className="h-5 w-5" /> Repetir lectura
            </button>
          </form>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </main>
  );
}
