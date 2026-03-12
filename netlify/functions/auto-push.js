import { schedule } from "@netlify/functions";
import { handler as runLedger } from "./daily-ledger.js";

// "55 21 * * *" means run at 21:55 UTC every single day
export const handler = schedule("55 21 * * *", async () => {
    console.log("⏰ Waking up daily-ledger.js to push to Google Sheets...");
    
    // We pass an empty event object so the script knows this isn't a "live" UI request, 
    // forcing it to bypass the UI return and hit the Google Sheets write block.
    await runLedger({ queryStringParameters: {} });
    
    return { statusCode: 200 };
});