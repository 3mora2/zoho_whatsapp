const axios = require("axios");
var nodemailer = require('nodemailer');
require('dotenv').config();

let webhook = process.env.WEBHOOK

function zoho(sender) {
    var data = JSON.stringify({
        "name": sender.pushname,
        "number": sender.id.split("@")[0]
    });

    var config = {
        method: 'post',
        url: webhook,
        headers: {
            'Content-Type': 'application/json'
        },
        data: data
    };

    axios(config)
        .then(function(response) {
            console.log(JSON.stringify(response.data));
        })
        .catch(function(error) {
            console.log(error);
        });
}

function sendEmail(data) {
    let email = process.env.EMAIL
    let password = process.env.PASSWORD
    if (data.send) {
        try {
            console.log(data.text)

            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: email,
                    pass: password
                }
            });

            let mailOptions = {
                from: email,
                to: email,
                subject: 'Whatsapp Status',
                text: `Whatsapp Status: ${data.text}`
            };

            transporter.sendMail(mailOptions, function(error, info) {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Email sent: ' + info.response);
                }
            });
        } catch (e) {
            console.log(e)
        }
    }
}
module.exports = zoho
module.exports.sendEmail = sendEmail