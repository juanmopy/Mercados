import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { es } from 'date-fns/locale';

export const BOGOTA_TZ = 'America/Bogota';

export function nowBogota(): Date {
  return toZonedTime(new Date(), BOGOTA_TZ);
}

export function formatBogota(date: Date | string, fmt: string = 'yyyy-MM-dd HH:mm:ss'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(d, BOGOTA_TZ, fmt, { locale: es });
}

export function formatBogotaShort(date: Date | string): string {
  return formatBogota(date, 'dd/MM/yyyy HH:mm');
}

export function formatBogotaDate(date: Date | string): string {
  return formatBogota(date, 'dd/MM/yyyy');
}

export function serverTimestamp(): Date {
  return new Date();
}

export function isJornadaDeliveryAllowed(
  jornada: { officialDate: Date | string; allowEarly: boolean; allowLate: boolean },
  now: Date = new Date(),
): boolean {
  const currentDate = formatBogota(now, 'yyyy-MM-dd');
  const officialDate = formatBogota(jornada.officialDate, 'yyyy-MM-dd');

  if (currentDate === officialDate) return true;
  if (currentDate < officialDate) return jornada.allowEarly;
  return jornada.allowLate;
}
