const mysql = require('mysql2');
const nodemailer = require('nodemailer');
const moment = require('moment');
const cron = require('node-cron');

const db = mysql.createConnection({
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER + '@' + process.env.MAIL_DOMAIN,
        pass: process.env.MAIL_PASSWORD
    }
});

const sendBirthdayReminder = (email, name, friendName, friendBirthday) => {
    const mailOptions = {
        from: process.env.MAIL_USER + '@' + process.env.MAIL_DOMAIN,
        to: email,
        subject: 'Upcoming Friend\'s Birthday Reminder',
        text: `Dear ${name},\n\nThis is a friendly reminder that your friend ${friendName}'s birthday is on ${friendBirthday}.\n\nBest regards,\nYour Reminder App`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        console.log('Email sent: ' + info.response);
    });
};

const checkFriendsBirthdays = () => {
    const today = moment();
    const reminderDate = today.add(20, 'days');

    const month = reminderDate.month() + 1; // Months are 0-based in moment.js
    const day = reminderDate.date();

    db.query('SELECT id, email, name FROM users', (error, users) => {
        if (error) throw error;

        users.forEach(user => {
            db.query(
                'SELECT DISTINCT u.email, u.name, u.month, u.day FROM friendships f INNER JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? AND u.month = ? AND u.day = ?',
                [user.id, month, day],
                (error, friends) => {
                    if (error) throw error;

                    friends.forEach(friend => {
                        const friendBirthday = `${friend.month}/${friend.day}`;
                        sendBirthdayReminder(user.email, user.name, friend.name, friendBirthday);
                    });
                }
            );
        });
    });
};

cron.schedule('0 0 * * *', () => {
    checkFriendsBirthdays();
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to database');
    checkFriendsBirthdays();
});