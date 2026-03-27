const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"LMS" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}`);
  } catch (err) {
    console.error('Email error:', err);
  }
};

const sendEmailWithAttachment = async (to, subject, html, attachments = []) => {
  try {
    await transporter.sendMail({
      from: `"LMS" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      attachments,
    });
    console.log(`Email with attachment sent to ${to}`);
  } catch (err) {
    console.error('Email with attachment error:', err);
  }
};

module.exports = { sendEmail, sendEmailWithAttachment };
