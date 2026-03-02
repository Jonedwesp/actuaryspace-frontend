import { getAccessToken } from "./_sa-token.js";

export const handler = async function(event, context) {
  const messageId = event.queryStringParameters?.messageId;

  if (!messageId) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing messageId parameter" }) };
  }

  try {
    // 1. Get Auth Token for Firestore
    const token = await getAccessToken(["https://www.googleapis.com/auth/datastore"]);

    // 2. Query Firestore for the specific messageId
    const projectId = "payslip-ai-extraction";
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: "batch_summary_DEV" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "messageId" },
            op: "EQUAL",
            value: { stringValue: messageId }
          }
        },
        limit: 1
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(queryBody)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(`Firestore Error: ${JSON.stringify(data)}`);
    }

    // Firestore returns [{readTime}] if no document is found
    if (!data || data.length === 0 || !data[0].document) {
       return {
         statusCode: 200,
         body: JSON.stringify({ found: false })
       };
    }

    // 3. Extract and clean the fields for the frontend
    const doc = data[0].document;
    const rawFields = doc.fields || {};
    
    const unwrap = (val) => {
        if (!val) return null;
        if (val.stringValue !== undefined) return val.stringValue;
        if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
        if (val.nullValue !== undefined) return null;
        return val; 
    };

    const result = {
        found: true,
        batchId: unwrap(rawFields.batchId),
        status: unwrap(rawFields.status),
        totalPages: unwrap(rawFields.totalPages),
        pagesProcessed: unwrap(rawFields.pagesProcessed),
        classificationStatus: unwrap(rawFields.classificationStatus),
        payslipStatus: unwrap(rawFields.payslipProcessingStatus),
        ipStatus: unwrap(rawFields.ipReportProcessingStatus),
        saIdStatus: unwrap(rawFields.saIdProcessingStatus),
        birthCertStatus: unwrap(rawFields.birthCertProcessingStatus),
        deathCertStatus: unwrap(rawFields.deathCertProcessingStatus),
        bankStatus: unwrap(rawFields.bankStatementProcessingStatus)
    };

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error("Firestore Poller Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};