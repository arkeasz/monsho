import React, { useEffect, useState } from 'react';
import {
  getOtherExpenses,
  createOtherExpense,
  updateOtherExpense,
  deleteOtherExpense,
} from '@/api/expenses'; 
import styles from '@styles/expenses.module.css'


import { OtherExpense } from '@/types/expenses'; 
interface Props {
  dateISO: string;
}
function getTodayISO(): string {
  try {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });
  } catch (err) {
    const now = new Date();
    const limaOffsetHours = -5;
    const limaTime = new Date(now.getTime() + limaOffsetHours * 60 * 60 * 1000);
    const yyyy = limaTime.getUTCFullYear();
    const mm = String(limaTime.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(limaTime.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}

export default function OtherExpensesTable() {
    const [expenses, setExpenses] = useState<OtherExpense[]>([]);
    const [loading, setLoading] = useState(false);
    const [newExpense, setNewExpense] = useState({ name: '', costDaily: '' });
    const [editId, setEditId] = useState<string | null>(null);
    const [editData, setEditData] = useState<{ name: string; costDaily: string }>({ name: '', costDaily: '' });
    const [error, setError] = useState<string | null>(null);
    const [dateISO] = useState(getTodayISO());
  useEffect(() => {
    loadExpenses();
  }, [dateISO]);

  async function loadExpenses() {
    setLoading(true);
    setError(null);
    try {
      const data = await getOtherExpenses(dateISO);
      setExpenses(data);
    } catch (err: any) {
      setError(err.message || 'Error cargando gastos');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newExpense.name.trim() || !newExpense.costDaily.trim()) {
      setError('Completa nombre y costo');
      return;
    }
    const cost = Number(newExpense.costDaily);
    if (isNaN(cost) || cost < 0) {
      setError('Costo inválido');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const id = await createOtherExpense({ ...newExpense, costDaily: cost, dateISO });
      setExpenses(prev => [...prev, { id, name: newExpense.name, costDaily: cost }]);
      setNewExpense({ name: '', costDaily: '' });
    } catch (err: any) {
      setError(err.message || 'Error creando gasto');
    } finally {
      setLoading(false);
    }
  }

  function startEdit(expense: OtherExpense) {
    setEditId(expense.id);
    setEditData({ name: expense.name, costDaily: expense.costDaily.toString() });
    setError(null);
  }

  async function saveEdit() {
    if (!editId) return;

    if (!editData.name.trim() || !editData.costDaily.trim()) {
      setError('Completa nombre y costo');
      return;
    }
    const cost = Number(editData.costDaily);
    if (isNaN(cost) || cost < 0) {
      setError('Costo inválido');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await updateOtherExpense(editId, { ...editData, costDaily: cost, dateISO });
      setExpenses(prev =>
        prev.map(e => (e.id === editId ? { ...e, name: editData.name, costDaily: cost } : e))
      );
      setEditId(null);
    } catch (err: any) {
      setError(err.message || 'Error actualizando gasto');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar gasto?')) return;

    setLoading(true);
    setError(null);
    try {
      await deleteOtherExpense(id, dateISO);
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (err: any) {
      setError(err.message || 'Error borrando gasto');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.other_expenses}>
      <h2>Gastos adicionales para {dateISO}</h2>

      {error && <div style={{ color: 'red' }}>{error}</div>}

      <table className={styles.table_expenses}>
        <thead>
          <tr style={{ borderBottom: '1px solid black' }}>
            <th style={{ padding: 8, textAlign: 'left' }}>Nombre</th>
            <th style={{ padding: 8, textAlign: 'right' }}>Costo Diario</th>
            <th style={{ padding: 8 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map(exp => (
            <tr key={exp.id}>
              <td style={{ padding: 8 }}>
                {editId === exp.id ? (
                  <input
                    type="text"
                    value={editData.name}
                    onChange={e => setEditData(prev => ({ ...prev, name: e.target.value }))}
                  />
                ) : (
                  exp.name
                )}
              </td>
              <td style={{ padding: 8, textAlign: 'right' }}>
                {editId === exp.id ? (
                  <input
                    type="number"
                    value={editData.costDaily}
                    onChange={e => setEditData(prev => ({ ...prev, costDaily: e.target.value }))}
                    step="0.01"
                  />
                ) : (
                  `S/.${exp.costDaily.toFixed(2)}`
                )}
              </td>
              <td className={styles.button_actions}>
                {editId === exp.id ? (
                  <>
                    <button onClick={saveEdit} disabled={loading}>
                      Guardar
                    </button>
                    <button onClick={() => setEditId(null)} disabled={loading}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(exp)} disabled={loading}>
                      Editar
                    </button>
                    <button onClick={() => handleDelete(exp.id)} disabled={loading}>
                      Borrar
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}

          <tr>
            <td style={{ padding: 8 }}>
              <input
                type="text"
                placeholder="Nuevo nombre"
                value={newExpense.name}
                onChange={e => setNewExpense(prev => ({ ...prev, name: e.target.value }))}
                disabled={loading}
              />
            </td>
            <td style={{ padding: 8 }}>
              <input
                type="number"
                placeholder="Nuevo costo"
                value={newExpense.costDaily}
                onChange={e => setNewExpense(prev => ({ ...prev, costDaily: e.target.value }))}
                step="0.01"
                disabled={loading}
              />
            </td>
            <td style={{ padding: 8 }}>
              <button className={styles.add_expense} onClick={handleAdd} disabled={loading}>
                Agregar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
