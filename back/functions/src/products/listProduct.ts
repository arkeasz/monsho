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

app.get('/', async (req, res) => {
  try {
    const limitRaw = parseInt(String(req.query.limit || '20'), 10)
    const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 20 : limitRaw), 100)
    const orderBy = String(req.query.orderBy || 'createdAt')
    const direction = String(req.query.direction || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'

    const brandQ = req.query.brand ? String(req.query.brand).trim() : null
    const codeQ = req.query.code ? String(req.query.code).trim() : null
    const colorQ = req.query.color ? String(req.query.color).trim() : null
    const sizeQ = req.query.size ? String(req.query.size).trim() : null
    const cursor = req.query.cursor ? String(req.query.cursor) : null

    function parsePriceToCents(v: any): number | undefined {
      if (v === undefined || v === null || v === '') return undefined
      const n = Number(String(v).replace(',', '.'))
      if (Number.isNaN(n)) return undefined
      if (Math.abs(n) < 1000) return Math.round(n * 100) 
      return Math.round(n) 
    }

    const minPriceCents = parsePriceToCents(req.query.minPrice)
    const maxPriceCents = parsePriceToCents(req.query.maxPrice)

    const { FieldPath, Timestamp } = await import('firebase-admin/firestore')
    // Construimos query base: orderBy principal + tie-breaker por documentId (estable)
    let q: any = db.collection('products').orderBy(orderBy, direction)
    q = q.orderBy(FieldPath.documentId(), 'asc') // tie-breaker

    if (minPriceCents !== undefined) q = q.where('sellPrice', '>=', minPriceCents)
    if (maxPriceCents !== undefined) q = q.where('sellPrice', '<=', maxPriceCents)
    if (cursor) {
      try {
        const raw = Buffer.from(cursor, 'base64').toString('utf8')
        const parsed = JSON.parse(raw)
        const startVals: any[] = []
        if (parsed.lastValue !== undefined) {
          if (orderBy === 'createdAt' || orderBy === 'updatedAt') {
            startVals.push(Timestamp.fromMillis(Number(parsed.lastValue)))
          } else {
            startVals.push(parsed.lastValue)
          }
        }
        if (parsed.lastId !== undefined) startVals.push(parsed.lastId)
        if (startVals.length) q = q.startAfter(...startVals)
      } catch (e) {
        console.warn('cursor decode error', e)
      }
    }

    const FETCH_MULTIPLIER = 3
    const fetchLimit = Math.min(1000, limit * FETCH_MULTIPLIER + 1)
    q = q.limit(fetchLimit)

    const snap = await q.get()
    const docs = snap.docs || []

    const brandLower = brandQ ? brandQ.toLowerCase() : null
    const codeLower = codeQ ? codeQ.toLowerCase() : null
    const colorLower = colorQ ? colorQ.toLowerCase() : null
    const sizeLower = sizeQ ? sizeQ.toLowerCase() : null

    const collected: FirebaseFirestore.QueryDocumentSnapshot[] = []
    let cursorDocForNext: FirebaseFirestore.QueryDocumentSnapshot | null = null

    for (let i = 0; i < docs.length; i++) {
      const d = docs[i]
      const data = d.data() || {}

      if (brandLower && !((data.brand || '').toString().toLowerCase().includes(brandLower))) continue
      if (codeLower && !((data.code || '').toString().toLowerCase().includes(codeLower))) continue
      if (colorLower && !((data.color || '').toString().toLowerCase().includes(colorLower))) continue

      if (sizeLower) {
        if (!Array.isArray(data.sizes)) continue
        const matches = data.sizes.some((s: any) => (String(s.size || '')).toLowerCase().includes(sizeLower))
        if (!matches) continue
      }

      const sellPrice = Number(data.sellPrice ?? data.costPrice ?? 0)
      if (minPriceCents !== undefined && !Number.isNaN(minPriceCents) && sellPrice < minPriceCents) continue
      if (maxPriceCents !== undefined && !Number.isNaN(maxPriceCents) && sellPrice > maxPriceCents) continue

      collected.push(d)

      if (collected.length === limit) {
        cursorDocForNext = docs[i] 
        break
      }
    }

    let hasNext = false
    let nextCursor: string | null = null
    if (collected.length === limit) {
      hasNext = true
      const lastValRaw = cursorDocForNext!.get(orderBy)
      const lastValueToStore = (lastValRaw && typeof lastValRaw.toMillis === 'function')
        ? lastValRaw.toMillis()
        : lastValRaw
      nextCursor = Buffer.from(JSON.stringify({ lastValue: lastValueToStore, lastId: cursorDocForNext!.id })).toString('base64')
    } else if (docs.length === fetchLimit) {
      // no completamos `limit`, pero llegamos al fetchLimit: probablemente hay más resultados -> avanzamos cursor hasta el último doc leído
      hasNext = true
      const lastDoc = docs[docs.length - 1]
      const lastValRaw = lastDoc.get(orderBy)
      const lastValueToStore = (lastValRaw && typeof lastValRaw.toMillis === 'function')
        ? lastValRaw.toMillis()
        : lastValRaw
      nextCursor = Buffer.from(JSON.stringify({ lastValue: lastValueToStore, lastId: lastDoc.id })).toString('base64')
    }

    // Mapear salida
    const products = collected.map(doc => {
      const data = doc.data() || {}
      return {
        id: doc.id,
        brand: data.brand ?? '',
        code: data.code ?? '',
        color: data.color ?? '',
        sellPrice: data.sellPrice ?? null,
        costPrice: data.costPrice ?? null,
        sizes: Array.isArray(data.sizes) ? data.sizes.map((s: any) => ({ size: s.size, quantity: s.quantity })) : [],
        imageUrl: data.imageUrl || '',
        createdAt: data.createdAt && typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : data.createdAt
      }
    })

    res.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120')
    return res.json({
      meta: { limit, nextCursor, hasNext, total: null },
      products,
    })

  } catch (err) {
    console.error('listProducts error:', err)
    return res.status(500).json({ error: err })
  }
})

export const listProducts = onRequest(app)