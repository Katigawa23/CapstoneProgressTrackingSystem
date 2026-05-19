-- User Role Management for Testing
-- These queries allow you to view and update user roles in the database for testing purposes

-- View all users and their roles
SELECT 
  microsoft_user_id,
  email,
  name,
  role,
  login_at
FROM users
ORDER BY login_at DESC;

-- View a specific user by email
SELECT 
  microsoft_user_id,
  email,
  name,
  role,
  login_at
FROM users
WHERE email = 'student@example.com'
ORDER BY login_at DESC
LIMIT 1;

-- Update a student to faculty role for testing
UPDATE users
SET role = 'adviser'
WHERE email = 'student@example.com';

-- Update a faculty to student role for testing
UPDATE users
SET role = 'student'
WHERE email = 'faculty@example.com';

-- View updated role
SELECT 
  email,
  role
FROM users
WHERE email = 'student@example.com'
ORDER BY login_at DESC
LIMIT 1;
