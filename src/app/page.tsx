'use client';
import { useActionState } from 'react';
import { loginAction } from '@/api/login';
import styles from '@/styles/login.module.css';

export default function LoginPage() {
  const [state, submit, pending] = useActionState(
    async (_state: { error: string }, payload: FormData) => await loginAction(payload),
    { error: '' }
  );

  return (
    <div className={styles.container}>
      <form action={submit} className={styles.form}>
        <label className={styles.option}>
          <p>
            NOMBRE DE USUARIO:
          </p>
          <input name="username" required />
        </label>
        <label className={`${styles.password} ${styles.option}`}>
          <p>
            CONTRASEÑA:
          </p>
          <input name="password" type="password" required />
        </label>
        <div className={styles.state}>
          <p className={styles.error}>{state.error ? state.error : null}</p>
          <button type="submit" disabled={pending} className={styles.btn}>
          
            {pending ? 'Ingresando…' : 'Iniciar Sesión'}
          </button>
        </div>
      </form>
    </div>
  );
}
