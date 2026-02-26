// netlify/functions/gmail-contacts.js
import { getAccessToken } from "./_sa-token.js";

export async function handler(event, context) {
  try {
    // Replace with the exact email you are impersonating in your other endpoints
    const userToImpersonate = "siyabonga@actuaryconsulting.co.za"; 
    
    // We pass the new scope right here
    const scopes = [
      "https://www.googleapis.com/auth/contacts.other.readonly"
    ];
    
    const token = await getAccessToken(scopes, userToImpersonate);

    // Call the People API using the generated access token
    const res = await fetch("https://people.googleapis.com/v1/otherContacts?readMask=names,emailAddresses&pageSize=1000", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || "Google API returned an error");
    }

    const contactsMap = {};

    if (data.otherContacts) {
      data.otherContacts.forEach(contact => {
        const name = contact.names?.[0]?.displayName;
        const email = contact.emailAddresses?.[0]?.value;

        if (name && email) {
          contactsMap[name] = email;
        } else if (!name && email) {
          const fallbackName = email.split('@')[0];
          contactsMap[fallbackName] = email;
        }
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, contacts: contactsMap }),
    };
  } catch (error) {
    console.error("contacts fetch error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: error.message }),
    };
  }
}