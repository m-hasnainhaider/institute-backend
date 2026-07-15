import { DataTypes } from "sequelize";

export const CreateRefreshTokenModel = async (sequelize) => {
    const token = sequelize.define(
        'token', //this is table name.
        {
            // 1st: The long token string
            token_string: {
                type: DataTypes.TEXT,
                allowNull: false,
                unique: true
            },
            // 2nd: The foreign key that links to the User table
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',// -- This must match the table name of your user model
                    key: 'id'     //  -- This points to the auto-generated id of the user
                }
            },
            is_used: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            }
        }
    );
    return token;
};