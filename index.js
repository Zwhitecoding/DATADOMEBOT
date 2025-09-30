const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BOT_TOKEN = '8328601655:AAETYC1rYUVGvBbmQS0Dbsj3SoHUqwIiukI';
const MONGO_URI = 'mongodb+srv://toshidev0:zcode22107@dbtxt.3dxoaud.mongodb.net/DATADOME';
const ADMIN_ID = '8183360446';
const PAGE_SIZE = 5;

const app = express();
const bot = new Telegraf(BOT_TOKEN);

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const FileSchema = new mongoose.Schema({
  name: String,
  content: String,
  password: String
}, { timestamps: true });
const File = mongoose.model('File', FileSchema);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post('/upload', upload.single('file'), async (req, res) => {
  const { password } = req.body;
  if (!req.file || !password) return res.status(400).send('❌ Missing file or password');
  const content = req.file.buffer.toString('utf-8');
  const file = new File({ name: req.file.originalname, content, password });
  await file.save();
  res.send('✅ File uploaded successfully');
});

app.get('/files', async (req, res) => {
  const files = await File.find().sort({ _id: -1 });
  res.json(files);
});

app.delete('/files/:id', async (req, res) => {
  try {
    await File.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const userSessions = {};
const userPages = {};
const receiptSessions = {};

bot.start((ctx) => {
  ctx.replyWithPhoto('https://i.imghippo.com/files/EOm3044jM.png', {
    caption: '👋 ᴡᴇʟᴄᴏᴍᴇ ᴛᴏ sᴀɪᴄʜɪ ᴅᴀᴛᴀᴅᴏᴍᴇ ʙᴏᴛ!\n\n🔥 ᴘʀᴇᴍɪᴜᴍ ᴀɴᴅ ғʀᴇsʜ ᴅᴀᴛᴀᴅᴏᴍᴇ\n💰 ᴀғғᴏʀᴅᴀʙʟᴇ ᴘʀɪᴄᴇs \n\n 500ʟɪɴᴇs - 50\n1000ʟɪɴᴇs - 80 \n\n📂 ᴜsᴇ /files ᴛᴏ sᴇᴇ ᴀᴠᴀɪʟᴀʙʟᴇ ᴛxᴛ\n\n👨‍💻 ᴅᴇᴠᴇʟᴏᴘᴇʀ: @toshidevmain'
  });
  const userId = ctx.from.id;
  const username = ctx.from.username || 'N/A';
  const name = `${ctx.from.first_name} ${ctx.from.last_name || ''}`;
  const userMessage = `🆕 ɴᴇᴡ ᴜsᴇʀ!\n\nID: ${userId}\nᴜsᴇʀɴᴀᴍᴇ: @${username}\nɴᴀᴍᴇ: ${name}`;
  bot.telegram.sendMessage(ADMIN_ID, userMessage);
});

bot.command('files', async (ctx) => {
  const userId = ctx.from.id;
  userPages[userId] = 0;
  await sendFilesPage(ctx, userId, 0);
});

bot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;
  const data = ctx.callbackQuery.data;
  if (data.startsWith('PAGE_')) {
    const direction = data.split('_')[1];
    userPages[userId] = userPages[userId] || 0;
    if (direction === 'NEXT') userPages[userId]++;
    if (direction === 'BACK') userPages[userId]--;
    await updateFilesPage(ctx, userId, userPages[userId], ctx.callbackQuery.message.message_id);
    return ctx.answerCbQuery();
  }
  if (data.startsWith('FILE_')) {
    const fileId = data.split('_')[1];
    userSessions[userId] = { fileId, waitingForReceipt: true };
    ctx.answerCbQuery();
    await ctx.replyWithPhoto('https://i.postimg.cc/CKbVJf0g/GCash-My-QR-29092025125747-PNG.jpg', {
      caption: '📸 ᴀғᴛᴇʀ ᴘᴀʏᴍᴇɴᴛ, ʀᴇᴘʟʏ ᴛʜɪs ᴍᴇssᴀɢᴇ ᴡɪᴛʜ ʏᴏᴜʀ ʀᴇᴄᴇɪᴘᴛ ғᴏʀ ᴀᴅᴍɪɴ ʀᴇᴠɪᴇᴡ.'
    });
  }
});

bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const session = userSessions[userId];
  if (!session || !session.waitingForReceipt || !session.fileId) return;
  const file = await File.findById(session.fileId);
  const userName = ctx.from.username || `${ctx.from.first_name} ${ctx.from.last_name || ''}`;
  const caption = `🧾 New payment receipt from @${userName} (ID: ${userId})\nFile: ${file?.name || 'Unknown'}\n\nReply with the password to release the file.`;
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const fileId = photo.file_id;
  const sentMsg = await ctx.telegram.sendPhoto(ADMIN_ID, fileId, { caption });
  receiptSessions[sentMsg.message_id] = { userId, fileId: session.fileId };
  await ctx.reply('✅ ᴘᴀʏᴍᴇɴᴛ ʀᴇᴄᴇɪᴘᴛ ʀᴇᴄᴇɪᴠᴇᴅ\n\nᴘʟᴇᴀsᴇ ᴡᴀɪᴛ ғᴏʀ ᴛʜᴇ ᴀᴅᴍɪɴ ᴀᴘᴘʀᴏᴠᴀʟ.');
  delete userSessions[userId];
});

bot.on('message', async (ctx) => {
  const isAdmin = ctx.from.id.toString() === ADMIN_ID.toString();
  if (!isAdmin || !ctx.message.reply_to_message || !ctx.message.text) return;
  const repliedMsgId = ctx.message.reply_to_message.message_id;
  const password = ctx.message.text;
  const session = receiptSessions[repliedMsgId];
  if (!session) return;
  const { userId, fileId } = session;
  const file = await File.findById(fileId);
  if (!file) {
    ctx.reply('❌ File not found or already deleted.');
    return;
  }
  if (file.password !== password) {
    ctx.reply('❌ Incorrect password for that file.');
    return;
  }
  const tempPath = path.join(os.tmpdir(), `${Date.now()}-${file.name}`);
  fs.writeFileSync(tempPath, file.content);
  await ctx.telegram.sendDocument(userId, { source: tempPath, filename: file.name });
  await ctx.telegram.sendMessage(userId, '✅ ᴀᴅᴍɪɴ ᴄᴏɴғɪʀᴍᴇᴅ ʏᴏᴜʀ ʀᴇᴄᴇɪᴘᴛ\n\nғɪʟᴇ ᴡɪʟʟ ʙᴇ ʀᴇʟᴇᴀsᴇ ᴛʜᴀɴᴋ ʏᴏᴜ ғᴏʀ ᴡᴀɪᴛɪɴɢ.');
  await File.deleteOne({ _id: file._id });
  fs.unlinkSync(tempPath);
  await ctx.telegram.deleteMessage(ADMIN_ID, repliedMsgId);
  delete receiptSessions[repliedMsgId];
});

async function sendFilesPage(ctx, userId, page) {
  const totalFiles = await File.countDocuments();
  const totalPages = Math.ceil(totalFiles / PAGE_SIZE);
  const skip = page * PAGE_SIZE;
  const files = await File.find().skip(skip).limit(PAGE_SIZE);
  if (!files.length) return ctx.reply('⚠️ No files found on this page.');
  const buttons = files.map(file => [Markup.button.callback(file.name, `FILE_${file._id}`)]);
  buttons.push([
    Markup.button.callback('⬅️ Back', 'PAGE_BACK'),
    Markup.button.callback('➡️ Next', 'PAGE_NEXT')
  ]);
  ctx.reply(`📄 Page ${page + 1} of ${totalPages}`, Markup.inlineKeyboard(buttons));
}

async function updateFilesPage(ctx, userId, page, messageId) {
  const totalFiles = await File.countDocuments();
  const totalPages = Math.ceil(totalFiles / PAGE_SIZE);
  const skip = page * PAGE_SIZE;
  const files = await File.find().skip(skip).limit(PAGE_SIZE);
  if (!files.length) return ctx.reply('⚠️ No files found on this page.');
  const buttons = files.map(file => [Markup.button.callback(file.name, `FILE_${file._id}`)]);
  buttons.push([
    Markup.button.callback('⬅️ Back', 'PAGE_BACK'),
    Markup.button.callback('➡️ Next', 'PAGE_NEXT')
  ]);
  await ctx.telegram.editMessageText(ctx.chat.id, messageId, undefined, `📄 Page ${page + 1} of ${totalPages}`, {
    reply_markup: Markup.inlineKeyboard(buttons).reply_markup
  });
}

bot.launch();
app.listen(3000, () => console.log('Web server running at http://localhost:3000'));
