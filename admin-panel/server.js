const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Ensure uploads directory exists
const uploadPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Configure multer file filter
const fileFilter = (req, file, cb) => {
    console.log('Processing file:', file);
    // Accept images only
    if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF)$/)) {
        console.log('File rejected - not an image:', file.originalname);
        req.fileValidationError = 'Only image files are allowed!';
        return cb(new Error('Only image files are allowed!'), false);
    }
    console.log('File accepted:', file.originalname);
    cb(null, true);
};

// Initialize multer with configuration
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
}).single('image');

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

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Database connected successfully');
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(uploadPath));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Admin credentials (should be moved to environment variables in production)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'hananadmin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rionaadmin';

// Admin login endpoint
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.admin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ 
            success: false, 
            message: 'Invalid username or password' 
        });
    }
});

// Authentication middleware for admin routes
const requireAdmin = (req, res, next) => {
    if (!req.session.admin) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, 
                   json_object_agg(s.label, COALESCE(pi.quantity, 0)) as sizes
            FROM products p
            LEFT JOIN product_inventory pi ON p.id = pi.product_id
            LEFT JOIN sizes s ON pi.size_id = s.id
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting products:', error);
        res.status(500).json({ error: 'Failed to get products', details: error.message });
    }
});

// Product upload endpoint with error handling
app.post('/api/products', (req, res) => {
    console.log('Received product upload request');
    console.log('Request headers:', req.headers);
    
    upload(req, res, function(err) {
        console.log('Multer processing complete');
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);
        console.log('Multer error:', err);

        if (err instanceof multer.MulterError) {
            console.error('Multer error:', err);
            return res.status(400).json({
                error: 'File upload error',
                details: err.message
            });
        } else if (err) {
            console.error('Unknown error:', err);
            return res.status(500).json({
                error: 'Unknown error',
                details: err.message
            });
        }

        // Handle file validation error
        if (req.fileValidationError) {
            console.error('File validation error:', req.fileValidationError);
            return res.status(400).json({
                error: req.fileValidationError
            });
        }

        // Process the upload
        processProductUpload(req, res);
    });
});

// Get single product endpoint with inventory
app.get('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get product details and its inventory
        const product = await pool.query(`
            SELECT p.*, 
                   json_object_agg(s.label, COALESCE(pi.quantity, 0)) as sizes
            FROM products p
            LEFT JOIN product_inventory pi ON p.id = pi.product_id
            LEFT JOIN sizes s ON pi.size_id = s.id
            WHERE p.id = $1
            GROUP BY p.id
        `, [id]);

        if (product.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(product.rows[0]);
    } catch (error) {
        console.error('Error getting product:', error);
        res.status(500).json({ error: 'Failed to get product', details: error.message });
    }
});

// Delete product endpoint
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // First get the product to find the image path
        const product = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        
        if (product.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Delete the product from database
        await pool.query('DELETE FROM products WHERE id = $1', [id]);

        // If there was an image, delete it from the uploads folder
        if (product.rows[0].image_url) {
            const imagePath = path.join(__dirname, 'public', product.rows[0].image_url);
            fs.unlink(imagePath, (err) => {
                if (err) console.error('Error deleting image file:', err);
            });
        }

        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product', details: error.message });
    }
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

// Update product endpoint
app.put('/api/products/:id', (req, res) => {
    upload(req, res, async function(err) {
        if (err instanceof multer.MulterError) {
            console.error('Multer error:', err);
            return res.status(400).json({
                error: 'File upload error',
                details: err.message
            });
        } else if (err) {
            console.error('Unknown error:', err);
            return res.status(500).json({
                error: 'Unknown error',
                details: err.message
            });
        }

        try {
            const { id } = req.params;
            const { name, description, price, category, subcategory } = req.body;

            // First get the existing product
            const existingProduct = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
            
            if (existingProduct.rows.length === 0) {
                return res.status(404).json({ error: 'Product not found' });
            }

            // Handle image update
            let image_url = existingProduct.rows[0].image_url;
            if (req.file) {
                // Delete old image if it exists
                if (existingProduct.rows[0].image_url) {
                    const oldImagePath = path.join(__dirname, 'public', existingProduct.rows[0].image_url);
                    fs.unlink(oldImagePath, (err) => {
                        if (err) console.error('Error deleting old image file:', err);
                    });
                }
                image_url = `/uploads/${req.file.filename}`;
            }

            // Update the product
            const result = await pool.query(
                `UPDATE products 
                 SET name = $1, description = $2, price = $3, category = $4, 
                     subcategory = $5, image_url = $6, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $7 
                 RETURNING *`,
                [name, description, price, category, subcategory || null, image_url, id]
            );

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error updating product:', error);
            // Clean up uploaded file if database operation failed
            if (req.file) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting file:', unlinkErr);
                });
            }
            res.status(500).json({ error: 'Failed to update product', details: error.message });
        }
    });
});

// Update product inventory
app.put('/api/products/:id/inventory', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { id } = req.params;
        const { sizes } = req.body;

        // Validate product exists
        const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [id]);
        if (productCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        for (const [sizeLabel, quantity] of Object.entries(sizes)) {
            // Get size ID
            const sizeResult = await client.query('SELECT id FROM sizes WHERE label = $1', [sizeLabel]);
            if (sizeResult.rows.length > 0) {
                const sizeId = sizeResult.rows[0].id;
                
                // Get current quantity
                const currentResult = await client.query(
                    'SELECT quantity FROM product_inventory WHERE product_id = $1 AND size_id = $2',
                    [id, sizeId]
                );
                
                const currentQuantity = currentResult.rows.length > 0 ? currentResult.rows[0].quantity : 0;
                const quantityChange = quantity - currentQuantity;

                if (quantityChange !== 0) {
                    // Update inventory using the function
                    await client.query(
                        'SELECT update_inventory($1, $2, $3, $4, $5, $6)',
                        [id, sizeId, quantityChange, 'adjustment', 'Manual inventory update', 'admin']
                    );
                }
            }
        }

        await client.query('COMMIT');

        // Fetch updated inventory
        const updatedProduct = await pool.query(`
            SELECT p.*, 
                   json_object_agg(s.label, COALESCE(pi.quantity, 0)) as sizes
            FROM products p
            LEFT JOIN product_inventory pi ON p.id = p.id
            LEFT JOIN sizes s ON pi.size_id = s.id
            WHERE p.id = $1
            GROUP BY p.id
        `, [id]);

        res.json(updatedProduct.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating inventory:', error);
        res.status(500).json({ error: 'Failed to update inventory', details: error.message });
    } finally {
        client.release();
    }
});

// Get available sizes
app.get('/api/sizes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sizes ORDER BY label');
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting sizes:', error);
        res.status(500).json({ error: 'Failed to get sizes', details: error.message });
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error handler caught:', err);
    res.status(500).json({
        error: 'Internal server error',
        details: err.message
    });
});

// Start server with error handling
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

server.on('error', (error) => {
    console.error('Server error:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
}); 