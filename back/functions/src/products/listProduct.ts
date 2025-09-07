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
    const { brand, code, color, size } = req.query
    const minPrice = req.query.minPrice !== undefined ? Number(req.query.minPrice) : undefined
    const maxPrice = req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : undefined
    const cursor = req.query.cursor ? String(req.query.cursor) : null // base64

    let q: any = db.collection('products')

    if (brand) q = q.where('brand', '==', String(brand))
    if (code) q = q.where('code', '==', String(code))
    if (color) q = q.where('color', '==', String(color))
    if (!isNaN(minPrice)) q = q.where('sellPrice', '>=', minPrice)
    if (!isNaN(maxPrice)) q = q.where('sellPrice', '<=', maxPrice)

    // Si quieres filtrar por size en Firestore, añade campo disponibleSizes en cada doc y entonces:
    // if (size) q = q.where('availableSizes', 'array-contains', String(size))

    q = q.orderBy(orderBy, direction).limit(limit + 1) // pedimos +1 para saber si hay siguiente página

    // si viene cursor, decodifícalo y úsalo como startAfter
    if (cursor) {
      try {
        const raw = Buffer.from(cursor, 'base64').toString('utf8')
        const parsed = JSON.parse(raw) // { lastValue, lastId }
        // Si orderBy es timestamp guardamos como number y convertimos a Timestamp si necesario
        const startVals = []
        if (parsed.lastValue !== undefined) {
          // si guardaste como millis (number), convertir:
          if (orderBy === 'createdAt' || orderBy === 'updatedAt') {
            startVals.push(admin.firestore.Timestamp.fromMillis(Number(parsed.lastValue)))
          } else {
            startVals.push(parsed.lastValue)
          }
        }
        if (parsed.lastId !== undefined) startVals.push(parsed.lastId) // tiebreaker
        q = q.startAfter(...startVals)
      } catch (e) {
        console.warn('cursor decode error', e)
      }
    }

    const snap = await q.get()
    const docs = snap.docs

    let filteredDocs = docs
    if (size && !(false)) {
      const sizeStr = String(size)
      filteredDocs = docs.filter(d => {
        const data = d.data()
        if (!Array.isArray(data.sizes)) return false
        return data.sizes.some((s) => String(s.size) === sizeStr)
      })
    }

    let hasNext = false
    let pageDocs = filteredDocs
    if (filteredDocs.length > limit) {
      hasNext = true
      pageDocs = filteredDocs.slice(0, limit)
    }

    let nextCursor = null
    if (hasNext && pageDocs.length > 0) {
      const lastDoc = pageDocs[pageDocs.length - 1]
      const lastVal = lastDoc.get(orderBy)
      const lastValueToStore =
        (lastVal && lastVal.toMillis) ? lastVal.toMillis() : lastVal
      const cursorObj = { lastValue: lastValueToStore, lastId: lastDoc.id }
      nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString('base64')
    }

    const products = pageDocs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        brand: data.brand,
        code: data.code,
        color: data.color,
        sellPrice: data.sellPrice,
        costPrice: data.costPrice,
        sizes: Array.isArray(data.sizes) ? data.sizes.map(s => ({ size: s.size, quantity: s.quantity })) : [],
        imageUrl: data.imageUrl || '',
        createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt
      }
    })

    let total = null
    try {
      const countQ = db.collection('products')
      if (brand) countQ.where('brand','==',String(brand))
      if (code) countQ.where('code','==',String(code))
      if (color) countQ.where('color','==',String(color))
      // const countSnap = await countQ.count().get()
      // total = countSnap.data().count
    } catch (err) {
    }

    res.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120')

    return res.json({
      meta: { limit, nextCursor, hasNext, total },
      products,
    })
  } catch (err) {
    console.error('listProducts error:', err)
    return res.status(500).json({ error: 'Error interno' })
  }
})

export const listProducts = onRequest(app)