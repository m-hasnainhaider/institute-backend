import { DataTypes, Sequelize } from "sequelize";
export const CreateCourseModel = async (sequelize) => {
    const course = sequelize.define(
        'course',
        {
            image: {
                type: DataTypes.TEXT
            },
            name: {
                type: DataTypes.STRING
            },
            discription: {
                type: DataTypes.TEXT
            },
            duration: {
                type: DataTypes.INTEGER
            },
            hero_text:{
                type:DataTypes.STRING
            },
            category_id: {
                type: DataTypes.INTEGER
            },
            fee_structure:{
                type:DataTypes.STRING
            }

        }
    );
    return course;
}