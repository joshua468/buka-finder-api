-- Widen restaurant rating to 3 decimal places so every card can show a unique
-- rating (numeric(2,1) caps options at a single decimal, numeric(3,2) is
-- enough for 2DP but the model stores numeric(4,3) -> render "4.69").
-- UP
ALTER TABLE restaurants ALTER COLUMN rating TYPE numeric(4,3);
-- DOWN
ALTER TABLE restaurants ALTER COLUMN rating TYPE numeric(2,1);