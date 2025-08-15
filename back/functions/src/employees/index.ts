import express from "express";
import cors from "cors";
import { onRequest } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!admin.apps.length) admin.initializeApp();
const db = getFirestore();


const ORIGIN = process.env.WEB_URL || 'http://localhost:3000'

const app = express()
app.use(
  cors({
    origin: ORIGIN,
  })
)

app.use(express.json());

/**
 * Utilities for salary calculations
 *
 * Rules used:
 * - If `daysToPay` is provided and > 0 => salaryDaily = salaryMonthly / daysToPay
 * - Else:
 *    weeksPerYear = 52
 *    monthsPerYear = 12
 *    weeksPerMonth ≈ 52 / 12 = 4.3333333
 *    workingDaysPerMonth = daysPerWeek * weeksPerMonth
 *    salaryDaily = salaryMonthly / workingDaysPerMonth
 * - salaryHourly = salaryDaily / hoursPerDay (if hoursPerDay > 0)
 *
 * Defaults: daysPerWeek = 5, hoursPerDay = 8
 */
const WEEKS_PER_MONTH = 52 / 12; // ≈ 4.3333333

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function computeSalaryFields({
  salaryMonthly,
  daysPerWeek,
  hoursPerDay,
  daysToPay,
}: {
  salaryMonthly: number;
  daysPerWeek?: number | null;
  hoursPerDay?: number | null;
  daysToPay?: number | null;
}) {
  const monthly = Number(salaryMonthly ?? 0);
  const dPerWeek = Number(daysPerWeek ?? 5) || 5;
  const hPerDay = Number(hoursPerDay ?? 8) || 8;
  const dToPay = daysToPay != null ? Number(daysToPay) : null;

  let salaryDaily = 0;
  if (dToPay && dToPay > 0) {
    salaryDaily = monthly / dToPay;
  } else {
    const workingDaysPerMonth = dPerWeek * WEEKS_PER_MONTH;
    // avoid division by zero
    salaryDaily = workingDaysPerMonth > 0 ? monthly / workingDaysPerMonth : 0;
  }

  const salaryHourly = hPerDay > 0 ? salaryDaily / hPerDay : 0;

  return {
    salaryMonthly: round2(monthly),
    salaryDaily: round2(salaryDaily),
    salaryHourly: round2(salaryHourly),
    daysPerWeek: dPerWeek,
    hoursPerDay: hPerDay,
    daysToPay: dToPay,
  };
}

/* -------------------
   Handlers
   ------------------- */

const get_employees = async (_req: express.Request, res: express.Response) => {
  try {
    const snap = await db.collection("employees").orderBy("name").get();
    const employees = snap.docs.map((doc) => {
      const d = doc.data() as any;
      return {
        id: doc.id,
        name: d.name,
        salaryMonthly: d.salaryMonthly,
        salaryDaily: d.salaryDaily,
        salaryHourly: d.salaryHourly,
        daysPerWeek: d.daysPerWeek,
        hoursPerDay: d.hoursPerDay,
        daysToPay: d.daysToPay,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        ...d.extra,
      };
    });
    return res.json(employees);
  } catch (err: any) {
    console.error("Error listando employees:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
};

const get_employee = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const docRef = db.collection("employees").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Empleado no encontrado." });
    const d = snap.data() as any;
    return res.json({
      id: snap.id,
      name: d.name,
      salaryMonthly: d.salaryMonthly,
      salaryDaily: d.salaryDaily,
      salaryHourly: d.salaryHourly,
      daysPerWeek: d.daysPerWeek,
      hoursPerDay: d.hoursPerDay,
      daysToPay: d.daysToPay,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      ...d.extra,
    });
  } catch (err: any) {
    console.error(`Error obteniendo employee ${req.params.id}:`, err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
};

/**
 * POST /
 * Body: {
 *   name: string,
 *   salaryMonthly: number,
 *   daysPerWeek?: number,
 *   hoursPerDay?: number,
 *   daysToPay?: number,
 *   extra?: object (otros campos opcionales)
 * }
 */
const create_employee = async (req: express.Request, res: express.Response) => {
  try {
    const {
      name,
      salaryMonthly,
      daysPerWeek,
      hoursPerDay,
      daysToPay,
      extra,
    } = req.body as any;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "El campo 'name' es obligatorio y debe ser string." });
    }
    if (salaryMonthly == null || isNaN(Number(salaryMonthly))) {
      return res.status(400).json({ error: "salaryMonthly es obligatorio y debe ser numérico." });
    }

    const computed = computeSalaryFields({
      salaryMonthly: Number(salaryMonthly),
      daysPerWeek,
      hoursPerDay,
      daysToPay,
    });

    const docRef = db.collection("employees").doc(); // id auto-generated
    await docRef.set({
      name,
      salaryMonthly: computed.salaryMonthly,
      salaryDaily: computed.salaryDaily,
      salaryHourly: computed.salaryHourly,
      daysPerWeek: computed.daysPerWeek,
      hoursPerDay: computed.hoursPerDay,
      daysToPay: computed.daysToPay,
      extra: extra || {},
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const created = await docRef.get();
    return res.status(201).json({ id: created.id, ...(created.data() || {}) });
  } catch (err: any) {
    console.error("Error creando employee:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
};

/**
 * PUT /:id
 * Body: partial update. Si cambia salaryMonthly/daysPerWeek/hoursPerDay/daysToPay
 * -> recalculamos salaryDaily y salaryHourly.
 */
const update_employee = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body } as any;

    const docRef = db.collection("employees").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Empleado no encontrado." });

    // Recuperamos los valores actuales para la recalculación si es necesario
    const current = snap.data() as any;

    // Si vienen campos que afectan al cálculo, preparamos los valores para compute
    const salaryMonthlyNew =
      updates.salaryMonthly != null ? Number(updates.salaryMonthly) : current.salaryMonthly;
    const daysPerWeekNew =
      updates.daysPerWeek != null ? Number(updates.daysPerWeek) : current.daysPerWeek;
    const hoursPerDayNew =
      updates.hoursPerDay != null ? Number(updates.hoursPerDay) : current.hoursPerDay;
    const daysToPayNew =
      updates.daysToPay != null ? Number(updates.daysToPay) : current.daysToPay;

    // Validaciones básicas si se envía salaryMonthly
    if (updates.salaryMonthly != null && isNaN(salaryMonthlyNew)) {
      return res.status(400).json({ error: "salaryMonthly debe ser un número válido." });
    }

    const computed = computeSalaryFields({
      salaryMonthly: salaryMonthlyNew,
      daysPerWeek: daysPerWeekNew,
      hoursPerDay: hoursPerDayNew,
      daysToPay: daysToPayNew,
    });

    // Merge updates con los campos calculados
    const finalUpdates: any = {
      ...updates,
      salaryMonthly: computed.salaryMonthly,
      salaryDaily: computed.salaryDaily,
      salaryHourly: computed.salaryHourly,
      daysPerWeek: computed.daysPerWeek,
      hoursPerDay: computed.hoursPerDay,
      daysToPay: computed.daysToPay,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await docRef.update(finalUpdates);
    const updatedSnap = await docRef.get();
    return res.json({ id: updatedSnap.id, ...(updatedSnap.data() || {}) });
  } catch (err: any) {
    console.error(`Error actualizando employee ${req.params.id}:`, err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
};

const delete_employee = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const docRef = db.collection("employees").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Empleado no encontrado." });

    await docRef.delete();
    return res.json({ message: `Empleado ${id} eliminado.` });
  } catch (err: any) {
    console.error(`Error eliminando employee ${req.params.id}:`, err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
};

// --- (aquí van tus handlers GET/POST/PUT/DELETE de employees ya existentes) ---
// get_employees, get_employee, create_employee, update_employee, delete_employee
// ... (omitidos por brevedad, ya los tienes)

/**
 * EVENTS: subcolección employees/{id}/events
 *
 * Event document:
 *  - type: 'extra_day' | 'overtime' | 'resignation'
 *  - date: string (ISO yyyy-mm-dd)
 *  - hours?: number (para overtime)
 *  - multiplier?: number (opcional, default 1.5)
 *  - amount: number  (monto calculado)
 *  - note?: string
 *  - createdAt
 */

// Helper: calcular amount según tipo
function computeEventAmount(params: {
  type: string;
  salaryDaily: number;
  salaryHourly: number;
  hours?: number;
  multiplier?: number;
}) {
  const { type, salaryDaily, salaryHourly, hours = 0, multiplier = 1.5 } = params;
  if (type === "extra_day") {
    return Number((salaryDaily || 0).toFixed(2));
  }
  if (type === "overtime") {
    // horas * hourly * multiplier
    return Number(((salaryHourly || 0) * hours * multiplier).toFixed(2));
  }
  // resignation u otros tipos no pagan extra por defecto
  return 0;
}

/**
 * POST /:id/events
 * Body: { type, date (YYYY-MM-DD), hours?, multiplier?, note? }
 */
const create_event = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { type, date, hours, multiplier, note } = req.body as any;

    if (!type || !date) {
      return res.status(400).json({ error: "type y date son obligatorios." });
    }
    if (!["extra_day", "overtime", "resignation"].includes(type)) {
      return res.status(400).json({ error: "type inválido." });
    }

    // obtener empleado
    const empRef = db.collection("employees").doc(id);
    const empSnap = await empRef.get();
    if (!empSnap.exists) return res.status(404).json({ error: "Empleado no encontrado." });

    const emp = empSnap.data() as any;
    const salaryDaily = Number(emp.salaryDaily || 0);
    const salaryHourly = Number(emp.salaryHourly || (emp.salaryDaily && emp.hoursPerDay ? emp.salaryDaily / emp.hoursPerDay : 0));

    const amount = computeEventAmount({ type, salaryDaily, salaryHourly, hours, multiplier });

    // crear evento en subcolección
    const eventsRef = empRef.collection("events");
    const evRef = eventsRef.doc();
    const eventDoc = {
      type,
      date, // guardar como string ISO yyyy-mm-dd
      hours: hours != null ? Number(hours) : null,
      multiplier: multiplier != null ? Number(multiplier) : null,
      amount,
      note: note || "",
      createdAt: FieldValue.serverTimestamp(),
    };

    await evRef.set(eventDoc);

    // Si es resignation, actualizamos resignationDate en doc del empleado
    if (type === "resignation") {
      // guardamos la fecha tal cual (string) y updatedAt
      await empRef.update({
        resignationDate: date,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // devolver el evento creado (lee para obtener createdAt como timestamp si quieres)
    const created = await evRef.get();
    return res.status(201).json({ id: created.id, ...(created.data() || {}) });
  } catch (err: any) {
    console.error("Error creando event:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
};

/**
 * GET /:id/events
 * Query params opcionales: start (YYYY-MM-DD), end (YYYY-MM-DD)
 * Lista eventos de un empleado (filtra por rango si se pasa)
 */
const list_events = async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { start, end } = req.query as any;

    const empRef = db.collection("employees").doc(id);
    const empSnap = await empRef.get();
    if (!empSnap.exists) return res.status(404).json({ error: "Empleado no encontrado." });

    let q = empRef.collection("events").orderBy("date", "desc") as any;
    if (start) q = q.where("date", ">=", start);
    if (end) q = q.where("date", "<=", end);

    const snap = await q.get();
    const events = snap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
    return res.json(events);
  } catch (err: any) {
    console.error("Error listando events:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
};

/**
 * DELETE /:id/events/:eventId
 * Si el evento era resignation y coincide con resignationDate, limpia resignationDate en el doc del empleado.
 */
const delete_event = async (req: express.Request, res: express.Response) => {
  try {
    const { id, eventId } = req.params;
    const empRef = db.collection("employees").doc(id);
    const evRef = empRef.collection("events").doc(eventId);

    const evSnap = await evRef.get();
    if (!evSnap.exists) return res.status(404).json({ error: "Evento no encontrado." });

    const evData = evSnap.data() as any;

    await evRef.delete();

    if (evData.type === "resignation" && evData.date) {
      const empSnap = await empRef.get();
      if (empSnap.exists) {
        const empData = empSnap.data() as any;
        // si resignationDate coincide con la fecha del evento borrado, la limpiamos
        if (empData.resignationDate === evData.date) {
          await empRef.update({ resignationDate: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
        }
      }
    }

    return res.json({ message: "Evento eliminado." });
  } catch (err: any) {
    console.error("Error eliminando event:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
};

// Montar rutas en el app (añádelo donde defines las rutas de employees)
app.post("/:id/events", create_event);
app.get("/:id/events", list_events);
app.delete("/:id/events/:eventId", delete_event);


/* ---------- RUTAS expuestas (la función se llamará `employees`) ---------- */
app.get("/", get_employees);
app.get("/:id", get_employee);
app.post("/", create_employee);
app.put("/:id", update_employee);
app.delete("/:id", delete_employee);

export const employees = onRequest(app);
