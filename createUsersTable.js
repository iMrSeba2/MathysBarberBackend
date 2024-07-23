const { Pool } = require('pg');
const dotenv = require('dotenv');
const moment = require('moment-timezone'); // Usamos moment-timezone para manejar la zona horaria

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false
  }
});

const createDateTable = async () => {
  const dropTableQuery = `
    DROP TABLE IF EXISTS date;
  `;
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS date (
      date_id SERIAL PRIMARY KEY,
      date DATE NOT NULL UNIQUE
    );
  `;

  try {
    await pool.query(dropTableQuery);
    await pool.query(createTableQuery);
    console.log('Table "date" created successfully.');

    // Insert dates into the table
    const today = moment().tz('America/Santiago').startOf('day');
    const sunday = today.clone().day(7); // El próximo domingo

    const dates = [];
    let day = today;

    while (day.isSameOrBefore(sunday)) {
      dates.push(day.format('YYYY-MM-DD'));
      day = day.add(1, 'day');
    }

    const insertDateQuery = `
      INSERT INTO date (date)
      VALUES ($1)
      ON CONFLICT (date) DO NOTHING;
    `;

    for (const date of dates) {
      await pool.query(insertDateQuery, [date]);
    }
    console.log('Dates inserted successfully.');
  } catch (error) {
    console.error('Error creating or inserting data into the "date" table:', error);
  }
};

// Call the function to create the table and insert dates
createDateTable();



  