import { DataTypes } from "sequelize";
export const CreateCourseDetailModel = async (sequelize) => {
    const coursedetail = sequelize.define(
        'coursedetail',
        {
            course_id: {
                type: DataTypes.INTEGER
            }
            ,
            banner: {
                type: DataTypes.TEXT
            }
            ,
            fee: {
                type:DataTypes.INTEGER
            }
            
            ,
            extensive_description:{
                type:DataTypes.TEXT
            }
            ,
            topics:{
                type:DataTypes.ARRAY(DataTypes.STRING)
            }
        }
    )
    return coursedetail
}