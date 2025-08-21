import express from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v1/https';
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!admin.apps.length) admin.initializeApp();
const db = getFirestore();

const ORIGIN = process.env.WEB_URL || 'http://localhost:3000'

const app = express()
app.use(
  cors({
    origin: ORIGIN,
  })
)

app.use(express.json());

function getTodayISO(): string {
  try {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });
  } catch (err) {
    const now = new Date();
    const lima = new Date(now.getTime() + (-5 - now.getTimezoneOffset() / 60) * 3600 * 1000);
    const yyyy = lima.getUTCFullYear();
    const mm = String(lima.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(lima.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}

app.post('/registerSale', async (req, res) => {
  try {
    const { productCode, storeId, quantity, size } = req.body as {
      productCode: string;
      storeId: number;
      quantity: number;
      size: string;
    };
    if (!productCode || !storeId || !quantity || !size) {
      return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }

    const q = await db
      .collection('products')
      .where('code', '==', productCode.toUpperCase())
      .limit(1)
      .get();

    if (q.empty) {
      return res.status(404).json({ error: 'Producto no encontrado' })
    }

    const prodSnap = q.docs[0];
    console.log('Producto encontrado:', prodSnap);
    const productRef = prodSnap.ref;
    console.log('Referencia del producto:', productRef);
    const prodData = prodSnap.data()!;

    const now = FieldValue.serverTimestamp();
    const reportRef = db
      .collection('dailyReports')
      .doc(getTodayISO());

    const sise = prodData.sizes.find((s: any) => s.size == Number(size));

    if (!sise) {
      return res.status(404).json({ error: 'Producto no encontrado por talla.' });
    }

    await db.runTransaction(async tx => {
      const snap = await tx.get(productRef);
      const sizesArr: { size: string; quantity: number }[] = snap.data()!.sizes || [];

      console.log('📦 Sizes antes:', sizesArr);

      const updatedSizes = sizesArr.map(s => {
        if (s.size === size) {
          const newQty = s.quantity - quantity;
          if (newQty < 0) {
            throw new Error(`Stock insuficiente para la talla ${size}.`);
          }
          return { size, quantity: newQty };
        }
        return s;
      });

      console.log('🔄 Sizes después:', updatedSizes);
      const rawApplied = req.body.appliedPrice;
      const parsedApplied = rawApplied === undefined || rawApplied === null
        ? NaN
        : Number(rawApplied);
      const originalSellPrice = prodData.sellPrice as number;
      let appliedSellPrice: number;
      if (!Number.isNaN(parsedApplied) && parsedApplied !== 0) {
        appliedSellPrice = Math.round(parsedApplied * 100);
        if (appliedSellPrice < 0) {
          throw new Error('appliedPrice inválido (negativo)');
        }
      } else {
        appliedSellPrice = originalSellPrice;
      }
      const costPrice = prodData.costPrice as number;

      const subGain = (appliedSellPrice - costPrice) * quantity;


      const saleRef = db.collection('sales').doc();
      tx.set(saleRef, {
        productCode,
        storeId,
        quantity,
        size,
        costPrice,
        originalSellPrice,
        appliedSellPrice,
        subGain,
        timestamp: now,
      });

      tx.update(productRef, {
        sizes: updatedSizes,
        updatedAt: now,
      });

      const storeTotalsField = `storeTotals.${storeId}`;
      tx.set(reportRef, { date: reportRef.id }, { merge: true });
      tx.update(reportRef, {
        [storeTotalsField]: FieldValue.increment(subGain),
      });

      console.log('✅ Transacción lista');
    });


    return res.status(200).json({ message: 'Venta registrada correctamente.' });
  } catch (err: any) {
    console.error('Error en registerSale:', err);
    return res.status(400).json({ error: err.message || 'Error interno.' });
  }
});

export const registerSale = onRequest(app);
