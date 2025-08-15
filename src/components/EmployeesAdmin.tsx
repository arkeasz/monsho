// components/EmployeesAdmin.tsx
"use client";
import React, { useEffect, useState } from "react";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeEvents,
  addEmployeeEvent,
  deleteEmployeeEvent,
} from "@/api/employees";

import { Employee, EmployeeEvent } from "@/types/employees";


type Row = {
  localId: string;
  id?: string;
  name: string;
  salaryMonthly: string;
  salaryDaily?: string;
  salaryHourly?: string;
  daysPerWeek?: string;
  hoursPerDay?: string;
  daysToPay?: string;
  saving?: boolean;
  isNew?: boolean;
};

export default function EmployeesAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Events modal state
  const [eventsOpenFor, setEventsOpenFor] = useState<{ empId: string; name: string } | null>(null);
  const [events, setEvents] = useState<EmployeeEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventForm, setEventForm] = useState<{ type: EmployeeEvent["type"]; date: string; hours?: string; multiplier?: string; note?: string }>({
    type: "extra_day",
    date: new Date().toISOString().slice(0, 10),
    hours: "",
    multiplier: "1.5",
    note: "",
  });

  // Load employees
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const emps = await getEmployees();
      const r: Row[] = emps.map(e => ({
        localId: e.id ?? Math.random().toString(36).slice(2),
        id: e.id,
        name: e.name ?? "",
        salaryMonthly: String(e.salaryMonthly ?? ""),
        salaryDaily: String(e.salaryDaily ?? ""),
        salaryHourly: String(e.salaryHourly ?? ""),
        daysPerWeek: String(e.daysPerWeek ?? 5),
        hoursPerDay: String(e.hoursPerDay ?? 8),
        daysToPay: e.daysToPay != null ? String(e.daysToPay) : "",
        isNew: false,
      }));
      setRows(r);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error cargando empleados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // CRUD handlers
  const handleAddRow = () => {
    const tmp = {
      localId: `new-${Date.now()}`,
      id: undefined,
      name: "",
      salaryMonthly: "",
      salaryDaily: "",
      salaryHourly: "",
      daysPerWeek: "5",
      hoursPerDay: "8",
      daysToPay: "",
      isNew: true,
    };
    setRows(prev => [tmp, ...prev]);
  };

  const handleChange = (localId: string, field: keyof Row, value: string) => {
    setRows(prev => prev.map(r => (r.localId === localId ? { ...r, [field]: value } : r)));
  };

  const handleSave = async (row: Row) => {
    setRows(prev => prev.map(r => (r.localId === row.localId ? { ...r, saving: true } : r)));
    setError(null);
    try {
      const payload: Partial<Employee> = {
        name: row.name,
        salaryMonthly: Number(row.salaryMonthly || 0),
        daysPerWeek: Number(row.daysPerWeek || 5),
        hoursPerDay: Number(row.hoursPerDay || 8),
        daysToPay: row.daysToPay ? Number(row.daysToPay) : undefined,
      };
      if (row.isNew) {
        await createEmployee(payload);
      } else {
        if (!row.id) throw new Error("No id para actualizar");
        await updateEmployee(row.id, payload);
      }
      await load();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error guardando empleado");
      setRows(prev => prev.map(r => (r.localId === row.localId ? { ...r, saving: false } : r)));
    }
  };

  const handleDelete = async (row: Row) => {
    if (!row.id) {
      // quitar local
      setRows(prev => prev.filter(r => r.localId !== row.localId));
      return;
    }
    if (!confirm(`Eliminar empleado ${row.name || row.id}?`)) return;
    try {
      await deleteEmployee(row.id);
      await load();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error eliminando empleado");
    }
  };

  // Events handling
  const openEvents = async (empId?: string, name?: string) => {
    if (!empId) return;
    setEventsOpenFor({ empId, name: name ?? "" });
    setEventsLoading(true);
    try {
      const ev = await getEmployeeEvents(empId);
      setEvents(ev);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error cargando eventos");
    } finally {
      setEventsLoading(false);
    }
  };

  const closeEvents = () => {
    setEventsOpenFor(null);
    setEvents([]);
    setEventForm({ type: "extra_day", date: new Date().toISOString().slice(0, 10), hours: "", multiplier: "1.5", note: "" });
  };

  const submitEvent = async () => {
    if (!eventsOpenFor) return;
    try {
      const payload: any = {
        type: eventForm.type,
        date: eventForm.date,
        note: eventForm.note,
      };
      if (eventForm.type === "overtime") {
        payload.hours = Number(eventForm.hours || 0);
        payload.multiplier = Number(eventForm.multiplier || 1.5);
      }
      const created = await addEmployeeEvent(eventsOpenFor.empId, payload);
      // refresh events and maybe employee row data (resignationDate etc.)
      const evs = await getEmployeeEvents(eventsOpenFor.empId);
      setEvents(evs);
      await load();
      // reset form
      setEventForm({ type: "extra_day", date: new Date().toISOString().slice(0, 10), hours: "", multiplier: "1.5", note: "" });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error creando evento");
    }
  };

  const removeEvent = async (eventId: string) => {
    if (!eventsOpenFor) return;
    if (!confirm("Eliminar evento?")) return;
    try {
      await deleteEmployeeEvent(eventsOpenFor.empId, eventId);
      const evs = await getEmployeeEvents(eventsOpenFor.empId);
      setEvents(evs);
      await load();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error eliminando evento");
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Administrar Empleados</h2>
      {error && <div style={{ color: "crimson" }}>{error}</div>}
      <div style={{ margin: "12px 0", display: "flex", gap: 8 }}>
        <button onClick={handleAddRow}>➕ Añadir empleado</button>
        <button onClick={load}>⟳ Refrescar</button>
      </div>

      {loading ? (
        <div>Cargando...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "220px 140px 120px 120px 120px 220px", gap: 8, alignItems: "center" }}>
          <strong>Nombre</strong>
          <strong>Mensual</strong>
          <strong>Días/sem</strong>
          <strong>Horas/día</strong>
          <strong>Días a pagar</strong>
          <strong>Acciones</strong>

          {rows.map(r => (
            <React.Fragment key={r.localId}>
              <input value={r.name} onChange={(e) => handleChange(r.localId, "name", e.target.value)} placeholder="Nombre" />
              <input value={r.salaryMonthly} onChange={(e) => handleChange(r.localId, "salaryMonthly", e.target.value)} placeholder="1200" />
              <input value={r.daysPerWeek} onChange={(e) => handleChange(r.localId, "daysPerWeek", e.target.value)} placeholder="5" />
              <input value={r.hoursPerDay} onChange={(e) => handleChange(r.localId, "hoursPerDay", e.target.value)} placeholder="8" />
              <input value={r.daysToPay} onChange={(e) => handleChange(r.localId, "daysToPay", e.target.value)} placeholder="(opcional)" />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => handleSave(r)} disabled={r.saving} style={{ background: "green", color: "white" }}>{r.saving ? "Guardando..." : "Guardar"}</button>
                <button onClick={() => handleDelete(r)} style={{ background: "crimson", color: "white" }}>🗑️</button>
                <button onClick={() => openEvents(r.id, r.name)}>Eventos</button>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Events Modal / Panel */}
      {eventsOpenFor && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", justifyContent: "center", alignItems: "center", padding: 20
        }}>
          <div style={{ width: 820, background: "white", borderRadius: 8, padding: 16, maxHeight: "90vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3>Eventos — {eventsOpenFor.name}</h3>
              <div>
                <button onClick={() => { closeEvents(); }} style={{ marginRight: 8 }}>Cerrar</button>
                <button onClick={() => { setEvents([]); }}>Clear</button>
              </div>
            </div>

            <section style={{ marginBottom: 12 }}>
              <h4>Añadir Evento</h4>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select value={eventForm.type} onChange={(e) => setEventForm({ ...eventForm, type: e.target.value as any })}>
                  <option value="extra_day">Día extra</option>
                  <option value="overtime">Horas extra</option>
                  <option value="resignation">Renuncia</option>
                </select>

                <input type="date" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} />

                {eventForm.type === "overtime" && (
                  <>
                    <input placeholder="Horas" value={eventForm.hours} onChange={(e) => setEventForm({ ...eventForm, hours: e.target.value })} style={{ width: 100 }} />
                    <input placeholder="Multiplicador" value={eventForm.multiplier} onChange={(e) => setEventForm({ ...eventForm, multiplier: e.target.value })} style={{ width: 120 }} />
                  </>
                )}

                <input placeholder="Nota (opcional)" value={eventForm.note} onChange={(e) => setEventForm({ ...eventForm, note: e.target.value })} style={{ flex: 1 }} />

                <button onClick={submitEvent} style={{ background: "#1e90ff", color: "white" }}>Añadir</button>
              </div>
            </section>

            <section>
              <h4>Eventos (más recientes arriba)</h4>
              {eventsLoading ? <div>Cargando eventos...</div> : (
                <div>
                  {events.length === 0 && <div>No hay eventos</div>}
                  <ul style={{ listStyle: "none", padding: 0 }}>
                    {events.map(ev => (
                      <li key={ev.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0", display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <strong>{ev.type}</strong> — {ev.date} — {ev.amount ? `S/. ${ev.amount}` : ''} {ev.hours ? `(${ev.hours}h)` : ''} <div style={{ color: "#666" }}>{ev.note}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => removeEvent(ev.id!)} style={{ background: "crimson", color: "white" }}>Eliminar</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
