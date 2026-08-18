import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function setup() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'hotspot_db'}\`;`);
    console.log(`Database ${process.env.DB_NAME || 'hotspot_db'} ensured!`);
    await connection.end();
}

setup().catch(console.error);
