const express = require('express');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // Para crear el token JWT
const cron = require('node-cron');
const moment = require('moment-timezone');

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
  const { name, phone, email, username, password } = req.body;

  // Comprobar si el usuario ya existe
  const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  const emailUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  if (user.rows.length > 0 || emailUser.rows.length > 0) {
    return res.status(400).json({ error: 'Username or email already exists' });
  }

  // Crear un nuevo usuario
  const newUser = await pool.query(
    'INSERT INTO users (name, phone, email, username, password) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [name, phone, email, username, password]
  );

  // Configurar el transportador de Nodemailer
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: 'mauricie.seba@gmail.com', // Tu email
      pass: 'yctj sdjx qols rbdf', // Tu contraseña
    },
  });

  // Configurar el contenido del correo electrónico
  const mailOptions = {
    from: 'mauricie.seba@gmail.com',
    to: email,
    subject: 'Recuperación de contraseña',
    text: `Su cuenta ha sido creada con éxito. Su usuario es ${username} y su contraseña es ${password}`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error al enviar el correo de recuperación:', error);
    res.status(500).send('Error al enviar el correo de recuperación');
  }
  res.json(newUser.rows[0]);
});

// Loguear un usuario
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Buscar usuario en la base de datos
  const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  if (user.rows.length === 0) {
    return res.status(400).json({ error: 'Invalid username or password' });
  }

  const userData = user.rows[0];  
  if(password === userData.password){
    //Token with all user except password
    const token = jwt.sign({ id: userData.user_id, name: userData.name, phone: userData.phone, email: userData.email, username: userData.username,role: userData.role }, process.env.JWT_SECRET);
    return res.json({ token });
  }
  else{
    return res.status(400).json({ error: 'Invalid username or password' });
  }
});

app.get('/users', async (req, res) => {
  const allUsers = await pool.query('SELECT * FROM users');
  res.json(allUsers.rows);
});

app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const allUsers = await pool.query('SELECT * FROM users');
  const user = allUsers.rows.find((user) => user.email === email);
  if (!user) {
    return res.status(400).json({ error: 'Email not found' });
  }

  // Generar token
  const token = crypto.randomBytes(20).toString('hex');
  const expires = new Date(Date.now() + 3600000).toISOString(); // Convertimos la fecha a formato ISO

  await pool.query('UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3', [token, expires, email]);

  // Configurar el transportador de Nodemailer
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: 'mauricie.seba@gmail.com', // Tu email
      pass: 'yctj sdjx qols rbdf', // Tu contraseña
    },
  });

  // Configurar el contenido del correo electrónico
  const mailOptions = {
    from: 'mauricie.seba@gmail.com',
    to: email,
    subject: 'Recuperación de contraseña',
    text: `Haz clic en el siguiente enlace para restablecer tu contraseña: https://main--mathysbarber.netlify.app/reset-password/${token}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send('Correo de recuperación enviado');
  } catch (error) {
    console.error('Error al enviar el correo de recuperación:', error);
    res.status(500).send('Error al enviar el correo de recuperación');
  }
});

app.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  // Verificar si el token es válido y no ha expirado
  const user = await pool.query('SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > $2', [token, new Date()]);
  if (user.rows.length === 0) {
    return res.status(400).send('El token es inválido o ha expirado');
  }


  // Actualizar la contraseña y eliminar el token
  await pool.query('UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE reset_password_token = $2', [password, token]);

  res.send('Contraseña restablecida exitosamente');
});

app.get('/hours', async (req, res) => {
  try {
    const allHours = await pool.query(`
      SELECT * FROM hours 
      WHERE hour::time > (CURRENT_TIME AT TIME ZONE 'Chile/Continental')::time
      ORDER BY hour;
    `);
    res.json(allHours.rows);
  } catch (error) {
    console.error('Error fetching hours:', error.message);
    res.status(500).json({ error: 'Error fetching hours: ' + error.message });
  }
});

app.get('/barbers', async (req, res) => {
  try {
    const allBarbersAndAdmins = await pool.query(
      'SELECT * FROM users WHERE role IN ($1, $2)',
      ['barber', 'admin']
    );
    res.json(allBarbersAndAdmins.rows);
  } catch (error) {
    console.error('Error fetching barbers:', error.message);
    res.status(500).json({ error: 'Error fetching barbers: ' + error.message });
  }
});

app.get('/dates', async (req, res) => {
  try {
    const today = moment().tz('America/Santiago').format('YYYY-MM-DD');
    const sunday = moment().tz('America/Santiago').day(7).format('YYYY-MM-DD');

    const allDates = await pool.query(`
      SELECT date_id, TO_CHAR(date, 'YYYY-MM-DD') as date
      FROM date
      WHERE date BETWEEN $1 AND $2
      ORDER BY date;
    `, [today, sunday]);

    res.json(allDates.rows);
  } catch (error) {
    console.error('Error fetching dates:', error.message);
    res.status(500).json({ error: 'Error fetching dates: ' + error.message });
  } 
});

app.listen(5000, () => {
  console.log('Server is running on port 5000');
});


const generateWeeklyDates = async () => {
  const startOfWeek = moment().tz('America/Santiago').startOf('isoWeek'); // Lunes de la semana actual
  const endOfWeek = moment().tz('America/Santiago').endOf('isoWeek'); // Domingo de la semana actual

  const dates = [];
  let day = startOfWeek;

  while (day <= endOfWeek) {
    dates.push(day.format('YYYY-MM-DD'));
    day = day.add(1, 'day');
  }

  const insertDatesQuery = `
    INSERT INTO date (date)
    VALUES ($1)
    ON CONFLICT (date) DO NOTHING;
  `;

  try {
    for (const date of dates) {
      await pool.query(insertDatesQuery, [date]);
    }
    console.log('Weekly dates inserted successfully.');
  } catch (error) {
    console.error('Error inserting weekly dates:', error);
  }
};

app.get('/cuts', async (req, res) => {
  try {
    const allCuts = await pool.query('SELECT * FROM cuts');
    res.json(allCuts.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching cuts: ' + error.message });
  }
});

app.get('/available-hours', async (req, res) => {
  const { barberName, date } = req.query;
  try {
    // Obtener la hora actual del servidor en la zona horaria de Chile
    const currentTime = moment().tz('America/Santiago').format('HH:mm:ss');

    // Obtener el ID del barbero usando el nombre
    const barberResult = await pool.query(
      'SELECT user_id FROM users WHERE username = $1 AND role IN ($2, $3)',
      [barberName, 'barber', 'admin']
    );

    if (barberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Barber not found' });
    }
    
    const barberId = barberResult.rows[0].user_id;

    // Convertir la fecha a un formato que pueda ser comparado
    const formattedDate = moment(date).format('YYYY-MM-DD');
    // Verificar si la fecha es mayor a la fecha actual
    if (formattedDate > moment().tz('America/Santiago').format('YYYY-MM-DD')) {
      // Obtener las horas disponibles
      const availableHours = await pool.query(`
        SELECT h.hour_id, h.hour
        FROM hours h
        WHERE h.hour_id NOT IN (
            SELECT b.hour_id
            FROM bookings b
            JOIN date d ON b.date_id = d.date_id
            WHERE b.barber_id = $1
              AND d.date = $2
              AND b.time_done = FALSE
        )
        ORDER BY h.hour;

      `,[barberId, formattedDate]);
      return res.status(200).json(availableHours.rows);
    } else {
      // Obtener las horas disponibles que no están reservadas
      const availableHours = await pool.query(`
        SELECT h.hour_id, h.hour
        FROM hours h
        WHERE h.hour::time > $1
        AND h.hour_id NOT IN (
          SELECT b.hour_id
          FROM bookings b
          JOIN date d ON b.date_id = d.date_id
          WHERE b.barber_id = $2
          AND d.date = $3
          AND b.time_done = FALSE
        )
        ORDER BY h.hour;
      `, [currentTime, barberId, formattedDate]);
      return res.status(200).json(availableHours.rows);
    }
    
  } catch (error) {
    console.error('Error fetching available hours:', error.message);
    res.status(500).json({ error: 'Error fetching available hours: ' + error.message });
  }
});

app.post('/reservations', async (req, res) => {
  const { userId, barberName, date, hour, cutId } = req.body;

  try {
    // Obtener el ID del barbero usando el nombre
    const barberResult = await pool.query(
      'SELECT user_id FROM users WHERE username = $1 AND role IN ($2, $3)',
      [barberName, 'barber', 'admin']
    );
    if (barberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Barber not found' });
    }

    const barberId = barberResult.rows[0].user_id;

    // Obtener el ID de la fecha
    const dateResult = await pool.query('SELECT date_id FROM date WHERE date = $1', [date]);
    if (dateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Date not found' });
    }

    const dateId = dateResult.rows[0].date_id;

    // Insertar la reserva en la base de datos
    await pool.query(`
      INSERT INTO bookings (user_id,barber_id, cut_id, date_id, hour_id, time_done)
      VALUES ($1, $2, $3, $4, $5, FALSE)
    `, [userId,barberId, cutId, dateId, hour]);

    
    // Configurar el transportador de Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: 'mauricie.seba@gmail.com', // Tu email
        pass: 'yctj sdjx qols rbdf', // Tu contraseña
      },
    });

    // Configurar el contenido del correo electrónico
    const mailOptions = {
      from: 'mauricie.seba@gmail.com',
      to: email,
      subject: 'Recuperación de contraseña',
      text: `Su reserva ha sido realizada con éxito. Su hora es a las ${hour} del día ${date}`,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error al enviar el correo de recuperación:', error);
      res.status(500).send('Error al enviar el correo de recuperación');
    }

    res.status(200).json({ message: 'Reservation successful' });
  } catch (error) {
    console.error('Error making reservation:', error.message);
    res.status(500).json({ error: 'Error making reservation: ' + error.message });
  }
});

app.get('/barber-reservations', async (req, res) => {
  const { barberId } = req.query;

  try {
    let query = `
      SELECT b.booking_id, b.user_id, u.username as user_name, b.barber_id, bu.username as barber_name, 
             b.cut_id, c.name as cut_name, b.date_id, d.date, b.hour_id, h.hour, b.time_done
      FROM bookings b
      JOIN users u ON b.user_id = u.user_id
      JOIN users bu ON b.barber_id = bu.user_id
      JOIN cuts c ON b.cut_id = c.cut_id
      JOIN date d ON b.date_id = d.date_id
      JOIN hours h ON b.hour_id = h.hour_id
      WHERE b.barber_id = $1
      ORDER BY d.date, h.hour
    `;

    const result = await pool.query(query, [barberId]);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching reservations:', error.message);
    res.status(500).json({ error: 'Error fetching reservations: ' + error.message });
  }
});

app.get('/user-reservations', async (req, res) => {
  const { userId } = req.query;

  try {
    const result = await pool.query(`
      SELECT b.booking_id, b.user_id, u.username as user_name, b.barber_id, bu.username as barber_name, 
             b.cut_id, c.name as cut_name, b.date_id, to_char(d.date, 'YYYY/MM/DD') as date, 
             b.hour_id, h.hour, b.time_done
      FROM bookings b
      JOIN users u ON b.user_id = u.user_id
      JOIN users bu ON b.barber_id = bu.user_id
      JOIN cuts c ON b.cut_id = c.cut_id
      JOIN date d ON b.date_id = d.date_id
      JOIN hours h ON b.hour_id = h.hour_id
      WHERE b.user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching reservation:', error.message);
    res.status(500).json({ error: 'Error fetching reservation: ' + error.message });
  }
});


// Programar la tarea para que se ejecute todos los domingos a las 23:00 hora de Chile
cron.schedule('0 13 * * MON', () => {
  console.log('Generating weekly dates...');
  generateWeeklyDates();
}, {
  timezone: "America/Santiago"
});




