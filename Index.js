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
const CHANNEL_INVITE_CODE = "0029VbDyJc43QxRxG4jngA3y";

app.get("/pair", async (req, res) => {
  const phone = (req.query.number || "").replace(/[^0-9]/g, "");

  if (!phone || phone.length < 8 || phone.length > 15) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(`./session-${phone}`);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: pino({ level: "silent" }),
      auth: state,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    sock.ev.on("creds.update", saveCreds);

    // Listen for when the user successfully links their phone
    sock.ev.on("connection.update", async (update) => {
      const { connection } = update;
      if (connection === "open") {
        console.log(`[TEEBOT] User ${phone} linked successfully! Auto-joining channel...`);
        try {
          // Look up channel by invite code and follow it
          const metadata = await sock.newsletterMetadata("invite", CHANNEL_INVITE_CODE);
          if (metadata && metadata.id) {
            await sock.newsletterFollow(metadata.id);
            console.log(`[TEEBOT] Successfully followed channel: ${metadata.name || metadata.id}`);
          }
        } catch (err) {
          console.error("[TEEBOT] Failed to auto-follow channel:", err?.message || err);
        }
      }
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

app.listen(PORT, () => {
  console.log(`TEEBOT 01 server listening on port ${PORT}`);
});
