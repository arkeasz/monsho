import { scheduler } from 'firebase-functions/v2';

export const generateDailyReport = scheduler.onSchedule(
  {
    schedule: '0 0 * * *',
    timeZone: 'America/Lima',
  },
  async () => {
    try {
      const adminModule = await import('firebase-admin');
      const admin = (adminModule as any).default ?? adminModule;

      if (!admin.apps.length) {
        admin.initializeApp();
      }
      const db = admin.firestore();

      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }); // 'YYYY-MM-DD'
      const docRef = db.collection('dailyReports').doc(today);
      const snap = await docRef.get();

      if (!snap.exists) {
        await docRef.set({
          date: today,
          storeTotals: {},
          totalSales: 0,
          totalExpenses: 0,
          utilities: 0,
          meta: { otherExpenseIds: [], storeIds: [] },
          createdAt: admin.firestore.FieldValue.serverTimestamp(), // sentinel server timestamp
        });
        console.log(`dailyReport creado para ${today}`);
      } else {
        console.log(`dailyReport de ${today} ya existe`);
      }
    } catch (err) {
      console.error('Error generando dailyReport:', err);
    }
  }
);
