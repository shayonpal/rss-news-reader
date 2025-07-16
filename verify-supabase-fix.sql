-- This query verifies the preferences column was added to the users table
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'users'
  AND column_name = 'preferences';
EOF < /dev/null