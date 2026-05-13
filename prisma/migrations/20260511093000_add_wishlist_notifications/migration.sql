-- AlterTable
ALTER TABLE `Favorite`
  ADD COLUMN `emailAlertsEnabled` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `lastEmailAlertAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `Notification` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `skinId` INTEGER NOT NULL,
  `type` ENUM('PRICE_CHANGE') NOT NULL DEFAULT 'PRICE_CHANGE',
  `title` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `previousPrice` DOUBLE NULL,
  `currentPrice` DOUBLE NULL,
  `changePercent` DOUBLE NULL,
  `direction` ENUM('UP', 'DOWN') NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'EUR',
  `readAt` DATETIME(3) NULL,
  `emailedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `Notification_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
  INDEX `Notification_skinId_createdAt_idx`(`skinId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_skinId_fkey` FOREIGN KEY (`skinId`) REFERENCES `Skin`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
