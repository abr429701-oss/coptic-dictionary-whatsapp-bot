import 'dotenv/config';
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import { search, formatResult } from './search.js';

const phone = (process.env.WHATSAPP_PHONE_NUMBER ?? '').replace(/\D/g, '');
const allowed = new Set((process.env.ALLOWED_CHAT_IDS ?? '').split(',').map(x => x.trim()).filter(Boolean));
if (!phone) {
  console.error('Set WHATSAPP_PHONE_NUMBER in .env (international format, digits only).');
  process.exit(1);
}
const logger = pino({ level: process.env.LOG_LEVEL ?? 'silent' });
const help = 'أهلًا بك في القاموس القبطي البحيري.\nأرسل كلمة بالعربية أو القبطية أو اليونانية أو الإنجليزية أو الفرنسية أو الألمانية للبحث.\nالأوامر: /start — /help — /stats';
let socket;
let pairingRequested = false;
const seen = new Set();

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  socket = makeWASocket({ auth: state, logger, printQRInTerminal: false, browser: ['Coptic Dictionary', 'Chrome', '1.0.0'] });
  socket.ev.on('creds.update', saveCreds);
  socket.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') console.log('WhatsApp connected. Bot is ready.');
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log('Connection interrupted; reconnecting...');
        setTimeout(() => connect().catch(console.error), 3000);
      } else console.error('WhatsApp session logged out. Remove auth_info and pair again.');
    }
    if (!state.creds.registered && !pairingRequested && connection !== 'close') {
      pairingRequested = true;
      try {
        const code = await socket.requestPairingCode(phone);
        console.log(`WhatsApp pairing code: ${code}`);
        console.log('Enter this code on the phone in WhatsApp > Linked devices > Link a device > Link with phone number instead.');
      } catch (error) {
        pairingRequested = false;
        console.error('Could not request pairing code:', error.message);
      }
    }
  });
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      const id = msg.key?.id;
      const jid = msg.key?.remoteJid;
      if (!id || !jid || msg.key.fromMe || jid.endsWith('@g.us') || seen.has(id)) continue;
      if (allowed.size && !allowed.has(jid)) continue;
      const body = msg.message?.conversation ?? msg.message?.extendedTextMessage?.text ?? msg.message?.imageMessage?.caption ?? '';
      const text = body.trim();
      if (!text) continue;
      seen.add(id);
      if (seen.size > 1000) seen.clear();
      let reply;
      if (/^\/(start|help)(@\w+)?$/iu.test(text)) reply = help;
      else if (/^\/stats$/iu.test(text)) reply = `عدد مفردات القاموس: 16,327`;
      else {
        const results = search(text, 5);
        reply = results.length ? results.map(formatResult).join('\n\n──────────\n\n') : 'لم أجد نتيجة مطابقة. جرّب كتابة الكلمة أو جزء منها بلغة أخرى.';
      }
      try { await socket.sendMessage(jid, { text: reply }, { quoted: msg }); }
      catch (error) { console.error('Could not send reply:', error.message); }
    }
  });
}

connect().catch(error => { console.error('Bot startup failed:', error); process.exit(1); });
process.on('SIGINT', async () => { try { await socket?.end(undefined); } finally { process.exit(0); } });
