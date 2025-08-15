'use client'
import { useEffect, useState } from 'react'
import { deleteAccount, getAccounts, updateAccount } from '@/api/users'
import styles from '@styles/users.module.css'
import type { Account } from '@/types/user'
import SignUp from '@/components/signup'

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<Account | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<Account['role']>('worker')
  // let [roleInSpanish, setRoleInSpanish] = useState('')
    const loadAccounts = async () => {
        try {
        setError(null)
        const data = await getAccounts()
        setAccounts(data)
        } catch (err: any) {
        setError(err.message)
        }
    }

    useEffect(() => {
        loadAccounts()
    }, [])

//   useEffect(() => {
//     getAccounts()
//       .then(setAccounts)
//       .catch(err => setError(err.message))
//   }, [])

  const handleDelete = async (uid: string) => {
    try {
      await deleteAccount(uid)
      setAccounts(prev => prev.filter(a => a.uid !== uid))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const openEdit = (user: Account) => {
    setEditingUser(user)
    setNewUsername(user.username)
    setNewPassword('')
    setNewRole(user.role)
    setShowEditModal(true)
  }

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    try {
      await updateAccount(
        editingUser.uid,
        newUsername !== editingUser.username ? newUsername : undefined,
        newPassword || undefined,
        newRole !== editingUser.role ? newRole : undefined
      )
      // Refresca la lista localmente
      setAccounts(prev =>
        prev.map(u =>
          u.uid === editingUser.uid
            ? { ...u, username: newUsername, role: newRole }
            : u
        )
      )
      setShowEditModal(false)
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (error) return <p>Error: {error}</p>

  return (
    <>
      <section className={styles.container}>
        <div className={styles.options}>
          {/* <button>Añadir Usuario</button> */}
            <SignUp onSuccess={loadAccounts}/>
        </div>
        <ul className={styles.users}>
          {accounts
            // .filter(u => u.role !== 'admin')
            .map(u => (
              <li className={styles.user} key={u.uid}>
                {u.username} — {u.role === 'admin' ? 'Administrador' : 'Empleado'}
                <div className={styles.actions}>
                  <button
                    className={styles.edit}
                    onClick={() => openEdit(u)}
                  >
                    Editar
                  </button>
                  <button
                    className={styles.delete}
                    onClick={() => {
                      let ok = confirm("Estás seguro");
                      if (ok) {
                        handleDelete(u.uid)
                      }
                    }}
                    // disabled={u.role === 'admin'}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
        </ul>
      </section>

      {showEditModal && editingUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <button
              className={styles.closeButton}
              onClick={() => setShowEditModal(false)}
            >
              ×
            </button>
            <h2>Editar Usuario</h2>
            <form onSubmit={handleUpdateSubmit} className={styles.form}>
              <label>
                Username:
                <input
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  required
                />
              </label>
              <label>
                Nueva contraseña:
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="(dejar en blanco para no cambiar)"
                />
              </label>
              <label>
                Rol:
                <select
                  value={newRole}
                  onChange={e =>
                    setNewRole(e.target.value as Account['role'])
                  }
                >
                  <option value="worker">Worker</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <button type="submit" className={styles.submitButton}>
                Guardar Cambios
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
