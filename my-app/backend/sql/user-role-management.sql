-- User Role Management for Testing
-- These queries allow you to view and update user roles in the database for testing purposes

-- View all users and their roles
SELECT 
  microsoft_user_id,
  email,
  name,
  role,
  login_at
FROM microsoft_account_logins
ORDER BY login_at DESC;

-- View a specific user by email
SELECT 
  microsoft_user_id,
  email,
  name,
  role,
  login_at
FROM microsoft_account_logins
WHERE email = 'student@example.com'
ORDER BY login_at DESC
LIMIT 1;

-- Update a student to faculty role for testing
UPDATE microsoft_account_logins
SET role = 'adviser'
WHERE email = 'student@example.com';

-- Update a faculty to student role for testing
UPDATE microsoft_account_logins
SET role = 'student'
WHERE email = 'faculty@example.com';

-- View updated role
SELECT 
  email,
  role
FROM microsoft_account_logins
WHERE email = 'student@example.com'
ORDER BY login_at DESC
LIMIT 1;
