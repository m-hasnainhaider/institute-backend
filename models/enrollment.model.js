import { DataTypes,Sequelize } from "sequelize";
export const CreateEnrollmentModel=async(Sequelize)=>{
    const enrollment=Sequelize.define(
        'enrollment'
        ,
        {
            user_id:{
                type:DataTypes.INTEGER
            },
            course_id:{
                type:DataTypes.INTEGER
            }
        }
    )
    return enrollment
}