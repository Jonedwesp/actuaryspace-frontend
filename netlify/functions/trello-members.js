// netlify/functions/trello-members.js
exports.handler = async (event, context) => {
  const TRELLO_KEY = process.env.TRELLO_API_KEY || process.env.TRELLO_KEY;
  const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
  const BOARD_ID = process.env.TRELLO_BOARD_ID;

  if (!TRELLO_KEY || !TRELLO_TOKEN || !BOARD_ID) {
    return { statusCode: 500, body: JSON.stringify({ error: "Missing Trello credentials in env" }) };
  }

  try {
    // Fetch all members on the board
    const url = `https://api.trello.com/1/boards/${BOARD_ID}/members?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error(`Trello API responded with ${response.status}`);
    
    const members = await response.json();

    // Clean up the data to just what we need (Name, ID, and Avatar URL)
    const formattedMembers = members.map(m => ({
      id: m.id,
      fullName: m.fullName,
      username: m.username,
      // Trello provides a base URL; we append /50.png for the standard avatar size
      avatarUrl: m.avatarUrl ? `${m.avatarUrl}/50.png` : null 
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, members: formattedMembers })
    };
  } catch (error) {
    console.error("Trello Members Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
};