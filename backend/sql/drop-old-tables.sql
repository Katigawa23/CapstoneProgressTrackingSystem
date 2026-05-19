-- Run this only when you are ready to delete and recreate the app tables.
-- After this finishes, run full-schema.sql.

-- Legacy sprint / backlog tables from older schema versions.
-- Keep both singular and plural names here because some environments
-- were created with slightly different table names.
drop table if exists sprint_backlog_items cascade;
drop table if exists sprint_items cascade;
drop table if exists sprint cascade;
drop table if exists sprints cascade;
drop table if exists attachment_review_comments cascade;
drop table if exists weblinks cascade;
drop table if exists attachments cascade;
drop table if exists backlog_submissions cascade;
drop table if exists backlog_attachment cascade;
drop table if exists backlog_attachments cascade;
drop table if exists backlog_comment cascade;
drop table if exists backlog_comments cascade;
drop table if exists comments cascade;
drop table if exists backlog_subtasks cascade;
drop table if exists backlog_tasks cascade;
drop table if exists backlog_items cascade;
drop table if exists backlog cascade;
drop table if exists subtasks cascade;
drop table if exists tasks cascade;
drop table if exists group_members cascade;
drop table if exists project_member_access cascade;
drop table if exists members cascade;
drop table if exists groups cascade;
drop table if exists project_starred_preferences cascade;
drop table if exists projects cascade;
drop table if exists microsof_account_logins cascade;
drop table if exists microsoft_account_logins cascade;
drop table if exists users cascade;
