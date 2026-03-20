const config = require('config.json');
const mysql = require('mysql2/promise');
const { Sequelize } = require('sequelize');
module.exports = db = {};
initialize();
async function initialize() {
    const { host, port, user, password, database } = config.database;
    const connection = await mysql.createConnection({ host, port, user, password });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
    await connection.end();

    const sequelize = new Sequelize(database, user, password, { dialect: 'mysql' });
    db.User = require('../users/user.model')(sequelize);
    db.ActivityLog = require('../models/activitylog.model')(sequelize);
    await sequelize.sync({ alter: true });

    // Automatically fix ActivityLog FK constraints on every startup.
    // sequelize.sync({ alter: true }) creates duplicate FK constraints on every
    // restart and some may be ON DELETE CASCADE which wipes logs when a user is
    // deleted. This block drops all of them and adds one clean SET NULL constraint.
    await fixActivityLogConstraints(sequelize);
}

async function fixActivityLogConstraints(sequelize) {
    try {
        // Get all existing FK constraints on ActivityLogs
        const [constraints] = await sequelize.query(`
            SELECT CONSTRAINT_NAME 
            FROM information_schema.KEY_COLUMN_USAGE 
            WHERE TABLE_NAME = 'ActivityLogs' 
            AND TABLE_SCHEMA = DATABASE()
            AND REFERENCED_TABLE_NAME = 'Users';
        `);

        // Drop all existing FK constraints
        for (const constraint of constraints) {
            await sequelize.query(`
                ALTER TABLE ActivityLogs DROP FOREIGN KEY \`${constraint.CONSTRAINT_NAME}\`;
            `);
        }

        // Add one clean FK constraint with ON DELETE SET NULL
        await sequelize.query(`
            ALTER TABLE ActivityLogs 
            ADD CONSTRAINT activitylogs_fk_userId 
            FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE SET NULL;
        `);

        console.log('ActivityLog FK constraints fixed successfully.');
    } catch (err) {
        console.error('Failed to fix ActivityLog FK constraints:', err.message);
    }
}