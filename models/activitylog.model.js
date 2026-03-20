const { DataTypes } = require('sequelize');

module.exports = model;

function model(sequelize) {
    const attributes = {
        userId: { 
            type: DataTypes.INTEGER, 
            allowNull: true,
            references: {
                model: 'Users', // Ensure this matches your User table name exactly
                key: 'id'
            },
            onDelete: 'SET NULL' // This triggers the automatic deletion of logs
        },
        actionType: { type: DataTypes.STRING, allowNull: false }, 
        actionDetails: { type: DataTypes.TEXT, allowNull: true },
        
        previousValue: { 
            type: DataTypes.JSON, 
            allowNull: true 
        },

        timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    };

    const options = {
        timestamps: false,
        defaultScope: {
            attributes: { 
                // Removed 'changeCount' since it isn't in your attributes above
                exclude: ['id', 'previousValue'] 
            }
        }
    };

    return sequelize.define('ActivityLog', attributes, options);
}