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

function parsePriceToCents(v: any): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(String(v).replace(',', '.'))
  if (Number.isNaN(n)) return undefined
  if (Math.abs(n) < 1000) return Math.round(n * 100)
  return Math.round(n)
}

function parseIntSafe(v: any, fallback = undefined) {
  if (v === undefined || v === null) return fallback
  const n = parseInt(String(v), 10)
  return Number.isNaN(n) ? fallback : n
}

function parseDateRange(dateStr: string | undefined) {
  // dateStr esperado "YYYY-MM-DD"
  if (!dateStr) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) return null
  const yyyy = Number(m[1]), mm = Number(m[2]) - 1, dd = Number(m[3])
  const start = new Date(Date.UTC(yyyy, mm, dd, 0, 0, 0))
  const end = new Date(Date.UTC(yyyy, mm, dd, 23, 59, 59, 999))
  return { start, end }
}

app.get('/', async (req, res) => {
  try {
    const limitRaw = parseInt(String(req.query.limit || '20'), 10)
    const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 20 : limitRaw), 100)
    const orderBy = String(req.query.orderBy || 'timestamp')
    const direction = String(req.query.direction || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'

    const storeIdQ = req.query.storeId ? parseIntSafe(req.query.storeId) : undefined
    const storeNameQ = req.query.storeName ? String(req.query.storeName).trim() : undefined
    const productCodeQ = req.query.productCode ? String(req.query.productCode).trim().toUpperCase() : undefined
    const paymentMethodQ = req.query.paymentMethod ? String(req.query.paymentMethod).trim() : undefined
    const dateQ = req.query.date ? String(req.query.date).trim() : undefined // YYYY-MM-DD
    const minRevenueCents = parsePriceToCents(req.query.minRevenue) // ingreso = appliedSellPrice * quantity
    const maxRevenueCents = parsePriceToCents(req.query.maxRevenue)

    const cursor = req.query.cursor ? String(req.query.cursor) : null

    const { FieldPath, Timestamp } = await import('firebase-admin/firestore')

    // Normalize params for prefix search
    const pmRaw = paymentMethodQ ? String(paymentMethodQ).trim().toLowerCase() : undefined
    const snRaw = storeNameQ ? String(storeNameQ).trim().toLowerCase() : undefined

    // Query base decision:
    // - if pmRaw present -> prefix search on 'paymentMethod' (order by paymentMethod)
    // - else if snRaw present -> prefix search on 'storeNameLower' (order by storeNameLower)
    // - else -> default orderBy
    let q: any
    let usingPrefixedField: 'paymentMethod' | 'storeNameLower' | null = null

    if (pmRaw) {
      usingPrefixedField = 'paymentMethod'
      q = db.collection('sales').orderBy('paymentMethod')
      q = q.orderBy(FieldPath.documentId(), 'asc') // tie-breaker
      q = q.startAt(pmRaw).endAt(pmRaw + '\uf8ff')
    } else if (snRaw) {
      usingPrefixedField = 'storeNameLower'
      q = db.collection('sales').orderBy('storeNameLower')
      q = q.orderBy(FieldPath.documentId(), 'asc')
      q = q.startAt(snRaw).endAt(snRaw + '\uf8ff')
    } else {
      q = db.collection('sales').orderBy(orderBy, direction)
      q = q.orderBy(FieldPath.documentId(), 'asc')
    }

    // Simple where filters (storeId and productCode are direct fields)
    if (storeIdQ !== undefined) q = q.where('storeId', '==', storeIdQ)
    if (productCodeQ) q = q.where('productCode', '==', productCodeQ)

    // If we didn't use prefixed search for paymentMethod but paymentMethodQ exists (e.g. whitespace),
    // apply equality filter normalized to lowercase
    if (!pmRaw && paymentMethodQ) {
      q = q.where('paymentMethod', '==', String(paymentMethodQ).trim().toLowerCase())
    }

    // Date range filter
    if (dateQ) {
      const range = parseDateRange(dateQ)
      if (range) {
        q = q.where('timestamp', '>=', Timestamp.fromDate(range.start))
        q = q.where('timestamp', '<=', Timestamp.fromDate(range.end))
      }
    }

    // Cursor handling (same behavior que antes)
    if (cursor) {
      try {
        const raw = Buffer.from(cursor, 'base64').toString('utf8')
        const parsed = JSON.parse(raw)
        const startVals: any[] = []
        if (parsed.lastValue !== undefined) {
          if (orderBy === 'timestamp' || orderBy === 'createdAt' || orderBy === 'updatedAt') {
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

    // fetch window
    const FETCH_MULTIPLIER = 3
    const fetchLimit = Math.min(1000, limit * FETCH_MULTIPLIER + 1)
    q = q.limit(fetchLimit)

    const snap = await q.get()
    const docs = snap.docs || []

    const collected: FirebaseFirestore.QueryDocumentSnapshot[] = []
    let cursorDocForNext: FirebaseFirestore.QueryDocumentSnapshot | null = null

    for (let i = 0; i < docs.length; i++) {
      const d = docs[i]
      const data = d.data() || {}

      // If we used paymentMethod prefix search but also snRaw (storeName) was provided,
      // apply storeName filter in-memory (prefix match on storeNameLower)
      if (usingPrefixedField === 'paymentMethod' && snRaw) {
        const storeNameLower = (data.storeNameLower || (data.storeName || '')).toString().toLowerCase()
        if (!storeNameLower.includes(snRaw)) continue
      }

      // filtros adicionales no triviales: minRevenue/maxRevenue
      if ((minRevenueCents !== undefined || maxRevenueCents !== undefined)) {
        const appliedSellPrice = Number(data.appliedSellPrice ?? data.originalSellPrice ?? 0)
        const quantity = Number(data.quantity ?? 0)
        const revenue = appliedSellPrice * quantity
        if (minRevenueCents !== undefined && revenue < minRevenueCents) continue
        if (maxRevenueCents !== undefined && revenue > maxRevenueCents) continue
      }

      collected.push(d)

      if (collected.length === limit) {
        cursorDocForNext = docs[i]
        break
      }
    }

    // next cursor logic (igual que antes)
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
      hasNext = true
      const lastDoc = docs[docs.length - 1]
      const lastValRaw = lastDoc.get(orderBy)
      const lastValueToStore = (lastValRaw && typeof lastValRaw.toMillis === 'function')
        ? lastValRaw.toMillis()
        : lastValRaw
      nextCursor = Buffer.from(JSON.stringify({ lastValue: lastValueToStore, lastId: lastDoc.id })).toString('base64')
    }

    // map output
    const sales = collected.map(doc => {
      const data = doc.data() || {}
      const ts = data.timestamp && typeof data.timestamp.toDate === 'function' ? data.timestamp.toDate() : data.timestamp
      const appliedSellPrice = Number(data.appliedSellPrice ?? data.originalSellPrice ?? 0)
      const quantity = Number(data.quantity ?? 0)
      const revenue = appliedSellPrice * quantity
      return {
        id: doc.id,
        productCode: data.productCode ?? '',
        storeId: data.storeId ?? null,
        storeName: data.storeName ?? null,
        quantity: quantity,
        size: data.size ?? '',
        costPrice: data.costPrice ?? null,
        originalSellPrice: data.originalSellPrice ?? null,
        appliedSellPrice: appliedSellPrice,
        subGain: data.subGain ?? null,
        paymentMethod: data.paymentMethod ?? null,
        revenue,
        timestamp: ts,
      }
    })

    res.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120')
    return res.json({
      meta: { limit, nextCursor, hasNext, total: null },
      sales,
    })
  } catch (err) {
    console.error('listSales error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

export const listSales = onRequest(app)
