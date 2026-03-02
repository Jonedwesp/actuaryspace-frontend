const admin = require("firebase-admin");

// 🟢 Initialize Firebase Admin
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
  // 🛡️ Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      body: "Method Not Allowed" 
    };
  }

  try {
    // 🧠 We now expect 'fileName' from the frontend to target the specific attachment
    const { batchId, fileName } = JSON.parse(event.body);

    if (!batchId || !fileName) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ ok: false, error: "Missing batchId or fileName" }) 
      };
    }

    const docRef = db.collection("extractions").doc(batchId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ ok: false, error: "Batch not found" }) 
      };
    }

    const data = doc.data();
    let metadata = data.fileMetadata || [];
    let fileFound = false;

    // 🎯 Logic: Map through the metadata array and flip the status for the matching file
    const updatedMetadata = metadata.map(file => {
      if (file.originalName === fileName) {
        fileFound = true;
        return { 
          ...file, 
          status: "Approved", // 👈 This turns the UI label green
          processingStatus: "Approved" // Ensuring both naming conventions are covered
        };
      }
      return file;
    });

    if (!fileFound) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ ok: false, error: "Specific file not found in batch metadata" }) 
      };
    }

    // 🚀 Batch update the array back to Firestore
    await docRef.update({
      fileMetadata: updatedMetadata,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ File "${fileName}" in batch ${batchId} marked as APPROVED`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    };

  } catch (error) {
    console.error("Approval Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};