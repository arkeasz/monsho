'use client'
import { FormEvent, useState } from 'react'
import { apiRequest } from '@/api/utils'
import styles from '@styles/signup.module.css'

interface SignUpProps {
  onSuccess?: () => void
}

interface SignupResponse {
  message: string
}

export default function SignUp({ onSuccess }: SignUpProps) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    const form = e.currentTarget
    const formData = new FormData(form)
    const username = formData.get('username') as string
    const password = formData.get('password') as string
    const role = (formData.get('role') as 'worker' | 'admin') || 'worker'

    try {
      const data = await apiRequest<SignupResponse>('signup/signup', {
        username,
        password,
        role,
      })
      setSuccess(data.message)
      form.reset()
      onSuccess?.()         
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}> 
      <h2>Crear Cuenta</h2>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input name="username" placeholder="Nombre de Usuario" required/>
        <input name="password" type="password" placeholder="Contraseña" required/>
        <select name="role">
          <option value="worker">Empleado</option>
          <option value="admin">Administrador</option>
        </select>
        <button type="submit" disabled={loading}>
          {loading ? 'Creando…' : 'Crear Cuenta'}
        </button>
        {/* {error && <p>{error}</p>}
        {success && <p>{success}</p>} */}
      </form>
    </div>
  )
}
