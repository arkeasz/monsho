import express from 'express';
import cors from 'cors';
import { onRequest } from "firebase-functions/v1/https";

import * as admin from 'firebase-admin';
import * as bcrypt from 'bcrypt';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

interface SignupRequest {
  username: string;
  password: string;
  role?: 'worker' | 'admin';
}

const ORIGIN = process.env.WEB_URL || 'http://localhost:3000'

const app = express()
app.use(
  cors({
    origin: ORIGIN,
  })
)

app.use(express.json());
app.post('/signup', async (req, res) => {
  const { username, password, role = 'worker' } = req.body as SignupRequest;
  if (!username || !password) {
    return res.status(400).json({ error: 'username y password son obligatorios' });
  }

  try {
    // Verificar si existe el usuario
    const usersRef = db.collection('workers');
    const existing = await usersRef.where('username', '==', username).limit(1).get();
    if (!existing.empty) {
      return res.status(409).json({ error: 'El username ya está en uso' });
    }

    // Hashear la contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear documento en Firestore
    await usersRef.add({
      username,
      passwordHash,
      role,
      createdAt: (await import('firebase-admin/firestore')).FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ message: 'Usuario creado correctamente' });
  } catch (error) {
    console.error('signup error:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
});

export const signup = onRequest(app);