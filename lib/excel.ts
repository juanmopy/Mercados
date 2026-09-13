import * as XLSX from 'xlsx';

export interface ExcelBeneficiary {
  fullName: string;
  cedula: string;
}

export interface ExcelValidationResult {
  valid: ExcelBeneficiary[];
  errors: { row: number; name: string; cedula: string; reason: string }[];
  duplicates: { cedula: string; rows: number[] }[];
}

export function normalizeCedula(raw: string | number | null | undefined): string {
  if (raw == null) return '';
  return String(raw).replace(/[^0-9]/g, '').trim();
}

export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return '';
  return String(raw).trim().replace(/\s+/g, ' ');
}

export function parseExcelFile(buffer: Buffer): ExcelValidationResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) {
    return { valid: [], errors: [{ row: 0, name: '', cedula: '', reason: 'El archivo no contiene hojas' }], duplicates: [] };
  }
  const sheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rows.length < 2) {
    return { valid: [], errors: [{ row: 0, name: '', cedula: '', reason: 'El archivo no contiene datos (se esperan encabezados + filas)' }], duplicates: [] };
  }

  const valid: ExcelBeneficiary[] = [];
  const errors: { row: number; name: string; cedula: string; reason: string }[] = [];
  const cedulaMap = new Map<string, number[]>();

  // Skip header row (row 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rawName = row[0];
    const rawCedula = row[1];
    const fullName = normalizeName(rawName);
    const cedula = normalizeCedula(rawCedula);
    const rowNum = i + 1; // 1-based for user display

    if (!fullName && !cedula) continue; // skip empty rows

    if (!fullName) {
      errors.push({ row: rowNum, name: fullName, cedula, reason: 'Nombre vacío' });
      continue;
    }
    if (!cedula) {
      errors.push({ row: rowNum, name: fullName, cedula, reason: 'Cédula vacía' });
      continue;
    }
    if (cedula.length < 5 || cedula.length > 12) {
      errors.push({ row: rowNum, name: fullName, cedula, reason: 'Cédula con longitud inválida' });
      continue;
    }

    const existing = cedulaMap.get(cedula);
    if (existing) {
      existing.push(rowNum);
    } else {
      cedulaMap.set(cedula, [rowNum]);
    }

    valid.push({ fullName, cedula });
  }

  const duplicates: { cedula: string; rows: number[] }[] = [];
  cedulaMap.forEach((rowNums, ced) => {
    if (rowNums.length > 1) {
      duplicates.push({ cedula: ced, rows: rowNums });
    }
  });

  // Remove duplicates from valid (keep first occurrence)
  const seen = new Set<string>();
  const deduplicated: ExcelBeneficiary[] = [];
  for (const b of valid) {
    if (!seen.has(b.cedula)) {
      seen.add(b.cedula);
      deduplicated.push(b);
    }
  }

  return { valid: deduplicated, errors, duplicates };
}
