const mysql = require('mysql2');
const nodemailer = require('nodemailer');
const moment = require('moment');
const fs = require('fs');
const cron = require('node-cron');

const db = mysql.createConnection({
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
});

const dkimPrivateKey = (process.env.DKIM_PRIVATE_KEY_PATH && fs.readFileSync(process.env.DKIM_PRIVATE_KEY_PATH, 'utf8')) || process.env.DKIM_PRIVATE_KEY;

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD
    },
    tls: {
        rejectUnauthorized: false
    },
    dkim: {
        domainName: process.env.DOMAIN_NAME,
        keySelector: 'dkim',
        privateKey: dkimPrivateKey
    }
});

const sendBirthdayReminder = (email, name, friendName, friendBirthday) => {
    const mailOptions = {
        from: `${process.env.MAIL_USER}`,
        to: email,
        subject: 'Upcoming Friend\'s Birthday Reminder',
        text: `Dear ${name},\n\nThis is a friendly reminder that your friend ${friendName}'s birthday is on ${friendBirthday}.\n\nBest regards,\n366dates.com`
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
    const daysTo = 20;
    const reminderDate = today.add(daysTo - 1, 'days');

    const month = reminderDate.month() + 1;
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