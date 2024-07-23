const { Pool } = require('pg');
const dotenv = require('dotenv');

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

const eliminateUsersId = async () => {
    //eliminar usuario por id
    const eliminateId = `
      DELETE FROM users WHERE id = 3;
    `;
    
    try {
      await pool.query(eliminateId);
      console.log('Usuario eliminado correctamente');
    } catch (error) {
      console.error('Error creando la tabla "users":', error);
    }
  };
  
  // Llama a la función para crear la tabla cuando inicies el servidor
  eliminateUsersId();