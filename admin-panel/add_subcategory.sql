DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'subcategory'
    ) THEN 
        ALTER TABLE products ADD COLUMN subcategory VARCHAR(50);
    END IF;
END $$; 