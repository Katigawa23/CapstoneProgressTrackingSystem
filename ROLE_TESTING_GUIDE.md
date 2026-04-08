# Role Testing & Management Guide

## Overview

For testing purposes in the development phase, you can now dynamically change user roles in the database. This allows you to test the dashboard with different role permissions without needing multiple accounts.

## How It Works

### Role Assignment Flow

1. **Initial Login**: When a user logs in via Microsoft Entra ID:
   - The system extracts their email
   - If email contains "faculty", "adviser", or "professor" → role = "Faculty" (adviser)
   - Otherwise → role = "Student"

2. **Database Check**: After saving to the database, the system checks if a role has been manually updated
   - If a stored role exists in the database → that role is used
   - If no stored role → the email-based role is used

3. **Next Login**: On subsequent logins, the stored role in the database is used

## Testing the Role System

### Method 1: Using the Role Testing Panel (UI)

If you've added the `RoleTestingPanel` component to your dashboard:

```tsx
import { RoleTestingPanel } from "@/components/role-testing-panel"

// In your dashboard page:
<RoleTestingPanel />
```

Then:
1. View your current role
2. Select a new role (Student or Faculty)
3. Click "Update Role"
4. Log out and log back in
5. The dashboard will now display with the new role's permissions

### Method 2: Using Database Queries (SQL)

Connect to your PostgreSQL database and run these queries:

#### View all users and their roles:
```sql
SELECT 
  microsoft_user_id,
  email,
  name,
  role,
  login_at
FROM microsoft_account_logins
ORDER BY login_at DESC;
```

#### View a specific user:
```sql
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
```

#### Change a student to faculty (adviser):
```sql
UPDATE microsoft_account_logins
SET role = 'adviser'
WHERE email = 'student@example.com';
```

#### Change faculty to student:
```sql
UPDATE microsoft_account_logins
SET role = 'student'
WHERE email = 'faculty@example.com';
```

### Method 3: Using the API Endpoint

#### Get current user's role:
```bash
curl -X GET http://localhost:3000/api/auth/user-role \
  -H "Authorization: Bearer YOUR_USER_ID"
```

#### Update a user's role:
```bash
curl -X PUT http://localhost:3000/api/auth/user-role \
  -H "Authorization: Bearer YOUR_USER_ID" \
  -H "Content-Type: application/json" \
  -d '{"role": "adviser"}'
```

Response:
```json
{
  "success": true,
  "userId": "user-id",
  "newRole": "adviser",
  "message": "Role updated successfully. User needs to log in again to see changes."
}
```

## Role Permissions

### Student Role
- ✅ View assignments
- ✅ Submit assignments
- ✅ View board, roadmap, backlog
- ❌ Cannot create projects
- ❌ Cannot manage assignments

### Faculty Role
- ✅ Create and manage projects
- ✅ Create, edit, and check assignments
- ✅ View student submissions
- ✅ Access all features

## Testing Workflow

1. **Log in as a student**: Use an email like `student@example.com`
2. **Update role to Faculty**: Using any of the above methods
3. **Log out and back in**: The dashboard will now show Faculty features
4. **Test Faculty features**: Create projects, manage assignments, etc.
5. **Change back to Student**: Repeat the process to test student features

## Database Schema

The roles are stored in the `microsoft_account_logins` table:

```sql
CREATE TABLE microsoft_account_logins (
  id BIGSERIAL PRIMARY KEY,
  microsoft_user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student', -- 'student' or 'adviser'
  tenant_id TEXT NOT NULL,
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Important Notes

- **Session Caching**: The role is cached in the user's session after login. Changes made to the database only take effect after the user logs out and logs back in.
- **Email-based Fallback**: If a user logs in for the first time, the role is determined from their email. You can then update it in the database.
- **For Development Only**: This testing system is intended for development/testing. In production, implement proper role management through Azure AD groups or a more robust admin panel.

## Troubleshooting

**Q: I updated the role in the database but it didn't change in the dashboard**  
A: You need to log out completely and log back in. The role is stored in your session after login.

**Q: How do I reset a user to their email-based role?**  
A: Log out the user, delete their record from the `microsoft_account_logins` table, then have them log in again. The system will auto-detect the role from their email.

**Q: Can I test multiple roles without switching users?**  
A: Yes! Use the Role Testing Panel or database queries to change your role and re-login.
