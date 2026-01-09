const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function seed() {
    const db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });

    const now = Date.now();
    
    // Add sample orders
    await db.run(`INSERT INTO orders (id, name, phone, region, product, payment, price, time, status) VALUES 
        ('ORD001', 'Ahmed Ali', '252615000000', 'Banadir', 'Pharmacy System', 'EVC Plus', 150, ?, 'pending'),
        ('ORD002', 'Fartun Mohamed', '252615111111', 'Hiran', 'Hospital System', 'e-Dahab', 300, ?, 'paid')`,
        now, now - 3600000);

    // Add sample messages
    await db.run(`INSERT INTO messages (id, name, phone, message, time) VALUES 
        ('MSG001', 'Omar Geedi', '252615222222', 'I want to know more about the Pharmacy system.', ?)`,
        now - 7200000);

    console.log('Sample data seeded successfully.');
    await db.close();
}

seed();
