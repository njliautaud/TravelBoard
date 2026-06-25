-- Remove the condensed server-side backup table. It duplicated data the
-- Location table already holds (redundant), so it's dropped. Offline support
-- lives on the client (localStorage cache + future outbox), not a server mirror.
DROP TABLE IF EXISTS "LocationBackup";
