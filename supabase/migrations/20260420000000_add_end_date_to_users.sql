-- Add end_date to users: the date a user was deactivated.
-- After end_date, the user can no longer time in/out and should not be
-- marked absent for missed scheduled days.
ALTER TABLE users ADD COLUMN IF NOT EXISTS end_date date;
