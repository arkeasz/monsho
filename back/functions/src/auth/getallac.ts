// functions/src/getAllAccounts.ts
import express from 'express'
import cors from 'cors'
import { onRequest } from 'firebase-functions/v1/https'
import * as admin from 'firebase-admin'

if (!admin.apps.length) admin.initializeApp()
const db = admin.firestore()
const ORIGIN = process.env.WEB_URL || 'http://localhost:3000'

const app = express()
app.use(
  cors({
    origin: ORIGIN,
  })
)
app.use(express.json())

app.get('/getAllAccounts', async (_req, res) => {
  try {
    const snapshot = await db.collection('workers').get()
    const users = snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        uid: doc.id,
        username: data.username,
        role: data.role,
        // no incluimos passwordHash ni campos sensibles
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }
    })
    return res.json(users)
  } catch (err) {
    console.error('getAllAccounts error:', err)
    return res.status(500).json({ error: 'Error interno' })
  }
})

export const getAllAccounts = onRequest(app)
