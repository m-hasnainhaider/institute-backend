import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import multer from 'multer'
import upload from './MiddleWare/multer.middleware.js'
import {
    Connection,
    sequelize,
    userModel,
    refreshTokenModel,
    courseModel,
    courseCategoryModel,
    courseDetailModel,
    studentModel,
    enrollmentModel
} from './postgre/postgre.js'


import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'
import { Sequelize, Op, where } from 'sequelize'

dotenv.config();
await Connection();
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/Images', express.static('Images'));
app.use(cors({
    origin: [
        "http://localhost:3000",
        process.env.FRONTEND_URL
    ],
    credentials: true
}))
app.listen(process.env.PORT, () => {
    console.log("Server Started");
})


app.post('/api/auth/refresh-token', async (req, res) => {
    try {///this is used when the access token get expired.
        const incomingRefreshToken = req.cookies.refreshToken;// 1:pala refresh token loo gaa
        if (!incomingRefreshToken) {
            return res.status(401).json({ error: "No Token provided" });
        }
        try {
            //2.decode the refresh token to read its inner values.
            let decodedPayLoad = jwt.verify(incomingRefreshToken, process.env.JWT_SECRET);
            //3.jis refresh token sa request ki ha user naa.uss token ko DB sa laa k aow ga
            let tokenFromDb = await refreshTokenModel.findOne({ where: { token_string: incomingRefreshToken } });
            //4.Check kroo ga k token exist krtaa ha? aur usaa kisi naa palaa user too nahi kia?
            if (!tokenFromDb) {
                return res.status(403).json({ message: "token not found" });
            }
            if (tokenFromDb.is_used === true) {
                // REPLAY ATTACK! Delete all tokens
                await refreshTokenModel.destroy({
                    where: { user_id: tokenFromDb.user_id }
                });
                return res.status(403).json({ message: "Token already used" });
            }
            //5.refreshToken bulkul sai thaa is liaa new accessToken banayaa.
            const newAccessToken = jwt.sign({ user_id: decodedPayLoad.user_id }, process.env.JWT_SECRET, { expiresIn: '15m' });
            //6.pooranaa refreshToken ko scrap kroo gaa.k yaa token use hoo chukaa haa.DB ma store kroo ga.
            await tokenFromDb.update({ is_used: true });
            //7. new refresh token generate kroo ga.
            let newrefreshToken = jwt.sign({ user_id: decodedPayLoad.userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
            //8.save newrefreshToken to DB
            await refreshTokenModel.create({ user_id: decodedPayLoad.userId, token_string: newrefreshToken });
            res.cookie('refreshToken', newrefreshToken, {
                httpOnly: true,
                secure: false,
                maxAge: 7 * 24 * 60 * 60 * 1000 //7 days age
            })
            return res.status(200).json({ message: "access token refreshed", accessToken: newAccessToken });

        }
        catch (jwterror) {
            console.error(jwterror.message);
            res.status(401).json({ message: 'Token is not right' });
        }
    }
    catch (error) {
        console.error(error.message);
        res.status(401).json({ message: 'unauthorized' });
    }


})
app.get('/api/auth/check-session', async (req, res) => {//login without the email and pass using refresh token.
    try {
        let incomingRefreshToken = req.cookies.refreshToken;
        if (!incomingRefreshToken) {
            return res.status(401).json({ message: 'No cookie Found' })
        }
        try {
            //token ko check kro k woo sai haa
            let decodedPayLoad = jwt.verify(incomingRefreshToken, process.env.JWT_SECRET);
            //check kro k woo db ma bhi haa
            let tokenFromDb = await refreshTokenModel.findOne({ where: { token_string: incomingRefreshToken } });

            if (!tokenFromDb) {
                return res.status(403).json({ message: "token not found" });
            }
            if (tokenFromDb.is_used === true) {
                // REPLAY ATTACK! Delete all tokens
                await refreshTokenModel.destroy({
                    where: { user_id: tokenFromDb.user_id }
                });
                return res.status(403).json({ message: "Token already used" });
            }
            let userId = decodedPayLoad.user_id;
            let user_data = await userModel.findOne({ where: { id: userId } });
            let newAccessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
            let newRefreshToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
            await tokenFromDb.update({ is_used: true });
            await refreshTokenModel.create({ user_id: userId, token_string: newRefreshToken });
            res.cookie('refreshToken', newRefreshToken, {
                httpOnly: true,
                secure: false,
                maxAge: 7 * 24 * 60 * 60 * 1000
            })

            res.status(200).json({
                success: true,
                user: {
                    id: user_data.id,
                    name: user_data.name,
                    email: user_data.email,
                    country_code: user_data.country_code,
                    subscriber_no: user_data.subscriber_no,
                    role: user_data.role
                }
                , accessToken: newAccessToken
            });
        }
        catch (jwterror) {
            console.log(jwterror.message);
            return res.status(401).json({ message: 'Token is not correct' });
        }
    }
    catch (error) {
        console.error(error.message);
        return res.status(401).json({ message: 'Token is not ' })
    }
})
app.post('/api/create-account', async (req, res) => {
    try {
        const { name, email, pass, country_code, subscriber_no } = req.body;
        const salt = await bcrypt.genSalt(12);
        const hashpassword = await bcrypt.hash(pass, salt);
        const newuser = await userModel.create({ name, email, 'pass': hashpassword, country_code, subscriber_no });
        const accessToken = jwt.sign({ user_id: newuser.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ user_id: newuser.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        await refreshTokenModel.create({ token_string: refreshToken, user_id: newuser.id });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,// Frontend JavaScript cannot touch or steal this!
            secure: false,  // Set to true later when using production HTTPS
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days matching the token lifespan
        })

        res.status(201).json(
            {
                success: true,
                user: {
                    id: newuser.id,
                    name: newuser.name,
                    country_code: newuser.country_code,
                    subscriber_no: newuser.subscriber_no,
                    role: newuser.role
                },
                accessToken //is ko local store kroo ga 
            }
        )
    }
    catch (error) {
        console.error('Create account error:', error.message);
        res.status(500).json({ message: 'Account creation failed' });
    }
})
app.post('/api/login', async (req, res) => {
    try {
        let { email, pass } = req.body;
        let data = await userModel.findOne({ where: { email } });
        if (!data) {
            return res.status(404).json({ sucess: false, message: 'Account Not Found' });
        }
        let correctPass = await bcrypt.compare(pass, data.pass);//this will return true and false
        if (correctPass) {
            let refreshToken = jwt.sign({ user_id: data.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
            let accessToken = jwt.sign({ user_id: data.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
            await refreshTokenModel.create({ user_id: data.id, token_string: refreshToken })

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: false,
                maxAge: 7 * 24 * 60 * 60 * 1000
            })
            res.status(200).json({
                success: true,
                user: {
                    id: data.id,
                    name: data.name,
                    email: data.email,
                    country_code: data.country_code,
                    subscriber_no: data.subscriber_no,
                    role: data.role
                },
                accessToken
            });
        }
        else {
            return res.status(404).json({ sucess: false, message: 'Account Not Found' });
        }

    }
    catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, message: "incomplete or wrong body data" });
    }
})
app.get('/api/logout', async (req, res) => {
    try {
        let incomingToken = req.cookies.refreshToken;
        if (incomingToken) {
            await refreshTokenModel.update(
                { is_used: true },
                { where: { token_string: incomingToken } }
            );

        }
        else {
            console.log("Cookie not Found")
        }
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Something Went Wrong" });
    }

})
app.post('/api/create-course', upload.array('images', 10), async (req, res) => {
    try {
        const {
            courseName,
            heroText,
            courseDuration,
            feeStructure,
            fee,
            cardDescription,
            extensiveDescription,
        } = req.body;
        const topics = JSON.parse(req.body.topics);//array ko frontend maa json.stringify kr k bajaa thaa ab non stringify kia haa.
        const courseCategory = JSON.parse(req.body.courseCategory);
        let imgfiles = req.files;

        if (courseCategory.isnew === false) {
            const findCourseCategory = await courseCategoryModel.findOne({ where: { name: courseCategory.name } });
            let newCourse = await courseModel.create(
                {
                    image: imgfiles[0].filename,
                    name: courseName,
                    discription: cardDescription,
                    duration: courseDuration,
                    hero_text: heroText,
                    category_id: findCourseCategory.id,
                    fee_structure: feeStructure
                })
            await courseDetailModel.create({
                course_id: newCourse.id,
                banner: imgfiles[1].filename,
                fee,
                extensive_description: extensiveDescription,
                topics
            })
        }
        else {
            let newcategory = await courseCategoryModel.create({ name: courseCategory.name });
            let newCourse = await courseModel.create(
                {
                    image: imgfiles[0].filename,
                    name: courseName,
                    discription: cardDescription,
                    duration: courseDuration,
                    hero_text: heroText,
                    category_id: newcategory.id,
                    fee_structure: feeStructure
                })
            await courseDetailModel.create({
                course_id: newCourse.id,
                banner: imgfiles[1].filename,
                fee,
                extensive_description: extensiveDescription,
                topics
            })
        }
        res.status(200).json({ message: 'Course Created' });
    }
    catch (error) {
        console.error('Create course error:', error);
        res.status(500).json({ message: 'Course Not Created', error: error.message });
    }

})
app.get('/api/all-categories', async (req, res) => {
    try {
        let categories = await courseCategoryModel.findAll();

        res.status(200).json(categories);
    }
    catch (error) {
        console.error('CouldNot Get the categories', error);
        res.status(500).json({ message: 'CouldNot get the categories' });
    }
})
app.get('/api/all-courses', async (req, res) => {
    try {
        let limit = 10;
        //Adding square brackets [allcourses] extracts ONLY the first element (the rows array)
        // and completely skips the metadata object.
        let [allcourses] = await sequelize.query(
            "select * from courses ORDER BY id ASC Limit $1",
            { bind: [limit] }
        )
        if (allcourses.length <= 0) {
            return res.send(500).json({ message: "No Course Found" });
        }
        let lastid = allcourses[allcourses.length - 1].id;
        res.status(200).json({ allcourses, cursor: lastid })
    }
    catch (error) {
        console.error('Could not get all courses', error);
        res.status(500).json({ message: 'Couild Not Get the all courses' })
    }


})
app.get('/api/more-all-courses/:id', async (req, res) => {
    try {
        let limit = 10;
        let cursor = req.params.id; //this is the id of the last course which is shown last time.
        const [allcourses] = await sequelize.query(
            "SELECT * FROM courses WHERE id > $1 ORDER BY id ASC LIMIT $2",
            { bind: [cursor, limit] }
        )
        if (allcourses.length <= 0) {
            return res.status(500).json({ message: "No More Courses Found" });
        }
        let lastid = allcourses[allcourses.length - 1].id;
        res.status(200).json({ allcourses, cursor: lastid })
    }
    catch (error) {
        console.error('faild to load more all courses', error);
        res.status(500).json({ message: 'faild to load more all courses' });
    }

})
app.get(`/api/course/:id/details`, async (req, res) => {
    try {
        let courseId = parseInt(req.params.id);
        let [coursedata] = await sequelize.query(
            `select * from courses C 
             INNER JOIN coursedetails CD ON C.id = CD.course_id 
             where C.id = $1`,
            { bind: [courseId] }
        )
        res.status(200).send(coursedata)
    }
    catch (error) {
        console.error(error, 'Could not get the course details.')
        res.status(500).json({ message: 'could not get the course details' });
    }
})
app.get('/api/course-of-category/:id', async (req, res) => {
    try {
        let id = req.params.id;
        let courses = await courseModel.findAll({ where: { category_id: id } });
        res.status(200).send(courses);
    }
    catch (error) {
        console.error(error, 'couild not get the courses of category id');
        res.status(500).json({ message: "Could Not get the courses of the category" });
    }
})
app.post("/api/search-course", async (req, res) => {
    try {
        const course_name = req.body.product_name;

        const courseData = await courseModel.findAll({
            where: {
                name: {
                    [Op.iLike]: `%${course_name}%` //Operator and ilike is used for case insenstive searches.
                }
            }
        });

        res.status(200).json(courseData);
    } catch (error) {
        console.error(error, "Error occurred while searching for a course");
        res.status(500).json({
            message: "Error occurred while finding the course"
        });
    }
});
app.post("/api/enroll", async (req, res) => {

    try {
        let { user_id, course_id } = req.body;
        await enrollmentModel.create({
            user_id,
            course_id
        })
        res.status(200).json({ message: "Enrolled" });
    }
    catch (error) {
        console.error(error, 'Course Not Enrolled');
        res.status(500).json({ message: 'Course Not Enrolled' })
    }


})
app.get("/api/get-all-enrollments", async (req, res) => {
    try {
        let [enrolldata] = await sequelize.query(
            'select e.id ,u.name AS user_name,u.email,u.country_code,u.subscriber_no,c.name AS course_name from enrollments e INNER JOIN users u ON e.user_id=u.id INNER JOIN courses c ON e.course_id=c.id ORDER BY e.id Limit $1'
            ,
            { bind: [10] }
        )
        if (enrolldata.length <= 0) {
            return res.status(200).json({ enrolldata: [], cursor: null, loadmore: false });
        }
        else if (enrolldata.length < 10) {
            let newcursor = enrolldata[enrolldata.length - 1].id;
            return res.status(200).json({ enrolldata, cursor: newcursor, loadmore: false });
        }
        let newcursor = enrolldata[enrolldata.length - 1].id;
        res.status(200).json({ enrolldata, cursor: newcursor, loadmore: true });
    }
    catch (error) {
        console.log(error, "Error Getting all Enrollend users");
        res.status(500).json({ message: "Error Getting all Enrollend users" });
    }

})
app.post("/api/get-more-enrollments/:id", async (req, res) => {
    try {
        let id = parseInt(req.params.id);
        console.log(id);
        let [enrolldata] = await sequelize.query(
            'SELECT e.id, u.name AS user_name, u.email, u.country_code, u.subscriber_no, c.name AS course_name ' +
            'FROM enrollments e ' +
            'INNER JOIN users u ON e.user_id = u.id ' +
            'INNER JOIN courses c ON e.course_id = c.id ' +
            'WHERE e.id > $1 ' +
            'ORDER BY e.id ' +
            'LIMIT $2'
            ,
            {
                bind: [id, 10]
            }
        )
        if (enrolldata.length <= 0) {
            return res.status(200).json({ enrolldata: [], cursor: null, loadmore: false });
        }
        else if (enrolldata.length < 10) {
            let newcursor = enrolldata[enrolldata.length - 1].id;
            return res.status(200).json({ enrolldata, cursor: null, loadmore: false });
        }
        let newcursor = enrolldata[enrolldata.length - 1].id;
        res.status(200).json({ enrolldata, cursor: newcursor });
    }
    catch (error) {
        console.log(error, "Error Getting all Enrollend users");
        res.status(404).json({ message: "Error Getting more Enrollend users" });
    }
})
app.post("/api/enrollments-lessthen/:id", async (req, res) => {
    //this api is used when i accept or rejact applicant and i want to load all the data until now .
    //without this when i accept the application and fetch from other api it will starts from zero or
    //continue fetching the data 
    try {
        let enrollment_id = req.params.id;
        let [enrolldata] = await sequelize.query(
            'SELECT e.id, u.name AS user_name, u.email, u.country_code, u.subscriber_no, c.name AS course_name ' +
            'FROM enrollments e ' +
            'INNER JOIN users u ON e.user_id = u.id ' +
            'INNER JOIN courses c ON e.course_id = c.id ' +
            'WHERE e.id <= $1 ' +
            'ORDER BY e.id '
            ,
            {
                bind: [enrollment_id]
            }
        )
        res.status(200).json(enrolldata);
    }
    catch (error) {
        console.error(error, "Unable to get the enrollment records")
        res.status(404).json({ message: 'Unable to get the enrollment records' })
    }
})
app.post("/api/accept-enrollments/:id", async (req, res) => {
    try {
        let application_id = req.params.id;
        let fetch_application_data = await enrollmentModel.findOne({ where: { id: application_id } })
        if (fetch_application_data) {
            await studentModel.create({
                user_id: fetch_application_data.user_id,
                course_id: fetch_application_data.course_id
            })
            await enrollmentModel.destroy({ where: { id: application_id } });
            res.status(200).json({ message: 'Application Accepted' });
        }
        else {
            res.status(500).json({ messsage: "Application Not Accepted" })
        }
    }
    catch (error) {
        console.error(error, "Application is Not Accepted");
        res.status(500).json({ messsage: "Application Not Accepted" })
    }
})
app.post("/api/reject-enrollment/:id", async (req, res) => {
    try {
        let application_id = req.params.id;
        await enrollmentModel.destroy({ where: { id: application_id } });
        res.status(200).json({ message: 'Application Rejected' });
    }
    catch (error) {
        console.error(error, "Application Rejection Failed");
        res.status(500).json({ message: "Application Rejection Failed" })
    }

})
app.get("/api/get-pending-applications", async (req, res) => {
    try {
        let [pendings] = await sequelize.query(
            'SELECT s.id, u.name AS user_name, u.email, u.country_code, u.subscriber_no, c.name AS course_name ' +
            'FROM students s ' +
            'INNER JOIN users u ON s.user_id = u.id ' +
            'INNER JOIN courses c ON s.course_id = c.id ' +
            'WHERE s.completion_status = false ' +
            'ORDER BY s.id ' +
            'LIMIT $1',
            {
                bind: [10]
            }
        );

        // Check if no data found
        if (!pendings || pendings.length === 0) {
            return res.status(200).json({
                pendings: [],
                cursor: null,
                loadmore: false
            });
        }
        const cursor = pendings.length === 10 ? pendings[pendings.length - 1].id : null;
        if (pendings.length < 10) {
            return res.status(200).json({ pendings, cursor: cursor, loadmore: false });
        }

        res.status(200).json({
            pendings,
            cursor: cursor,
            loadmore: true
        });
    }
    catch (error) {
        console.error("Error in get-pending-applications:", error);
        res.status(500).json({
            success: false,
            message: "Unable to get pending applications"
        });
    }
});
app.post("/api/get-more-pending-applications", async (req, res) => {
    try {
        let { cursor } = req.body; // this is the id of last student table that is shown on frontend

        let [pendings] = await sequelize.query(
            'SELECT s.id, u.name AS user_name, u.email, u.country_code, u.subscriber_no, c.name AS course_name ' +
            'FROM students s ' +
            'INNER JOIN users u ON s.user_id = u.id ' +
            'INNER JOIN courses c ON s.course_id = c.id ' +
            'WHERE s.completion_status = false ' +
            'AND s.id > $2 ' +
            'ORDER BY s.id ' +
            'LIMIT $1',
            {
                bind: [10, cursor]
            }
        );

        if (!pendings || pendings.length === 0) {
            return res.status(200).json({
                pendings: [],
                cursor: null,
                loadmore: false
            });
        }
        if (pendings.length < 10) {
            return res.status(200).json({ pendings, cursor: cursor, loadmore: false });
        }


        const newCursor = pendings[pendings.length - 1].id;
        res.status(200).json({
            pendings,
            cursor: newCursor,
            loadmore: true
        });

    } catch (error) {
        console.error("Error in get-more-pending-applications:", error);
        res.status(500).json({
            message: "Unable to get more pending enrollments",
            error: error.message
        });
    }
});
app.get("/api/get-completed-applications", async (req, res) => {
    try {
        let [completed] = await sequelize.query(
            'SELECT s.id, u.name AS user_name, u.email, u.country_code, u.subscriber_no, c.name AS course_name ,s.certificate ' +
            'FROM students s ' +
            'INNER JOIN users u ON s.user_id = u.id ' +
            'INNER JOIN courses c ON s.course_id = c.id ' +
            'WHERE s.completion_status = true ' +
            'ORDER BY s.id ' +
            'LIMIT $1',
            { bind: [10] }
        )
        if (completed.length === 0) {
            return res.status(200).json({ completed, cursor: null, loadmore: false });
        }
        let newCursor = completed[completed.length - 1].id;
        if (completed.length < 10) {
            return res.status(200).json({ completed, cursor: newCursor, loadmore: false });
        }
        res.status(200).json({ completed, cursor: newcursor, loadmore: true });
    }
    catch (error) {
        console.error(error, "Unable to completed applicants")
        res.status(404).json({ message: "Unable to completed applicants" })
    }
})
app.get("/api/total-countof-all-tables", async (req, res) => {
    try {
        const number_of_enrollments = await enrollmentModel.count();
        const number_of_pendings = await studentModel.count({ where: { completion_status: false } });
        const number_of_completed = await studentModel.count({ where: { completion_status: true } });
        const number_of_courses = await courseModel.count();
        res.status(200).json({ number_of_enrollments, number_of_pendings, number_of_completed, number_of_courses });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/api/all-courses-list", async (req, res) => {
    try {
        let [courses_list] = await sequelize.query(
            "select id,name from courses"
        )
        res.status(200).json(courses_list);
    }
    catch (error) {
        console.error(error, "unable to get courses List");
        res.status(500).json("unable to get the courses list");
    }
})
app.post("/api/search-student", async (req, res) => {
    let { studentname, course_id, table_name } = req.body;
    console.log({ studentname, course_id, table_name });

    const namePattern = `%${studentname}%`;

    try {
        if (table_name === 'New Application' && course_id != 'all') {
            let [data] = await sequelize.query(
                'SELECT e.id, u.name AS user_name, u.email, u.country_code, u.subscriber_no, c.name AS course_name ' +
                'FROM enrollments e ' +
                'INNER JOIN users u ON e.user_id = u.id ' +
                'INNER JOIN courses c ON e.course_id = c.id ' +
                'WHERE u.name ILIKE $1 AND c.id = $2',
                { bind: [namePattern, course_id] }
            )
            return res.status(200).json(data);
        }
        else if (table_name === 'Pending Application' && course_id != 'all') {
            let [data] = await sequelize.query(
                'SELECT s.id, u.name AS user_name, u.email, u.country_code, u.subscriber_no, c.name AS course_name ' +
                'FROM students s ' +
                'INNER JOIN users u ON s.user_id = u.id ' +
                'INNER JOIN courses c ON s.course_id = c.id ' +
                'WHERE s.completion_status = false AND u.name ILIKE $1 AND c.id = $2',
                { bind: [namePattern, course_id] }
            )
            return res.status(200).json(data);
        }
        else if (table_name === 'Completed Application' && course_id != 'all') {
            let [data] = await sequelize.query(
                'SELECT s.id, u.name AS user_name, u.email, u.country_code, u.subscriber_no, c.name AS course_name ' +
                'FROM students s ' +
                'INNER JOIN users u ON s.user_id = u.id ' +
                'INNER JOIN courses c ON s.course_id = c.id ' +
                'WHERE s.completion_status = true AND u.name ILIKE $1 AND c.id = $2',
                { bind: [namePattern, course_id] }
            )
            return res.status(200).json(data);
        }
        else if (table_name === 'New Application' && course_id === 'all') {
            let [data] = await sequelize.query(
                'SELECT e.id, u.name AS user_name, u.email, u.country_code, u.subscriber_no, c.name AS course_name ' +
                'FROM enrollments e ' +
                'INNER JOIN users u ON e.user_id = u.id ' +
                'INNER JOIN courses c ON e.course_id = c.id ' +
                'WHERE u.name ILIKE $1',
                { bind: [namePattern] }
            )
            return res.status(200).json(data);
        }
        else if (table_name === 'Pending Application' && course_id === 'all') {
            let [data] = await sequelize.query(
                'SELECT s.id, u.name AS user_name, u.email, u.country_code, u.subscriber_no, c.name AS course_name ' +
                'FROM students s ' +
                'INNER JOIN users u ON s.user_id = u.id ' +
                'INNER JOIN courses c ON s.course_id = c.id ' +
                'WHERE s.completion_status = false AND u.name ILIKE $1',
                { bind: [namePattern] }
            )
            return res.status(200).json(data);
        }
        else {
            // Completed Application && course_id === 'all' (and fallback default)
            let [data] = await sequelize.query(
                'SELECT s.id, u.name AS user_name, u.email, u.country_code, u.subscriber_no, c.name AS course_name ' +
                'FROM students s ' +
                'INNER JOIN users u ON s.user_id = u.id ' +
                'INNER JOIN courses c ON s.course_id = c.id ' +
                'WHERE s.completion_status = true AND u.name ILIKE $1',
                { bind: [namePattern] }
            )
            return res.status(200).json(data);
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server Error", error: error.message });
    }
});
app.post("/api/upload-certificate", upload.single('file'), async (req, res) => {
    try {
        let file = req.file;
        let { student_id } = req.body;
        console.log(file.filename)
        console.log(student_id)
        let student = await studentModel.findOne({ where: { id: student_id } });
        if (student) {
            await student.update({
                certificate: file.filename,
                completion_status: true
            })
            return res.status(200).json({ message: "course completed" });
        }
        return res.status(500).json({ message: "Course Not Completed" });
    }
    catch (error) {
        console.error(error)
        res.json(404).json({ message: "unable to uplaod the file" });
    }
})
app.put("/api/update-upload-certificate", upload.single('file'), async (req, res) => {
    try {
        let { student_id } = req.body;
        let file = req.file;
        let stu = await studentModel.findOne({ where: { id: student_id } });
        if (stu) {
            stu.update({
                certificate: file.filename
            })
            return res.status(200).json({ message: "student Certificate updated" });
        }
        return res.status(200).json({ message: "unable to update the certificate" });
    }
    catch (error) {
        console.error(error);
        res.status(404).json({ message: "unable to update certificate" });

    }
})
app.post("/api/get-all-enrolled-courses/:id", async (req, res) => {
    try {
        let id = req.params.id;//student id;
        let [enrolled_data] = await sequelize.query(
            'SELECT c.name as course_name, s.completion_status, s.certificate FROM students s INNER JOIN courses c ON s.course_id = c.id WHERE s.user_id = $1 ORDER BY c.id DESC',
            { bind: [id] }
        )
        if (enrolled_data) {
            res.status(200).json(enrolled_data);
        }
        res.status(404).json("No data Found ");
    }
    catch (error) {
        console.error(error, { message: "unable to get the enrolled courses" });
        res.status(404).json("Unable to fetch the courses");
    }
})