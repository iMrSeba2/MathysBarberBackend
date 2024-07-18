const express = require('express');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const cors = require('cors');
dotenv.config();

const app = express();
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

app.use(cors());
app.use(express.json()); // Middleware para interpretar el cuerpo de la solicitud JSON
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('Hello from the backend server!');
});

// Crear un nuevo usuario con name, phone, email, username, password
app.post('/users', async (req, res) => {
  //comprobar si el usuario ya existe
  const { name, phone, email, username, password } = req.body;
  console.log(username);
  const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  if (user.rows.length > 0) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  // Crear un nuevo usuario
  const newUser = await pool.query(
    'INSERT INTO users (name, phone, email, username, password) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [name, phone, email, username, password]
  );
  res.json(newUser.rows[0]);
});

// loguear un usuario
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
  if (user.rows.length === 0) {
    return res.status(400).json({ error: 'Invalid username or password' });
  }
  res.json(user.rows[0]);
});

app.get('/users', async (req, res) => {
  const allUsers = await pool.query('SELECT * FROM users');
  res.json(allUsers.rows);
});

app.listen(5000, () => {
  console.log('Server is running on port 5000');
});

