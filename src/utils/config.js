export const PERSONA = import.meta.env.VITE_PERSONA || "UNKNOWN";

export const PERSONA_TRELLO_LISTS =
  PERSONA.toUpperCase() === "SIYA"
    ? {
        "Siya": "67aa20a74651c164d70879a1",
        "Siya - Review": "67aa209b1abf103b4223fedf",
        "Bonisa": "6969ea42c830ba8c7219da93",
        "Songeziwe": "67cac6af8cdf1f1e1e0d38cb",
        "Enock": "67aa20b2f2da48a648c5d3dc"
      }
    : PERSONA.toUpperCase() === "YOLANDIE"
    ? {
        "Yolandie to Data Capture": "690856847c60cd96de11c83b",
        "Yolandie to Analyst": "67aae1c8d05dfe5ea1ce6ad5",
        "Yolandie to Data Analyst": "67c7eea534dda21cf79700ba",
        "Yolandie to Reviewer": "664f7e6c906b59f6fbd38911",
        "Yolandie to Send": "67ab4073f589aa2d9cf3e99a"
      }
    : {};