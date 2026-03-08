export default function ReviewCompareWorkstation({ reviewingDoc, email, batchStatus, setReviewingDoc, handleApprove }) {
  const sourcePdf = email.attachments.find(a => a.name.toLowerCase().includes(reviewingDoc.label.toLowerCase().split(' ')[0])) || email.attachments[0];

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "#fff", zIndex: 2000, display: "flex", flexDirection: "column" }}>
      {/* Header Bar */}
      <div style={{ padding: "12px 24px", borderBottom: "1px solid #dadce0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={() => setReviewingDoc(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "#5f6368", display: "grid", placeItems: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 500, color: "#1f1f1f", fontFamily: "'Google Sans', Roboto, sans-serif" }}>Review & Compare: {reviewingDoc.label}</h3>
        </div>
        <button
          className="btn blue"
          onClick={() => { handleApprove(reviewingDoc.label); setReviewingDoc(null); }}
          style={{ padding: "8px 24px", borderRadius: "24px", fontSize: "14px", fontWeight: 500 }}
        >
          Confirm & Approve Data
        </button>
      </div>

      {/* Split Screen Container */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT PANEL: Extracted Data Table */}
        <div style={{ flex: 1, padding: "24px", overflowY: "auto", borderRight: "1px solid #dadce0", background: "#f8f9fa" }}>
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#5f6368", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "4px" }}>AI Extraction Results</div>
            <div style={{ fontSize: "13px", color: "#444746" }}>Verify the extracted values against the source document on the right.</div>
          </div>

          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, background: "#fff", borderRadius: "8px", border: "1px solid #dadce0", overflow: "hidden" }}>
            <thead>
              <tr style={{ background: "#f1f3f4", textAlign: "left" }}>
                <th style={{ padding: "12px 16px", fontSize: "12px", color: "#5f6368", borderBottom: "1px solid #dadce0", fontWeight: 600 }}>FIELD NAME</th>
                <th style={{ padding: "12px 16px", fontSize: "12px", color: "#5f6368", borderBottom: "1px solid #dadce0", fontWeight: 600 }}>EXTRACTED VALUE</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const keyMap = { "Payslips": "payslips", "IP Reports": "ipReports", "SA IDs": "saIds", "Birth Certs": "birthCerts", "Death Certs": "deathCerts", "Bank Statements": "bankStatements" };
                const dataKey = keyMap[reviewingDoc.label];
                const realData = batchStatus?.extractedData?.[dataKey];

                if (!realData) {
                  return (
                    <tr>
                      <td colSpan="2" style={{ padding: "40px", textAlign: "center", color: "#5f6368", fontStyle: "italic", fontSize: "14px" }}>
                        No extraction data found for this document type.
                      </td>
                    </tr>
                  );
                }

                return Object.entries(realData).map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 600, borderBottom: "1px solid #f1f3f4", color: "#444746", width: "40%", background: "#fcfcfc" }}>
                      {k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "13px", borderBottom: "1px solid #f1f3f4", color: "#1f1f1f" }}>
                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>

        {/* RIGHT PANEL: Source Document PDF */}
        <div style={{ flex: 1, background: "#525659", display: "flex", flexDirection: "column" }}>
          <iframe
            src={sourcePdf?.url}
            title="Source PDF"
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        </div>
      </div>
    </div>
  );
}
