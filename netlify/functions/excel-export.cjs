const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { batchId } = JSON.parse(event.body);
    if (!batchId) return { statusCode: 400, body: "Missing batchId" };

    const doc = await db.collection("extractions").doc(batchId).get();
    if (!doc.exists) return { statusCode: 404, body: "Batch not found" };

    const data = doc.data();
    const extractions = data.extractedData || {};

    // 🧠 CONSOLIDATION LOGIC: Flatten all categories into one sheet
    const rows = [];
    Object.entries(extractions).forEach(([category, fields]) => {
      // Only include fields that have actual data
      if (fields && typeof fields === 'object') {
        Object.entries(fields).forEach(([fieldName, value]) => {
          rows.push({
            Category: category.toUpperCase(),
            Field: fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
            Value: typeof value === 'object' ? JSON.stringify(value) : value
          });
        });
      }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true, 
        rows,
        filename: `Extraction_Batch_${batchId.slice(0, 8)}.csv` 
      })
    };

  } catch (error) {
    console.error("Excel Export Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};