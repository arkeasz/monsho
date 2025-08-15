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

    // 0) Buscar el documento del producto por el campo `code`
    const q = await db
      .collection('products')
      .where('code', '==', productCode)
      .limit(1)
      .get();

    if (q.empty) {
      return res.status(404).json({ error: 'Producto no encontrado por code.' });
    }
    const prodSnap = q.docs[0];
    console.log('Producto encontrado:', prodSnap);
    const productRef = prodSnap.ref;
    console.log('Referencia del producto:', productRef);
    const prodData = prodSnap.data()!;

    // 1) Fecha / timestamp
    const now = FieldValue.serverTimestamp();
    const reportRef = db
      .collection('dailyReports')
      .doc(new Date().toISOString().slice(0, 10));

    await db.runTransaction(async tx => {
      // 1) Leer inventario actual
      const snap = await tx.get(productRef);
      const sizesArr: { size: string; quantity: number }[] = snap.data()!.sizes || [];

      console.log('📦 Sizes antes:', sizesArr);

      // 2) Crear nuevo array con la talla actualizada
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

      // 3) Calcular subGain
      const price = prodData.sellPrice as number;
      const cost  = prodData.costPrice as number;
      const subGain = (price - cost) * quantity;

      // 4) Crear la venta
      const saleRef = db.collection('sales').doc();
      tx.set(saleRef, {
        productCode,
        storeId,
        quantity,
        size,
        subGain,
        timestamp: now,
      });

      // 5) Actualizar el producto
      console.log('✏️ Actualizando producto...');
      tx.update(productRef, {
        sizes: updatedSizes,
        updatedAt: now,
      });

      // 6) Actualizar reporte diario
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
