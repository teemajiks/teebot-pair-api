const express = require("express");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  delay,
} = require("@whiskeysockets/baileys");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/pair", async (req, res) => {
  const phone = (req.query.number || "").replace(/[^0-9]/g, "");

  if (!phone || phone.length < 8 || phone.length > 15) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  try {
    const { state } = await useMultiFileAuthState(`/tmp/auth-${phone}-${Date.now()}`);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: pino({ level: "silent" }),
      auth: state,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    await delay(2000);
    const code = await sock.requestPairingCode(phone);

    return res.json({ code });
  } catch (err) {
    console.error("Pairing error:", err);
    return res.status(500).json({ error: "Failed to generate pairing code" });
  }
});

app.get("/", (req, res) => res.send("TEEBOT 01 Pairing API is running"));

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
