const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');

async function setupDatabase() {
    const db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            name TEXT,
            phone TEXT,
            region TEXT,
            product TEXT,
            payment TEXT,
            price REAL,
            time INTEGER,
            status TEXT DEFAULT 'pending'
        );

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            name TEXT,
            phone TEXT,
            message TEXT,
            time INTEGER
        );

        CREATE TABLE IF NOT EXISTS media (
            type TEXT PRIMARY KEY,
            filename TEXT,
            original_name TEXT,
            size INTEGER,
            time INTEGER
        );
    `);

    // Initialize default password if not set
    const adminPass = await db.get('SELECT value FROM settings WHERE key = ?', 'admin_password');
    if (!adminPass) {
        const hashedPassword = await bcrypt.hash('Ciise000@', 10);
        await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', 'admin_password', hashedPassword);
    }

    return db;
}

module.exports = { setupDatabase };
