// import express from 'express'
// import cors from 'cors'
// import { onRequest } from 'firebase-functions/v1/https'
// import * as admin from 'firebase-admin'

// if (!admin.apps.length) admin.initializeApp()
// const db = admin.firestore()
// const ORIGIN = process.env.WEB_URL || 'http://localhost:3000'

// const app = express()
// app.use(
//   cors({
//     origin: ORIGIN,
//   })
// )

// app.use(express.json())

// /**
//  * GET /listProducts?limit=50&pageToken=<base64>
//  * - limit: número de items devueltos (1..100). default 50
//  * - pageToken: base64(JSON.stringify({ createdAt: millis, id: docId }))
//  *
//  * Respuesta:
//  * { products: [...], nextPageToken: string | null }
//  */
// app.get('/', async (req, res) => {
//   try {
//     const rawLimit = Number(req.query.limit ?? 50)
//     const limit = Math.max(1, Math.min(100, Number.isFinite(rawLimit) ? rawLimit : 50))

//     const pageToken = typeof req.query.pageToken === 'string' ? req.query.pageToken : undefined

//     const { FieldPath } = await import('firebase-admin/firestore');


//     let query: FirebaseFirestore.Query = db.collection('products')
//       .orderBy('createdAt', 'desc')
//       .orderBy(FieldPath.documentId(), 'asc')

//     if (pageToken) {
//       // decodificar token
//       try {
//         const decoded = JSON.parse(Buffer.from(pageToken, 'base64').toString('utf8'))
//         const createdAtMillis = Number(decoded.createdAt)
//         const id = String(decoded.id)
//         if (!Number.isFinite(createdAtMillis) || !id) throw new Error('invalid token')

//         const ts = admin.firestore.Timestamp.fromMillis(createdAtMillis)
//         // startAfter debe recibir valores en el mismo orden que orderBy
//         query = query.startAfter(ts, id)
//       } catch (err) {
//         return res.status(400).json({ error: 'pageToken inválido' })
//       }
//     }

//     // traemos limit + 1 para saber si hay siguiente página
//     const snap = await query.limit(limit + 1).get()
//     const docs = snap.docs

//     const hasNext = docs.length > limit
//     const pageDocs = hasNext ? docs.slice(0, limit) : docs

//     const products = pageDocs.map(doc => {
//       const data = doc.data() as any
//       return {
//         id: doc.id,
//         brand: data.brand ?? null,
//         code: data.code ?? null,
//         color: data.color ?? null,
//         costPrice: data.costPrice ?? 0,
//         sellPrice: data.sellPrice ?? 0,
//         sizes: Array.isArray(data.sizes) ? data.sizes.map((s: any) => ({ size: s.size, quantity: s.quantity })) : [],
//         imageUrl: data.imageUrl ?? '',
//         createdAt: data.createdAt ?? null,
//         updatedAt: data.updatedAt ?? null,
//       }
//     })

//     let nextPageToken: string | null = null
//     if (hasNext && pageDocs.length > 0) {
//       const lastDoc = pageDocs[pageDocs.length - 1]
//       let createdAtMillis: number
//       const ca = lastDoc.get && lastDoc.get('createdAt')
//       if (ca && typeof ca.toMillis === 'function') {
//         createdAtMillis = ca.toMillis()
//       } else if ((lastDoc as any).createTime && typeof (lastDoc as any).createTime.toMillis === 'function') {
//         createdAtMillis = (lastDoc as any).createTime.toMillis()
//       } else {
//         createdAtMillis = Date.now()
//       }
//       const tokenObj = { createdAt: createdAtMillis, id: lastDoc.id }
//       nextPageToken = Buffer.from(JSON.stringify(tokenObj)).toString('base64')
//     }

//     return res.json({ products, nextPageToken })
//   } catch (err) {
//     console.error('listProducts error:', err)
//     return res.status(500).json({ error: 'Error interno' })
//   }
// })

// export const listProducts = onRequest(app)


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

app.get('/', async (_req, res) => {
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