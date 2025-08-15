import express from 'express';
import cors from 'cors';
import { onRequest } from "firebase-functions/v1/https";

import * as admin from 'firebase-admin';
import * as bcrypt from 'bcrypt';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

interface LoginRequest {
  username: string;
  password: string;
}

const ORIGIN = process.env.WEB_URL || 'http://localhost:3000'

const app = express()
app.use(
  cors({
    origin: ORIGIN,
  })
)
app.use(express.json());

app.post('/login', async (req: any, res: any) => {
  const { username, password } = req.body as LoginRequest;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: 'username y password son obligatorios' });
  }

  try {
    const snapshot = await db
      .collection('workers')
      .where('username', '==', username)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const doc = snapshot.docs[0];
    const { passwordHash, role } = doc.data() as {
      passwordHash: string;
      role: string;
    };

    const valid = await bcrypt.compare(password, passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    return res.json({ username, role });
  } catch (error) {
    console.error('login error:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
});

export const login = onRequest(app);

