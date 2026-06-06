ALTER TABLE `User`
  ADD COLUMN `emailEncrypted` TEXT NULL,
  ADD COLUMN `emailHash` VARCHAR(64) NULL;

CREATE UNIQUE INDEX `User_emailHash_key` ON `User`(`emailHash`);
