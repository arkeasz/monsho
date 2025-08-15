import express from 'express'
import cors from 'cors'
import { onRequest } from 'firebase-functions/v1/https'
import * as admin from 'firebase-admin'
import * as bcrypt from 'bcrypt'

if (!admin.apps.length) admin.initializeApp()
const db = admin.firestore()

interface UpdateRequest {
  uid: string                // ID del usuario
  username?: string          // nuevo username (opcional)
  password?: string          // nueva contraseña (opcional)
  role?: 'worker' | 'admin'  // nuevo rol (opcional)
}

const ORIGIN = process.env.WEB_URL || 'http://localhost:3000'

const app = express()
app.use(
  cors({
    origin: ORIGIN,
  })
)

app.use(express.json())

app.options('/updateUser', (_req, res) => {
  res.sendStatus(204)
})

app.put('/updateUser', async (req, res) => {
  const { uid, username, password, role } = req.body as UpdateRequest

  if (!uid) {
    return res.status(400).json({ error: 'El campo uid es obligatorio' })
  }

  try {
    const userRef = db.collection('workers').doc(uid)
    const userDoc = await userRef.get()
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const updates: Record<string, any> = {}

    if (username) {
      const snap = await db
        .collection('workers')
        .where('username', '==', username)
        .limit(1)
        .get()
      if (!snap.empty && snap.docs[0].id !== uid) {
        return res.status(409).json({ error: 'El username ya está en uso' })
      }
      updates.username = username
    }

    if (password) {
      updates.passwordHash = await bcrypt.hash(password, 10)
    }

    if (role) {
      updates.role = role
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' })
    }

    // updates.updatedAt = admin.firestore.FieldValue.serverTimestamp()

    await userRef.update(updates)
    return res.json({ message: 'Usuario actualizado correctamente' })
  } catch (error) {
    console.error('updateUser error:', error)
    return res.status(500).json({ error: 'Error interno' })
  }
})

export const updateUser = onRequest(app)
