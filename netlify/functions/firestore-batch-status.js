import admin from 'firebase-admin';

let db = null;

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
  db = admin.firestore();
}

export const handler = async (event) => {
  if (!db) return { statusCode: 200, body: JSON.stringify({ ok: false, error: "Firebase not configured" }) };

  const messageId = event.queryStringParameters.messageId;
  if (!messageId) return { statusCode: 400, body: JSON.stringify({ ok: false }) };

  try {
    const snapshot = await db.collection("extractions")
      .where("messageId", "==", messageId)
      .limit(1)
      .get();

    if (snapshot.empty) return { statusCode: 200, body: JSON.stringify({ ok: false }) };

    const doc = snapshot.docs[0];
    const data = doc.data();

    // 🧠 LOGIC: Group identification counts and status by original filename
    // Note: This assumes your n8n workflow populates 'fileMetadata' or similar
    const fileResults = (data.fileMetadata || []).map(file => {
      const counts = [];
      if (file.payslipCount > 0) counts.push(`${file.payslipCount} payslip${file.payslipCount > 1 ? 's' : ''}`);
      if (file.ipCount > 0) counts.push(`${file.ipCount} IP`);
      if (file.idCount > 0) counts.push(`${file.idCount} ID`);
      if (file.birthCertCount > 0) counts.push(`${file.birthCertCount} Birth Cert`);

      return {
        fileName: file.originalName,
        foundDocs: counts.length > 0 ? counts : [],
        status: file.processingStatus || "Extracting..."
      };
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        batchId: doc.id,
        status: data.status,
        totalPages: data.totalPages,
        pagesProcessed: data.pagesProcessed,
        fileResults: fileResults, // 👈 Feeds the per-file UI
        extractedData: data.extractedData || {}
      })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};