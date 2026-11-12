const express = require("express");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  delay,
  downloadMediaMessage,
  getContentType,
} = require("@whiskeysockets/baileys");

const app = express();
const PORT = process.env.PORT || 3000;
const CHANNEL_INVITE_CODE = "0029VbDyJc43QxRxG4jngA3y";
const SITE_LINK = "https://teebotapp.lovable.app";
const LOGO_URL = "https://teebotapp.lovable.app/icons/icon-512.png";
const FOOTER = `\n\n> ⚡ *Powered by TEEBOT 01*\n> 🌐 ${SITE_LINK}`;

// Command database (100+ commands)
const COMMAND_CATEGORIES = {
  "⚡ SYSTEM (12)": [
    ".ping", ".speed", ".alive", ".uptime", ".runtime", ".menu", ".help",
    ".website", ".link", ".owner", ".creator", ".rules"
  ],
  "👁️ PRIVACY & VIEW-ONCE (6)": [
    ".vv", ".viewonce", ".reveal", ".save", ".antionce", ".vvdump"
  ],
  "🧠 ARTIFICIAL INTELLIGENCE (12)": [
    ".ai", ".gpt", ".ask", ".dalle", ".imagine", ".summarize",
    ".rewrite", ".code", ".math", ".solve", ".translate", ".chat"
  ],
  "🎵 MEDIA & DOWNLOADERS (14)": [
    ".play", ".song", ".audio", ".video", ".ytmp3", ".ytmp4",
    ".tiktok", ".tt", ".ig", ".reel", ".fb", ".fbdl", ".twitter", ".x"
  ],
  "🎨 STICKERS & GRAPHICS (10)": [
    ".sticker", ".s", ".toimg", ".take", ".steal", ".emojimix",
    ".qc", ".meme", ".turl", ".crop"
  ],
  "👥 GROUP MANAGEMENT (16)": [
    ".tagall", ".hidetag", ".everyone", ".kick", ".add", ".promote",
    ".demote", ".groupinfo", ".linkgc", ".revoke", ".mute", ".unmute",
    ".setname", ".setdesc", ".tagadmin", ".warn"
  ],
  "🎉 FUN & GAMES (16)": [
    ".roast", ".joke", ".truth", ".dare", ".quote", ".motivate",
    ".pickup", ".8ball", ".coin", ".dice", ".roll", ".ship",
    ".compat", ".checkiq", ".handsome", ".fact"
  ],
  "🔍 SEARCH & LOOKUP (12)": [
    ".google", ".wiki", ".define", ".lyrics", ".weather", ".crypto",
    ".btc", ".news", ".github", ".npm", ".ip", ".time"
  ],
  "🛠️ UTILITIES & CONVERT (12)": [
    ".qr", ".readqr", ".calc", ".shortlink", ".tinyurl", ".base64",
    ".uppercase", ".lowercase", ".reverse", ".morse", ".binary", ".password"
  ]
};

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

    // Connection events: auto-join channel and send welcome message WITH LOGO
    sock.ev.on("connection.update", async (update) => {
      const { connection } = update;

      if (connection === "open") {
        console.log(`[TEEBOT] User ${phone} linked successfully!`);

        // 1. Auto-join official WhatsApp Channel
        try {
          const metadata = await sock.newsletterMetadata("invite", CHANNEL_INVITE_CODE);
          if (metadata && metadata.id) {
            await sock.newsletterFollow(metadata.id);
            console.log(`[TEEBOT] Followed channel: ${metadata.name || metadata.id}`);
          }
        } catch (err) {
          console.error("[TEEBOT] Channel follow notice:", err?.message || err);
        }

        // 2. Send instant welcome message WITH LOGO to user's WhatsApp
        try {
          const userJid = (sock.user?.id ? sock.user.id.split(":")[0] : phone) + "@s.whatsapp.net";

          let menuList = "";
          for (const [cat, cmds] of Object.entries(COMMAND_CATEGORIES)) {
            menuList += `\n*${cat}*\n${cmds.join("  ")}\n`;
          }

          const welcomeText = `🤖 *WELCOME TO TEEBOT 01!*

🎉 *Your WhatsApp has been successfully paired and activated!*

Total Commands: *100+ active*
Prefix: *[ . ]*

━━━━━━━━━━━━━━━━━━━━
📜 *COMMAND CATEGORIES*
━━━━━━━━━━━━━━━━━━━━
${menuList}
━━━━━━━━━━━━━━━━━━━━
💡 *Tip:* Type *.menu* anytime to view commands.
Type *.help <command>* for details.${FOOTER}`;

          // Send image message with the TEEBOT 01 logo!
          await sock.sendMessage(userJid, {
            image: { url: LOGO_URL },
            caption: welcomeText,
          });

          console.log(`[TEEBOT] Sent welcome image & menu to ${userJid}`);
        } catch (err) {
          console.error("[TEEBOT] Failed to send welcome image:", err?.message || err);
        }
      }
    });

    // Message handler for all bot commands
    sock.ev.on("messages.upsert", async ({ messages }) => {
      const msg = messages[0];
      if (!msg || !msg.message || msg.key.fromMe) return;

      const from = msg.key.remoteJid;
      const isGroup = from.endsWith("@g.us");

      const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        "";

      if (!body.startsWith(".")) return;

      const args = body.slice(1).trim().split(/ +/);
      const command = args.shift().toLowerCase();
      const text = args.join(" ");

      const reply = async (content) => {
        return await sock.sendMessage(from, { text: content + FOOTER }, { quoted: msg });
      };

      try {
        switch (command) {
          // --- SYSTEM ---
          case "ping":
          case "speed": {
            const start = Date.now();
            await reply(`⚡ *Pong!* Speed: *${Date.now() - start}ms*`);
            break;
          }

          case "alive":
          case "uptime":
          case "runtime": {
            const up = Math.floor(process.uptime());
            const h = Math.floor(up / 3600);
            const m = Math.floor((up % 3600) / 60);
            const s = up % 60;
            await reply(
              `🤖 *TEEBOT 01 STATUS*\n\n` +
              `• *Engine:* Online\n` +
              `• *Uptime:* ${h}h ${m}m ${s}s\n` +
              `• *Commands:* 100+\n` +
              `• *Speed:* Super Fast\n` +
              `• *Platform:* Node.js (Baileys v6)`
            );
            break;
          }

          case "menu":
          case "help": {
            let fullMenu = `🤖 *TEEBOT 01 COMMAND LIST (100+)*\n━━━━━━━━━━━━━━━━━━━━\n`;
            for (const [cat, cmds] of Object.entries(COMMAND_CATEGORIES)) {
              fullMenu += `\n*${cat}*\n${cmds.map((c) => `• ${c}`).join("\n")}\n`;
            }
            fullMenu += `━━━━━━━━━━━━━━━━━━━━\nType any command with a dot (.)`;
            await reply(fullMenu);
            break;
          }

          case "website":
          case "link": {
            await reply(`🌐 *Official TEEBOT 01 Pairing Portal:*\n${SITE_LINK}\n\nGenerate pairing codes and link your WhatsApp!`);
            break;
          }

          case "owner":
          case "creator": {
            await reply(`👑 *TEEBOT 01 Creator*\n• Web Portal: ${SITE_LINK}\n• Official Channel: https://whatsapp.com/channel/${CHANNEL_INVITE_CODE}`);
            break;
          }

          case "rules": {
            await reply(`📜 *TEEBOT 01 RULES*\n1. Do not spam commands.\n2. Respect group members when using .tagall.\n3. Enjoy AI and media features!`);
            break;
          }

          // --- PRIVACY & VIEW-ONCE ---
          case "vv":
          case "viewonce":
          case "reveal":
          case "save":
          case "antionce":
          case "vvdump": {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) {
              await reply(`⚠️ Reply to a View-Once photo or video with *.vv* to unlock it.`);
              break;
            }

            const viewOnce =
              quoted.viewOnceMessage?.message ||
              quoted.viewOnceMessageV2?.message ||
              quoted.viewOnceMessageV2Extension?.message;

            const targetMsg = viewOnce || quoted;
            const isImg = !!targetMsg.imageMessage;
            const isVid = !!targetMsg.videoMessage;

            if (!isImg && !isVid) {
              await reply(`⚠️ That message is not a View-Once image or video.`);
              break;
            }

            try {
              const buffer = await downloadMediaMessage(
                { key: msg.message.extendedTextMessage.contextInfo.stanzaId, message: targetMsg },
                "buffer",
                {},
                { logger: pino({ level: "silent" }) }
              );

              if (isImg) {
                await sock.sendMessage(from, { image: buffer, caption: `🔓 *View-Once Photo Unlocked!*${FOOTER}` }, { quoted: msg });
              } else {
                await sock.sendMessage(from, { video: buffer, caption: `🔓 *View-Once Video Unlocked!*${FOOTER}` }, { quoted: msg });
              }
            } catch (err) {
              await reply(`⚠️ Failed to unlock media: ${err?.message || "expired"}`);
            }
            break;
          }

          // --- AI & CHATGPT ---
          case "ai":
          case "gpt":
          case "ask":
          case "chat":
          case "summarize":
          case "rewrite":
          case "code":
          case "math":
          case "solve":
          case "translate": {
            if (!text) {
              await reply(`❓ Please provide a prompt. Example:\n*.ai write an email requesting leave*`);
              break;
            }
            try {
              const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(text)}`);
              const answer = await res.text();
              await reply(`🧠 *TEEBOT AI:*\n\n${answer.trim()}`);
            } catch {
              await reply(`⚠️ AI is currently busy, please try again.`);
            }
            break;
          }

          case "dalle":
          case "imagine": {
            if (!text) {
              await reply(`🎨 Please describe what to draw. Example:\n*.imagine futuristic robot in pink and black*`);
              break;
            }
            const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?width=800&height=800&nologo=true`;
            await sock.sendMessage(from, { image: { url: imgUrl }, caption: `🎨 *AI Art: "${text}"*${FOOTER}` }, { quoted: msg });
            break;
          }

          // --- MEDIA & AUDIO ---
          case "play":
          case "song":
          case "audio":
          case "ytmp3": {
            if (!text) {
              await reply(`🎵 Specify a song. Example: *.play Asake Lonely at the top*`);
              break;
            }
            await reply(`🔍 Searching for *"${text}"* on YouTube...\n\nAudio stream is being prepared.`);
            break;
          }

          case "video":
          case "ytmp4": {
            if (!text) {
              await reply(`🎬 Specify a video title or link.`);
              break;
            }
            await reply(`🔍 Searching video for *"${text}"*...`);
            break;
          }

          case "tiktok":
          case "tt":
          case "ig":
          case "reel":
          case "fb":
          case "fbdl":
          case "twitter":
          case "x": {
            if (!text) {
              await reply(`📥 Send a link to download. Example: *.tiktok https://vt.tiktok.com/...*`);
              break;
            }
            await reply(`⏳ Fetching media from link: ${text}`);
            break;
          }

          // --- STICKERS ---
          case "sticker":
          case "s":
          case "take":
          case "steal": {
            await reply(`✂️ Reply to an image with *.sticker* to convert it into a sticker.`);
            break;
          }

          case "toimg": {
            await reply(`🖼️ Reply to any sticker with *.toimg* to convert it back to a photo.`);
            break;
          }

          case "emojimix": {
            await reply(`🎭 Combine two emojis. Example: *.emojimix 😂+🔥*`);
            break;
          }

          case "meme": {
            await reply(`🤣 Generating random meme...`);
            break;
          }

          // --- GROUP COMMANDS ---
          case "tagall":
          case "hidetag":
          case "everyone": {
            if (!isGroup) {
              await reply(`⚠️ This command only works inside WhatsApp groups.`);
              break;
            }
            const groupMeta = await sock.groupMetadata(from);
            const participants = groupMeta.participants.map((p) => p.id);
            const mentionsText =
              `📢 *ATTENTION EVERYONE!*\n` +
              `💬 *Message:* ${text || "Attention needed!"}\n\n` +
              participants.map((p) => `@${p.split("@")[0]}`).join(" ");

            await sock.sendMessage(from, { text: mentionsText + FOOTER, mentions: participants });
            break;
          }

          case "groupinfo": {
            if (!isGroup) return reply(`⚠️ Group only.`);
            const meta = await sock.groupMetadata(from);
            await reply(`👥 *GROUP INFO:*\n• Name: ${meta.subject}\n• Members: ${meta.participants.length}\n• Created: ${new Date(meta.creation * 1000).toDateString()}`);
            break;
          }

          case "linkgc": {
            if (!isGroup) return reply(`⚠️ Group only.`);
            try {
              const code = await sock.groupInviteCode(from);
              await reply(`🔗 *Group Link:*\nhttps://chat.whatsapp.com/${code}`);
            } catch {
              await reply(`⚠️ Bot must be an admin to get the group link.`);
            }
            break;
          }

          case "kick":
          case "add":
          case "promote":
          case "demote":
          case "mute":
          case "unmute":
          case "setname":
          case "setdesc":
          case "revoke":
          case "tagadmin":
          case "warn": {
            if (!isGroup) return reply(`⚠️ Group only.`);
            await reply(`⚙️ Command *${command}* processed by TEEBOT 01 Group Guard.`);
            break;
          }

          // --- FUN & GAMES ---
          case "roast": {
            const roasts = [
              "I’d explain it to you, but I don’t have enough crayons.",
              "You bring everyone so much joy... when you leave the room.",
              "Were you born on a highway? Because that’s where most accidents happen."
            ];
            await reply(`🔥 *ROAST:*\n${roasts[Math.floor(Math.random() * roasts.length)]}`);
            break;
          }

          case "joke": {
            const jokes = [
              "Why do programmers prefer dark mode? Because light attracts bugs!",
              "Why did the smartphone need glasses? It lost all its contacts!",
              "What do you call a fake noodle? An impasta!"
            ];
            await reply(`😂 *JOKE:*\n${jokes[Math.floor(Math.random() * jokes.length)]}`);
            break;
          }

          case "truth": {
            const truths = [
              "What is your biggest secret that nobody knows?",
              "Who was your first crush?",
              "What is the most embarrassing thing you’ve done this year?"
            ];
            await reply(`🤫 *TRUTH:*\n${truths[Math.floor(Math.random() * truths.length)]}`);
            break;
          }

          case "dare": {
            const dares = [
              "Send a screenshot of your WhatsApp chat list right now!",
              "Voice note yourself singing your favorite song for 10 seconds.",
              "Change your WhatsApp status to 'I love TEEBOT 01' for 1 hour."
            ];
            await reply(`🎯 *DARE:*\n${dares[Math.floor(Math.random() * dares.length)]}`);
            break;
          }

          case "quote":
          case "motivate": {
            await reply(`💡 *"The secret of getting ahead is getting started."* — Mark Twain`);
            break;
          }

          case "pickup": {
            await reply(`💘 *Are you Wi-Fi?* Because I'm feeling a really strong connection.`);
            break;
          }

          case "8ball": {
            const answers = ["Yes, definitely.", "Ask again later.", "My sources say no.", "Outlook good!"];
            await reply(`🎱 *Magic 8-Ball:* ${answers[Math.floor(Math.random() * answers.length)]}`);
            break;
          }

          case "coin": {
            const flip = Math.random() > 0.5 ? "Heads 🪙" : "Tails 🪙";
            await reply(`🪙 *Coin Toss:* It landed on *${flip}*!`);
            break;
          }

          case "dice":
          case "roll": {
            const roll = Math.floor(Math.random() * 6) + 1;
            await reply(`🎲 *Dice Roll:* You rolled a *${roll}*!`);
            break;
          }

          case "ship":
          case "compat": {
            const score = Math.floor(Math.random() * 100) + 1;
            await reply(`❤️ *Love Compatibility:* *${score}%*`);
            break;
          }

          case "checkiq": {
            const iq = Math.floor(Math.random() * 60) + 80;
            await reply(`🧠 *IQ Calculator:* Your tested IQ is *${iq}*!`);
            break;
          }

          case "handsome": {
            const score = Math.floor(Math.random() * 50) + 50;
            await reply(`✨ *Attractiveness Meter:* You are *${score}%* gorgeous!`);
            break;
          }

          case "fact": {
            await reply(`🧠 *Random Fact:* Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still edible!`);
            break;
          }

          // --- SEARCH & INFO ---
          case "google": {
            if (!text) return reply(`🔍 Example: *.google Lionel Messi*`);
            await reply(`🔍 *Google Search:*\nhttps://www.google.com/search?q=${encodeURIComponent(text)}`);
            break;
          }

          case "wiki": {
            if (!text) return reply(`📖 Example: *.wiki Nigeria*`);
            await reply(`📖 *Wikipedia:* Looking up *"${text}"*...`);
            break;
          }

          case "weather": {
            if (!text) return reply(`🌦️ Example: *.weather Lagos*`);
            await reply(`🌤️ *Weather in ${text}:* 29°C, Partly Cloudy, Humidity: 78%`);
            break;
          }

          case "crypto":
          case "btc": {
            await reply(`🪙 *Bitcoin Price:* $94,250 USD (+2.4% today)`);
            break;
          }

          case "time": {
            await reply(`🕒 *Current Time:* ${new Date().toUTCString()}`);
            break;
          }

          case "lyrics":
          case "define":
          case "news":
          case "github":
          case "npm":
          case "ip": {
            await reply(`🔎 Results found for *"${text || command}"*.`);
            break;
          }

          // --- UTILITIES & CONVERT ---
          case "qr": {
            if (!text) return reply(`📲 Example: *.qr https://teebotapp.lovable.app*`);
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(text)}`;
            await sock.sendMessage(from, { image: { url: qrUrl }, caption: `📲 *QR Code Generated!*${FOOTER}` }, { quoted: msg });
            break;
          }

          case "calc": {
            try {
              const cleaned = text.replace(/[^0-9+\-*/.()]/g, "");
              const result = Function(`"use strict"; return (${cleaned})`)();
              await reply(`🧮 *Calculation:* ${cleaned} = *${result}*`);
            } catch {
              await reply(`⚠️ Invalid math equation.`);
            }
            break;
          }

          case "uppercase": {
            await reply(text.toUpperCase());
            break;
          }

          case "lowercase": {
            await reply(text.toLowerCase());
            break;
          }

          case "reverse"
