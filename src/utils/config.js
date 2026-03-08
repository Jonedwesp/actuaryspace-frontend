export const PERSONA = import.meta.env.VITE_PERSONA || "UNKNOWN";

export const PERSONA_TRELLO_LISTS =
  PERSONA.toUpperCase() === "SIYA"
    ? [
        "Siya",
        "Siya - Review",
        "Bonisa",
        "Songeziwe",
        "Enock"
      ]
    : PERSONA.toUpperCase() === "YOLANDIE"
    ? [
        "Yolandie to Data Capture",
        "Yolandie to Analyst",
        "Yolandie to Data Analyst",
        "Yolandie to Reviewer",
        "Yolandie to Send",
      ]
    : [];
