const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// Database configuration
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/products', async (req, res) => {
  const { name, description, price, category, image_url } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO products (name, description, price, category, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description, price, category, image_url]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin authentication routes
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      // In a real application, you would hash and compare passwords
      if (result.rows[0].password === password) {
        req.session.admin = true;
        res.json({ success: true });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Newsletter subscription endpoint
app.post('/api/newsletter/subscribe', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO newsletter_clients (email) VALUES ($1) RETURNING *',
      [email]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') { // Unique violation error code
      res.status(400).json({ error: 'Email already subscribed' });
    } else {
      console.error('Database error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get all newsletter subscribers (admin only)
app.get('/api/newsletter/subscribers', async (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query('SELECT * FROM newsletter_clients ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete newsletter subscriber (admin only)
app.delete('/api/newsletter/subscribers/:email', async (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { email } = req.params;
  const decodedEmail = decodeURIComponent(email);

  try {
    // First check if the subscriber exists
    const checkResult = await pool.query(
      'SELECT * FROM newsletter_clients WHERE email = $1',
      [decodedEmail]
    );

    if (checkResult.rows.length === 0) {
      console.log(`Subscriber not found: ${decodedEmail}`);
      return res.status(404).json({ error: 'Subscriber not found' });
    }

    // If exists, proceed with deletion
    const result = await pool.query(
      'DELETE FROM newsletter_clients WHERE email = $1 RETURNING *',
      [decodedEmail]
    );

    console.log(`Successfully deleted subscriber: ${decodedEmail}`);
    res.json({ 
      success: true, 
      message: 'Subscriber deleted successfully',
      deletedSubscriber: result.rows[0]
    });
  } catch (error) {
    console.error('Database error while deleting subscriber:', error);
    console.error('Attempted to delete email:', decodedEmail);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 