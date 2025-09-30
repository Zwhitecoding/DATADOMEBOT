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
  name: { type: String, required: true },
  content: { type: String, required: true },
  password: { type: String, required: true }
}, { timestamps: true });

const File = mongoose.model('File', FileSchema);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('❌ No file uploaded');
    if (!req.body.password) return res.status(400).send('❌ Password is required');
    const content = req.file.buffer.toString('utf-8');
    const file = new File({
      name: req.file.originalname,
      content,
      password: req.body.password
    });
    await file.save();
    res.send('✅ File uploaded successfully');
  } catch {
    res.status(500).send('❌ Error uploading file');
  }
});

app.get('/files', async (req, res) => {
  try {
    const files = await File.find().sort({ createdAt: -1 });
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

bot.start(async (ctx) => {
  await ctx.replyWithPhoto(
    'https://i.imghippo.com/files/EOm3044jM.png',
    {
      caption: '👋 Welcome to Toshi Datadome Bot Shop!\n\n🔥 Premium and Fresh Datadome\n💰 Affordable Prices\n\n📂 Use /files to see available TXT\n\n👨‍💻 Developer: @toshidevmain'
    }
  );
});

async function sendFilesPage(ctx, page) {
  const totalFiles = await File.countDocuments();
  const totalPages = Math.ceil(totalFiles / PAGE_SIZE);
  if (page < 0) page = 0;
  if (page >= totalPages) page = totalPages - 1;
  userPages[ctx.chat.id] = page;
  const files = await File.find().sort({ createdAt: -1 }).skip(page * PAGE_SIZE).limit(PAGE_SIZE);
  if (files.length === 0) return ctx.reply('📂 No files available.');
  const buttons = files.map(file => [Markup.button.callback(file.name, `file_${file._id}`)]);
  const nav = [];
  if (page > 0) nav.push(Markup.button.callback('⬅ Prev', 'prev_page'));
  if (page < totalPages - 1) nav.push(Markup.button.callback('Next ➡', 'next_page'));
  if (nav.length > 0) buttons.push(nav);
  await ctx.reply('📂 Available Files:', Markup.inlineKeyboard(buttons));
}

bot.command('files', async (ctx) => {
  await sendFilesPage(ctx, 0);
});

bot.action('next_page', async (ctx) => {
  const page = (userPages[ctx.chat.id] || 0) + 1;
  await ctx.deleteMessage();
  await sendFilesPage(ctx, page);
});

bot.action('prev_page', async (ctx) => {
  const page = (userPages[ctx.chat.id] || 0) - 1;
  await ctx.deleteMessage();
  await sendFilesPage(ctx, page);
});

bot.action(/file_(.+)/, async (ctx) => {
  const fileId = ctx.match[1];
  const file = await File.findById(fileId);
  if (!file) return ctx.reply('❌ File not found.');
  userSessions[ctx.chat.id] = fileId;
  ctx.reply('🔑 Please enter the password for this file:');
});

bot.on('text', async (ctx) => {
  const fileId = userSessions[ctx.chat.id];
  if (!fileId) return;
  const file = await File.findById(fileId);
  if (!file) {
    delete userSessions[ctx.chat.id];
    return ctx.reply('❌ File not found.');
  }
  if (ctx.message.text !== file.password) {
    return ctx.reply('❌ Incorrect password. Try again.');
  }
  delete userSessions[ctx.chat.id];
  const filePath = path.join(os.tmpdir(), `${file.name}.txt`);
  fs.writeFileSync(filePath, file.content);
  await ctx.replyWithDocument({ source: filePath, filename: `${file.name}.txt` });
  fs.unlinkSync(filePath);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
bot.launch();
