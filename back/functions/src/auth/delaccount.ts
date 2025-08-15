import express from 'express';
import cors from 'cors';
import { onRequest } from "firebase-functions/v1/https";

import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

interface DeleteRequest {
  uid: string; 
}

const ORIGIN = process.env.WEB_URL || 'http://localhost:3000'

const app = express()
app.use(
  cors({
    origin: ORIGIN,
  })
)

app.use(express.json());

app.delete('/deleteUser', async (req, res) => {
  const { uid } = req.body as DeleteRequest;
  if (!uid) {
    return res.status(400).json({ error: 'El campo uid es obligatorio' });
  }

  try {
    const userRef = db.collection('workers').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await userRef.delete();
    return res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('deleteUser error:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
});

export const deleteUser = onRequest(app);