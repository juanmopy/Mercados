import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Supabase no configurado: faltan SUPABASE_URL o SUPABASE_SERVICE_KEY');
  }
  supabaseInstance = createClient(url, key, {
    auth: { persistSession: false },
  });
  return supabaseInstance;
}

export async function uploadPhoto(bucket: string, path: string, file: Buffer, contentType: string = 'image/jpeg'): Promise<string> {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Error subiendo foto: ${error.message}`);
  return path;
}

export async function getSignedUrl(bucket: string, path: string, expiresIn: number = 3600): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) throw new Error(`Error generando URL firmada: ${error?.message}`);
  return data.signedUrl;
}

export async function deleteStorageFile(bucket: string, path: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(`Error eliminando archivo: ${error.message}`);
}

export async function downloadFile(bucket: string, path: string): Promise<Buffer> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Error descargando archivo: ${error?.message}`);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function moveFile(bucket: string, fromPath: string, toPath: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(bucket).move(fromPath, toPath);
  if (error) throw new Error(`Error moviendo archivo: ${error.message}`);
}

export async function uploadBackup(path: string, data: string): Promise<string> {
  const supabase = getSupabase();
  const buffer = Buffer.from(data, 'utf-8');
  const { error } = await supabase.storage.from('backups').upload(path, buffer, {
    contentType: 'application/json',
    upsert: false,
  });
  if (error) throw new Error(`Error subiendo backup: ${error.message}`);
  return path;
}
