export const handler = async (event) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "API Key missing" }) };
    }

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        modalities: ["audio", "text"],
      }),
    });

    const data = await response.json();

    // Check if OpenAI actually gave us a token
    if (!data.client_secret || !data.client_secret.value) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: "Invalid response from OpenAI", details: data }) 
      };
    }

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // Prevents CORS issues during local dev
      },
      // Return the nested structure the library expects
      body: JSON.stringify({ 
        client_secret: { 
          value: data.client_secret.value 
        } 
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};