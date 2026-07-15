import { DataTypes, Sequelize } from "sequelize"

export const CreateUserModel = async (Sequelize) => {
    const user = Sequelize.define(
        'user'
        ,
        {
            name: { type: DataTypes.STRING },
            email: { type: DataTypes.STRING },
            pass: { type: DataTypes.STRING },
            country_code: { type: DataTypes.STRING },
            subscriber_no: { type: DataTypes.STRING },
            role: {
                type: DataTypes.STRING,
                defaultValue:"student"
            }
        }
    )
    return user
}
