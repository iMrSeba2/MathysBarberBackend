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

const updateUserRole = async (userId, newRole) => {
  const validRoles = ['user', 'barber', 'admin'];

  if (!validRoles.includes(newRole)) {
    console.error(`Invalid role: ${newRole}. Valid roles are: ${validRoles.join(', ')}`);
    return;
  }

  const updateRoleQuery = `
    UPDATE users
    SET role = $1
    WHERE id = $2;
  `;

  try {
    await pool.query(updateRoleQuery, [newRole, userId]);
    console.log(`User ID ${userId} role updated to ${newRole} successfully.`);
  } catch (error) {
    console.error(`Error updating role for user ID ${userId}:`, error.message);
  }
};

// Example usage: update user ID 3 to 'admin' role
updateUserRole(1, 'admin');
