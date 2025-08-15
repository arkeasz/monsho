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

app.get('/listProducts', async (_req, res) => {
  try {
    const snapshot = await db.collection('products').get()
    const products = snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        brand: data.brand,
        code: data.code,
        color: data.color,
        costPrice: data.costPrice,
        description: data.description,
        sellPrice: data.sellPrice,
        sizes: Array.isArray(data.sizes)
          ? data.sizes.map((s: any) => ({ size: s.size, quantity: s.quantity }))
          : [],
        imageUrl: data.imageUrl || '', 
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }
    })
    return res.json(products)
  } catch (err) {
    console.error('listProducts error:', err)
    return res.status(500).json({ error: 'Error interno' })
  }
})

export const listProducts = onRequest(app)