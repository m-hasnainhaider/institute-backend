import { DataTypes,Sequelize } from "sequelize";
export const CreateStudentModel=async(Sequelize)=>{
    const student=Sequelize.define(
        'student'
        ,
        {
            user_id:{
                type:DataTypes.INTEGER
            },
            course_id:{
                type:DataTypes.INTEGER
            },
            certificate:{
                type:DataTypes.STRING,
                default:null
            },
            completion_status:{
                type:DataTypes.BOOLEAN,
                defaultValue:false
            }
        }
    )
    return student
}