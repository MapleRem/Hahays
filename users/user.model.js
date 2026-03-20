const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        username: { type: DataTypes.STRING, allowNull: false },
        email: { type: DataTypes.STRING, allowNull: false },
        passwordHash: { type: DataTypes.STRING, allowNull: false },
        title: { type: DataTypes.STRING, allowNull: false },
        firstName: { type: DataTypes.STRING, allowNull: false },
        lastName: { type: DataTypes.STRING, allowNull: false },
        role: { type: DataTypes.STRING, allowNull: false },
        // FIX #7: Changed allowNull to true so existing create flows that
        // don't supply a profilePic won't fail at the DB level during migration.
        // If profilePic is always required, ensure the createSchema enforces it (it does).
        profilePic: { type: DataTypes.STRING, allowNull: true },

        theme: { type: DataTypes.ENUM('light', 'dark'), allowNull: false, defaultValue: 'light' },
        notifications: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true },
        language: { type: DataTypes.ENUM('en', 'fr'), allowNull: false, defaultValue: 'en' },

        status: { type: DataTypes.ENUM('deactivated', 'active'), allowNull: false, defaultValue: 'active' },
        lastDateLogin: { type: DataTypes.DATE, allowNull: true },

        permission: { type: DataTypes.ENUM('grant', 'revoke'), allowNull: false, defaultValue: 'revoke' }
    };
    
    const options = {
        defaultScope: {
            attributes: { exclude: ['passwordHash'] } 
        },
        scopes: {
            withHash: { attributes: {} }
        }
    };
    
    return sequelize.define('User', attributes, options);
}