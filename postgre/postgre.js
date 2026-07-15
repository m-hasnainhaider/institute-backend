import { Sequelize } from "sequelize";
import { CreateUserModel } from "../models/user.model.js";
import { CreateRefreshTokenModel } from "../models/refreshToken.model.js";
import { CreateCourseDetailModel } from "../models/courseDetail.model.js";
import{CreateCourseCategoryModel} from "../models/courseCategory.model.js";
import{CreateCourseModel} from "../models/course.model.js"
import{CreateEnrollmentModel} from "../models/enrollment.model.js"
import{CreateStudentModel} from "../models/student.model.js"
const sequelize =new Sequelize(
    'test',
    'postgres',
    '123',
    {
        host:'localhost',
        dialect:'postgres'
    }
);

let userModel=null;
let refreshTokenModel=null;
let courseModel=null;
let courseCategoryModel=null;
let courseDetailModel=null;
let enrollmentModel=null;
let studentModel=null;
const Connection=async()=>{
    try{
        await sequelize.authenticate();
        console.log("DataBase Connected");
        userModel=await CreateUserModel(sequelize);
        refreshTokenModel=await CreateRefreshTokenModel(sequelize);
        courseModel=await CreateCourseModel(sequelize);
        courseCategoryModel=await CreateCourseCategoryModel(sequelize);
        courseDetailModel=await CreateCourseDetailModel(sequelize);
        enrollmentModel=await CreateEnrollmentModel(sequelize);
        studentModel=
        await CreateStudentModel(sequelize);
        await sequelize.sync();
    }
    catch(error){

    }
}

export{
    Connection,
    sequelize,
    userModel,
    refreshTokenModel,
    courseModel,
    courseCategoryModel,
    courseDetailModel,
    enrollmentModel,
    studentModel
}