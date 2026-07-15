import { DataTypes } from "sequelize";
export const CreateCourseCategoryModel=async(sequelize)=>{
    const coursecategories=sequelize.define(
        'coursecategories',
        {
            name:{
                type:DataTypes.STRING
            }
        }
    )
    return coursecategories
}