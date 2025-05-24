-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    image_url TEXT,
    sizes TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create admins table
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sizes table
CREATE TABLE IF NOT EXISTS sizes (
    id SERIAL PRIMARY KEY,
    label VARCHAR(10) UNIQUE NOT NULL
);

-- Product-Sizes join table
CREATE TABLE IF NOT EXISTS product_sizes (
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    size_id INTEGER REFERENCES sizes(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, size_id)
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    label VARCHAR(50) UNIQUE NOT NULL
);

-- Product-Tags join table
CREATE TABLE IF NOT EXISTS product_tags (
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, tag_id)
);

-- Create product_inventory table to track size quantities
CREATE TABLE IF NOT EXISTS product_inventory (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    size_id INTEGER REFERENCES sizes(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, size_id)
);

-- Create inventory_history table to track changes
CREATE TABLE IF NOT EXISTS inventory_history (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    size_id INTEGER REFERENCES sizes(id) ON DELETE CASCADE,
    quantity_change INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    change_type VARCHAR(20) NOT NULL, -- 'add', 'remove', 'adjustment'
    change_reason TEXT,
    changed_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert admin user with new credentials
INSERT INTO admins (username, password) VALUES ('adminhanan', 'rionaadmin') ON CONFLICT (username) DO NOTHING;

-- Insert default sizes
INSERT INTO sizes (label) VALUES ('XS'), ('S'), ('M'), ('L'), ('XL'), ('XXL'), ('XXXL') ON CONFLICT (label) DO NOTHING;

-- Insert default tags
INSERT INTO tags (label) VALUES ('NEW ARRIVAL'), ('LIMITED STOCK'), ('BESTSELLER') ON CONFLICT DO NOTHING;

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating timestamps
CREATE TRIGGER update_product_modtime
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_modtime
    BEFORE UPDATE ON product_inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update inventory and create history
CREATE OR REPLACE FUNCTION update_inventory(
    p_product_id INTEGER,
    p_size_id INTEGER,
    p_quantity_change INTEGER,
    p_change_type VARCHAR(20),
    p_change_reason TEXT,
    p_changed_by VARCHAR(50)
)
RETURNS VOID AS $$
DECLARE
    v_previous_quantity INTEGER;
    v_new_quantity INTEGER;
BEGIN
    -- Get current quantity or initialize to 0
    SELECT COALESCE(quantity, 0) INTO v_previous_quantity
    FROM product_inventory
    WHERE product_id = p_product_id AND size_id = p_size_id;

    IF v_previous_quantity IS NULL THEN
        v_previous_quantity := 0;
    END IF;

    -- Calculate new quantity
    v_new_quantity := v_previous_quantity + p_quantity_change;

    -- Ensure quantity doesn't go below 0
    IF v_new_quantity < 0 THEN
        RAISE EXCEPTION 'Quantity cannot be negative';
    END IF;

    -- Insert or update inventory
    INSERT INTO product_inventory (product_id, size_id, quantity)
    VALUES (p_product_id, p_size_id, v_new_quantity)
    ON CONFLICT (product_id, size_id)
    DO UPDATE SET quantity = v_new_quantity;

    -- Record history
    INSERT INTO inventory_history (
        product_id,
        size_id,
        quantity_change,
        previous_quantity,
        new_quantity,
        change_type,
        change_reason,
        changed_by
    ) VALUES (
        p_product_id,
        p_size_id,
        p_quantity_change,
        v_previous_quantity,
        v_new_quantity,
        p_change_type,
        p_change_reason,
        p_changed_by
    );
END;
$$ LANGUAGE plpgsql; 