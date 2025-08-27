export function excelSerialToDate(serial: number): Date {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30)); 
  const msPerDay = 24 * 60 * 60 * 1000;
  return new Date(excelEpoch.getTime() + Math.round(serial) * msPerDay);
}

export function parseMaybeDate(value: any): Date | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (value > 10000 && value < 60000) {
      return excelSerialToDate(value);
    }
    if (value > 1e12) {
      return new Date(value); 
    }
    if (value > 1e9) {
      return new Date(value * 1000); 
    }

    return excelSerialToDate(value);
  }

  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  if (value instanceof Date) return value;
  return null;
}

export function formatDateToString(d: Date | null, iso = false) {
  if (!d) return "";
  if (iso) return d.toISOString().slice(0, 10); 
  return d.toLocaleDateString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit" }); 
}


export function excelSerialToIso(serial: number): string {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const msPerDay = 24 * 60 * 60 * 1000;
  const d = new Date(excelEpoch.getTime() + Math.round(serial) * msPerDay);
  return d.toISOString().slice(0, 10); // '2025-08-26'
}