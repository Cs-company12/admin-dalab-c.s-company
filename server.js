const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const { setupDatabase } = require('./database');
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(session({
    secret: 'cs-company-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

let db;

// Auth Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.admin) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.post('/api/login', async (req, res) => {
    const { password } = req.body;
    const adminPass = await db.get('SELECT value FROM settings WHERE key = ?', 'admin_password');
    if (await bcrypt.compare(password, adminPass.value)) {
        req.session.admin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Orders API
app.get('/api/orders', isAuthenticated, async (req, res) => {
    const orders = await db.all('SELECT * FROM orders ORDER BY time DESC');
    res.json(orders);
});

app.post('/api/orders/toggle-status', isAuthenticated, async (req, res) => {
    const { id } = req.body;
    const order = await db.get('SELECT status FROM orders WHERE id = ?', id);
    if (order) {
        const newStatus = order.status === 'paid' ? 'pending' : 'paid';
        await db.run('UPDATE orders SET status = ? WHERE id = ?', newStatus, id);
        res.json({ success: true, status: newStatus });
    } else {
        res.status(404).json({ error: 'Order not found' });
    }
});

app.delete('/api/orders/:id', isAuthenticated, async (req, res) => {
    await db.run('DELETE FROM orders WHERE id = ?', req.params.id);
    res.json({ success: true });
});

app.delete('/api/orders', isAuthenticated, async (req, res) => {
    await db.run('DELETE FROM orders');
    res.json({ success: true });
});

// Messages API
app.get('/api/messages', isAuthenticated, async (req, res) => {
    const messages = await db.all('SELECT * FROM messages ORDER BY time DESC');
    res.json(messages);
});

app.delete('/api/messages/:id', isAuthenticated, async (req, res) => {
    await db.run('DELETE FROM messages WHERE id = ?', req.params.id);
    res.json({ success: true });
});

// Media API
app.post('/api/upload/:type', isAuthenticated, upload.single('file'), async (req, res) => {
    const { type } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // Delete old file if exists
    const oldMedia = await db.get('SELECT filename FROM media WHERE type = ?', type);
    if (oldMedia) {
        const oldPath = path.join(__dirname, 'public/uploads', oldMedia.filename);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await db.run('INSERT OR REPLACE INTO media (type, filename, original_name, size, time) VALUES (?, ?, ?, ?, ?)',
        type, file.filename, file.originalname, file.size, Date.now());

    res.json({ success: true, filename: file.filename });
});

app.get('/api/media', async (req, res) => {
    const media = await db.all('SELECT * FROM media');
    const mediaMap = {};
    media.forEach(m => mediaMap[m.type] = m);
    res.json(mediaMap);
});

// Broadcast API
app.post('/api/broadcast', isAuthenticated, async (req, res) => {
    const { message } = req.body;
    await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'broadcast', JSON.stringify({ message, time: Date.now() }));
    res.json({ success: true });
});

app.get('/api/broadcast', async (req, res) => {
    const broadcast = await db.get('SELECT value FROM settings WHERE key = ?', 'broadcast');
    res.json(broadcast ? JSON.parse(broadcast.value) : null);
});

app.delete('/api/broadcast', isAuthenticated, async (req, res) => {
    await db.run('DELETE FROM settings WHERE key = ?', 'broadcast');
    res.json({ success: true });
});

// Stats API
app.get('/api/stats', isAuthenticated, async (req, res) => {
    const totalOrders = await db.get('SELECT COUNT(*) as count FROM orders');
    const totalRevenue = await db.get('SELECT SUM(price) as sum FROM orders');
    const pendingOrders = await db.get('SELECT COUNT(*) as count FROM orders WHERE status = \"pending\"');
    const totalMessages = await db.get('SELECT COUNT(*) as count FROM messages');

    res.json({
        totalOrders: totalOrders.count,
        totalRevenue: totalRevenue.sum || 0,
        pendingOrders: pendingOrders.count,
        totalMessages: totalMessages.count
    });
});

// Initialize DB and Start Server
setupDatabase().then(database => {
    db = database;
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
});
