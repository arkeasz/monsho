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
    let {
      productCode,
      storeId,
      quantity,
      size,
      appliedPrice,
      paymentMethod
    } = req.body as {
      productCode: string;
      storeId: number;
      quantity: number;
      size: string;
      appliedPrice?: number | null;
      paymentMethod?: string | null;
    };

    // Validaciones básicas
    if (!productCode || !storeId || !quantity || !size) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: productCode, storeId, quantity o size.' });
    }

    // paymentMethod: requerido según tu pedido. Si quieres hacerlo opcional, elimina esta comprobación.
    if (!paymentMethod || typeof paymentMethod !== 'string' || !paymentMethod.trim()) {
      return res.status(400).json({ error: 'Falta paymentMethod (método de pago).' });
    }
    const paymentMethodClean = String(paymentMethod).trim();
    // Buscar producto por código (se asume que en Firestore se almacena en mayúsculas)
    const q = await db
      .collection('products')
      .where('code', '==', productCode.toUpperCase())
      .limit(1)
      .get();

    if (q.empty) {
      return res.status(404).json({ error: 'Producto no encontrado' })
    }

    const prodSnap = q.docs[0];
    const productRef = prodSnap.ref;
    const prodData = prodSnap.data()!;

    const now = FieldValue.serverTimestamp();
    const reportRef = db
      .collection('dailyReports')
      .doc(getTodayISO());

    // encontrar talla - mantuve la lógica original (si en tu modelo size es string vs number, ajustar)
    const sise = (prodData.sizes || []).find((s: any) => s.size == Number(size) || s.size == String(size));
    if (!sise) {
      return res.status(404).json({ error: 'Producto no encontrado por talla.' });
    }

    await db.runTransaction(async tx => {
      const snap = await tx.get(productRef);
      const sizesArr: { size: any; quantity: number }[] = snap.data()!.sizes || [];

      // actualizar cantidades
      const updatedSizes = sizesArr.map(s => {
        if (String(s.size) === String(size)) {
          const newQty = (s.quantity || 0) - quantity;
          if (newQty < 0) {
            throw new Error(`Stock insuficiente para la talla ${size}.`);
          }
          return { size: s.size, quantity: newQty };
        }
        return s;
      });

      // calcular precios
      const rawApplied = appliedPrice === undefined || appliedPrice === null ? NaN : Number(appliedPrice);
      const originalSellPrice = Number(prodData.sellPrice ?? 0); // se asume en centavos
      let appliedSellPrice: number;
      if (!Number.isNaN(rawApplied) && rawApplied !== 0) {
        // si el frontend envía en unidades (p. ej. 12.34), lo convertimos a centavos
        // si ya está en centavos, ajustarlo según convención; aquí asumimos unidades -> centavos
        appliedSellPrice = Math.round(rawApplied * 100);
        if (appliedSellPrice < 0) throw new Error('appliedPrice inválido (negativo)');
      } else {
        appliedSellPrice = originalSellPrice;
      }

      const costPrice = Number(prodData.costPrice ?? 0);
      const subGain = (appliedSellPrice - costPrice) * quantity; // ganancia en centavos

      // crear documento de venta
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
        paymentMethod: paymentMethodClean,
        timestamp: now,
      });

      // actualizar stock del producto
      tx.update(productRef, {
        sizes: updatedSizes,
        updatedAt: now,
      });

      // actualizar reporte diario:
      // - totalSales mantiene tu métrica previa (usando subGain)
      // - storeTotals.<storeId> incrementa subGain (igual que antes)
      // - además agrego payment totals por método de pago (ingresos = appliedSellPrice * quantity)
      const storeTotalsField = `storeTotals.${storeId}`;
      tx.set(reportRef, { date: reportRef.id }, { merge: true });
      tx.update(reportRef, {
        totalSales: FieldValue.increment(subGain),
        [storeTotalsField]: FieldValue.increment(subGain),
      });

      // Totales por método de pago (ingresos)
      const revenue = appliedSellPrice * quantity; // en centavos
      const paymentFieldGlobal = `paymentTotals.${paymentMethodClean}`;
      const paymentFieldByStore = `storePaymentTotals.${storeId}.${paymentMethodClean}`;
      tx.update(reportRef, {
        [paymentFieldGlobal]: FieldValue.increment(revenue),
        [paymentFieldByStore]: FieldValue.increment(revenue),
      });

      // fin transacción
    });

    return res.status(200).json({ message: 'Venta registrada correctamente.' });
  } catch (err: any) {
    console.error('Error en registerSale:', err);
    return res.status(400).json({ error: err.message || 'Error interno.' });
  }
});

export const registerSale = onRequest(app);


// import express from 'express';
// import cors from 'cors';
// import { onRequest } from 'firebase-functions/v1/https';
// import * as admin from 'firebase-admin';
// import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// if (!admin.apps.length) admin.initializeApp();
// const db = getFirestore();

// const ORIGIN = process.env.WEB_URL || 'http://localhost:3000'

// const app = express()
// app.use(
//   cors({
//     origin: ORIGIN,
//   })
// )

// app.use(express.json());

// function getTodayISO(): string {
//   try {
//     return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });
//   } catch (err) {
//     const now = new Date();
//     const lima = new Date(now.getTime() + (-5 - now.getTimezoneOffset() / 60) * 3600 * 1000);
//     const yyyy = lima.getUTCFullYear();
//     const mm = String(lima.getUTCMonth() + 1).padStart(2, '0');
//     const dd = String(lima.getUTCDate()).padStart(2, '0');
//     return `${yyyy}-${mm}-${dd}`;
//   }
// }

// app.post('/registerSale', async (req, res) => {
//   try {
//     const { productCode, storeId, quantity, size } = req.body as {
//       productCode: string;
//       storeId: number;
//       quantity: number;
//       size: string;
//     };
//     if (!productCode || !storeId || !quantity || !size) {
//       return res.status(400).json({ error: 'Faltan campos obligatorios.' });
//     }

//     const q = await db
//       .collection('products')
//       .where('code', '==', productCode.toUpperCase())
//       .limit(1)
//       .get();

//     if (q.empty) {
//       return res.status(404).json({ error: 'Producto no encontrado' })
//     }

//     const prodSnap = q.docs[0];
//     console.log('Producto encontrado:', prodSnap);
//     const productRef = prodSnap.ref;
//     console.log('Referencia del producto:', productRef);
//     const prodData = prodSnap.data()!;

//     const now = FieldValue.serverTimestamp();
//     const reportRef = db
//       .collection('dailyReports')
//       .doc(getTodayISO());

//     const sise = prodData.sizes.find((s: any) => s.size == Number(size));

//     if (!sise) {
//       return res.status(404).json({ error: 'Producto no encontrado por talla.' });
//     }

//     await db.runTransaction(async tx => {
//       const snap = await tx.get(productRef);
//       const sizesArr: { size: string; quantity: number }[] = snap.data()!.sizes || [];

//       console.log('📦 Sizes antes:', sizesArr);

//       const updatedSizes = sizesArr.map(s => {
//         if (s.size === size) {
//           const newQty = s.quantity - quantity;
//           if (newQty < 0) {
//             throw new Error(`Stock insuficiente para la talla ${size}.`);
//           }
//           return { size, quantity: newQty };
//         }
//         return s;
//       });

//       console.log('🔄 Sizes después:', updatedSizes);
//       const rawApplied = req.body.appliedPrice;
//       const parsedApplied = rawApplied === undefined || rawApplied === null
//         ? NaN
//         : Number(rawApplied);
//       const originalSellPrice = prodData.sellPrice as number;
//       let appliedSellPrice: number;
//       if (!Number.isNaN(parsedApplied) && parsedApplied !== 0) {
//         appliedSellPrice = Math.round(parsedApplied * 100);
//         if (appliedSellPrice < 0) {
//           throw new Error('appliedPrice inválido (negativo)');
//         }
//       } else {
//         appliedSellPrice = originalSellPrice;
//       }
//       const costPrice = prodData.costPrice as number;

//       const subGain = (appliedSellPrice - costPrice) * quantity;


//       const saleRef = db.collection('sales').doc();
//       tx.set(saleRef, {
//         productCode,
//         storeId,
//         quantity,
//         size,
//         costPrice,
//         originalSellPrice,
//         appliedSellPrice,
//         subGain,
//         timestamp: now,
//       });

//       tx.update(productRef, {
//         sizes: updatedSizes,
//         updatedAt: now,
//       });

//       const storeTotalsField = `storeTotals.${storeId}`;
//       tx.set(reportRef, { date: reportRef.id }, { merge: true });
//       tx.update(reportRef, {
//         totalSales: FieldValue.increment(subGain),
//         [storeTotalsField]: FieldValue.increment(subGain),
//       });

//       console.log('✅ Transacción lista');
//     });


//     return res.status(200).json({ message: 'Venta registrada correctamente.' });
//   } catch (err: any) {
//     console.error('Error en registerSale:', err);
//     return res.status(400).json({ error: err.message || 'Error interno.' });
//   }
// });

// export const registerSale = onRequest(app);
