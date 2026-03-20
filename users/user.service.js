const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('_helpers/db');
const { Sequelize, Op } = require('sequelize');

module.exports = {
    getAll,
    getById,
    create,
    update,
    delete: _delete,
    search,
    searchAll,
    getPreferences,
    updatePreferences,
    changePass,
    login,
    logout,
    logActivity,
    getUserActivities,
    getAllActivities,
    deactivate,
    reactivate,
    getPermission,
    createPermission
};

//=============================== Simple CRUD ===============================
async function getAll() {
    return await db.User.findAll();
}

async function getById(id) {
    return await getUser(id);
} 

async function create(params) {
    if (await db.User.findOne({ where: { email: params.email } })) {
        throw `Email "${params.email}" is already registered`;
    }

    if (await db.User.findOne({ where: { username: params.username } })) {
        throw `Username "${params.username}" is already taken`;
    }
    
    const user = new db.User(params);
    user.passwordHash = await bcrypt.hash(params.password, 10);
    await user.save();

    await logActivity(
        user.id,
        'create',
        params.ipAddress,
        params.browserInfo,
        `Account created — Email: ${user.email}, Name: ${user.firstName} ${user.lastName}, Role: ${user.role}`
    );
}

async function update(id, params) {
    const user = await getUser(id);
    const oldData = user.get({ plain: true }); 
    const updatedFields = [];
    const nonUserFields = ['ipAddress', 'browserInfo'];

    if (params.username && user.username !== params.username) {
        if (await db.User.findOne({ where: { username: params.username } })) {
            throw `Username "${params.username}" is already taken`;
        }
    }

    if (params.password) {
        params.passwordHash = await bcrypt.hash(params.password, 10);
    }

    for (const key in params) {
        if (params.hasOwnProperty(key) && !nonUserFields.includes(key) && key !== 'password') {
            if (oldData[key] !== params[key] && params[key] !== undefined) {
                updatedFields.push(`${key}: ${oldData[key]} -> ${params[key]}`);
            }
        }
    }

    Object.assign(user, params);
    await user.save();

    const updateDetails = updatedFields.length > 0 
        ? `Updated fields: ${updatedFields.join(', ')}` 
        : 'No fields changed';

    await logActivity(user.id, 'update', params.ipAddress, params.browserInfo, updateDetails);
}

async function _delete(id) {
    const user = await getUser(id);
    const deletedUserInfo = `Deleted account — Email: ${user.email}, Name: ${user.firstName} ${user.lastName}, Role: ${user.role}`;
    await logActivity(user.id, 'delete', 'N/A', 'N/A', deletedUserInfo);
    await user.destroy();
}

async function getUser(id) {
    const user = await db.User.findByPk(id);
    if (!user) throw 'User not found';
    return user;
}

//-------------------------- Search Functions -------------------------------
async function searchAll(query) {
    const users = await db.User.findAll({
        where: {
            [Op.or]: [
                { email: { [Op.like]: `%${query}%` } },
                { title: { [Op.like]: `%${query}%` } },
                { firstName: { [Op.like]: `%${query}%` } },
                { lastName: { [Op.like]: `%${query}%` } },
                { role: { [Op.like]: `%${query}%` } }
            ]
        }
    });
    return users;
}

async function search(params) {
    const whereClause = {};

    if (params.email) whereClause.email = { [Op.like]: `%${params.email}%` };
    if (params.title) whereClause.title = { [Op.like]: `%${params.title}%` };
    if (params.role) whereClause.role = { [Op.like]: `%${params.role}%` };
    if (params.status) whereClause.status = params.status;

    if (params.firstName) whereClause.firstName = { [Op.like]: `%${params.firstName}%` };
    if (params.lastName) whereClause.lastName = { [Op.like]: `%${params.lastName}%` };

    if (params.dateCreated) {
        whereClause.createdAt = {
            [Op.between]: [
                new Date(params.dateCreated),
                new Date(new Date(params.dateCreated).setHours(23, 59, 59, 999))
            ]
        };
    }

    if (params.lastDateLogin) {
        whereClause.lastDateLogin = {
            [Op.between]: [
                new Date(params.lastDateLogin),
                new Date(new Date(params.lastDateLogin).setHours(23, 59, 59, 999))
            ]
        };
    }
    
    if (params.fullName) {
        whereClause[Op.and] = Sequelize.where(
            Sequelize.fn('CONCAT', Sequelize.col('firstName'), ' ', Sequelize.col('lastName')),
            { [Op.like]: `%${params.fullName}%` }
        );
    }

    return await db.User.findAll({ where: whereClause });
}

//------------------------- Account Status -------------------------
async function deactivate(id) {
    const user = await getUser(id);
    user.status = 'deactivated';
    await user.save();
}

async function reactivate(id) {
    const user = await getUser(id);
    user.status = 'active';
    await user.save();
}

//=================== Preferences & Permissions ===========================
async function getPreferences(id) {
    return await db.User.findByPk(id, { attributes: ['id', 'theme', 'notifications', 'language'] });
}

async function updatePreferences(id, params) {
    const user = await getUser(id);
    Object.assign(user, params);
    await user.save();
}

async function getPermission(id) {
    return await db.User.findByPk(id, { attributes: ['id', 'permission', 'updatedAt'] });
}

async function createPermission(id, params) {
    const user = await getUser(id);
    Object.assign(user, params); 
    await user.save();
}

//=================== Auth & Security ==============================
async function changePass(id, params) {
    const user = await db.User.scope('withHash').findByPk(id);
    if (!user) throw 'User does not exist';

    if (!await bcrypt.compare(params.currentPassword, user.passwordHash)) {
        throw 'Current password is incorrect';
    }

    user.passwordHash = await bcrypt.hash(params.newPassword, 10);
    await user.save();

    await logActivity(user.id, 'change pass', params.ipAddress, params.browserInfo);
}

async function login(params) {
    const user = await db.User.scope('withHash').findOne({ where: { email: params.email } });
    
    if (!user || user.status === 'deactivated' || !await bcrypt.compare(params.password, user.passwordHash)) {
        throw 'Invalid email or password';
    }

    const token = jwt.sign({ id: user.id }, process.env.SECRET, { expiresIn: '7d' });

    user.lastDateLogin = new Date();
    await user.save();

    await logActivity(user.id, 'login', params.ipAddress, params.browserInfo);

    return { ...user.get(), token };
}

async function logout(id, params) {
    await logActivity(id, 'logout', params.ipAddress, params.browserInfo, 'User logged out');
    return { message: 'User logged out successfully' };
}

//=================== Activity Logging ==============================
async function logActivity(userId, actionType, ipAddress = 'Unknown IP', browserInfo = 'Unknown Browser', updateDetails = '') {
    await db.ActivityLog.create({
        userId,
        actionType,
        actionDetails: `IP: ${ipAddress}, Browser: ${browserInfo}, Info: ${updateDetails}`,
        timestamp: new Date()
    });

    // Cleanup: Keep only last 10 logs per user
    const logCount = await db.ActivityLog.count({ where: { userId } });
    if (logCount > 10) {
        // FIX: unscoped() bypasses defaultScope so id field is included
        const oldestLogs = await db.ActivityLog.unscoped().findAll({
            where: { userId },
            order: [['timestamp', 'ASC']], 
            limit: logCount - 10 
        });
        await db.ActivityLog.destroy({ where: { id: oldestLogs.map(l => l.id) } });
    }
}

async function getAllActivities(filters = {}) {
    const whereClause = {};

    if (filters.actionType) {
        whereClause.actionType = { [Op.like]: `%${filters.actionType}%` };
    }
    if (filters.startDate || filters.endDate) {
        whereClause.timestamp = {
            [Op.between]: [
                filters.startDate ? new Date(filters.startDate) : new Date(0),
                filters.endDate ? new Date(filters.endDate) : new Date()
            ]
        };
    }

    return await db.ActivityLog.findAll({ 
        where: whereClause,
        order: [['timestamp', 'DESC']]
    });
}

async function getUserActivities(userId, filters = {}) {
    let whereClause = { userId };

    if (filters.actionType) {
        whereClause.actionType = { [Op.like]: `%${filters.actionType}%` };
    }
    if (filters.startDate || filters.endDate) {
        whereClause.timestamp = {
            [Op.between]: [
                filters.startDate ? new Date(filters.startDate) : new Date(0),
                filters.endDate ? new Date(filters.endDate) : new Date()
            ]
        };
    }

    return await db.ActivityLog.findAll({ where: whereClause });
}