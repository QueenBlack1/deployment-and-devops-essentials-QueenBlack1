#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const execAsync = promisify(exec);

class MongoDBBackup {
  constructor() {
    this.backupDir = path.join(__dirname, '../../backups');
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 7;
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, `backup-${timestamp}.gz`);
    
    try {
      // Create backup directory if it doesn't exist
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      // Create backup using mongodump
      const { MONGODB_URI } = process.env;
      if (!MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is required');
      }

      const command = `mongodump --uri="${MONGODB_URI}" --archive="${backupFile}" --gzip`;
      
      console.log('Creating MongoDB backup...');
      await execAsync(command);
      
      console.log(`Backup created: ${backupFile}`);
      
      // Upload to cloud storage (optional)
      if (process.env.BACKUP_UPLOAD_URL) {
        await this.uploadBackup(backupFile);
      }

      // Clean up old backups
      await this.cleanupOldBackups();

      return backupFile;
    } catch (error) {
      console.error('Backup failed:', error);
      throw error;
    }
  }

  async uploadBackup(backupFile) {
    try {
      const fileBuffer = fs.readFileSync(backupFile);
      const fileName = path.basename(backupFile);

      await axios.post(process.env.BACKUP_UPLOAD_URL, {
        file: fileBuffer.toString('base64'),
        fileName,
        timestamp: new Date().toISOString()
      });

      console.log('Backup uploaded successfully');
    } catch (error) {
      console.error('Backup upload failed:', error.message);
    }
  }

  async cleanupOldBackups() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('backup-') && file.endsWith('.gz'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          time: fs.statSync(path.join(this.backupDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      const oldBackups = files.slice(this.retentionDays);
      
      for (const backup of oldBackups) {
        fs.unlinkSync(backup.path);
        console.log(`Deleted old backup: ${backup.name}`);
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  async restoreBackup(backupFile) {
    try {
      const { MONGODB_URI } = process.env;
      const command = `mongorestore --uri="${MONGODB_URI}" --archive="${backupFile}" --gzip --drop`;
      
      console.log('Restoring MongoDB backup...');
      await execAsync(command);
      
      console.log('Backup restored successfully');
    } catch (error) {
      console.error('Restore failed:', error);
      throw error;
    }
  }
}

// CLI interface
if (require.main === module) {
  const backup = new MongoDBBackup();
  const command = process.argv[2];

  switch (command) {
    case 'create':
      backup.createBackup();
      break;
    case 'restore':
      const backupFile = process.argv[3];
      if (!backupFile) {
        console.error('Please provide backup file path');
        process.exit(1);
      }
      backup.restoreBackup(backupFile);
      break;
    default:
      console.log('Usage: node backup-mongodb.js [create|restore]');
      process.exit(1);
  }
}

module.exports = MongoDBBackup;