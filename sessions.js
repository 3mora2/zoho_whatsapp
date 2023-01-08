'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const wppconnect = require('@wppconnect-team/wppconnect');
const axios = require('axios');
const zoho = require("./functions");
const {sendEmail} = require("./functions");


class Sessions {
    static async start(sessionName, options_req = {}, options = []) {
        Sessions.options = Sessions.options || options; //start object
        Sessions.sessions = Sessions.sessions || []; //start array

        var session = Sessions.getSession(sessionName);
        if (session == false) { //create new session
            console.log("session == false >>> Not found.");
            session = await Sessions.addSesssion(sessionName, options_req);
        } else if (["CLOSED"].includes(session.state)) { //restart session
            console.log("session.state == CLOSED");
            session.state = "STARTING";
            session.status = 'notLogged';
            session.client = Sessions.initSession(sessionName, options_req);
            Sessions.setup(sessionName);
        } else if (["CONFLICT", "UNPAIRED", "UNLAUNCHED"].includes(session.state)) {
            console.log("client.useHere()");
            session.client.then(client => {
                client.useHere();
            });
        } else {
            console.log("session.state: " + session.state);
        }
        return session;
    }
    static getSession(sessionName) {
            var foundSession = false;
            if (Sessions.sessions)
                Sessions.sessions.forEach(session => {
                    if (sessionName == session.name) {
                        foundSession = session;
                    }
                });
            return foundSession;
        } //getSession

    static getSessions() {
            if (Sessions.sessions) {
                return Sessions.sessions;
            } else {
                return [];
            }
        } //getSessions
    static async addSesssion(sessionName, options_req = {}) {
            var newSession = {
                name: sessionName,
                hook: null,
                qrcode: false,
                client: false,
                status: 'notLogged',
                state: 'STARTING',
                sendStatus: true
            }
            Sessions.sessions.push(newSession);
            console.log("newSession: " + newSession.name + ", newSession.state: " + newSession.state);

            //setup session
            newSession.client = Sessions.initSession(sessionName, options_req);
            Sessions.setup(sessionName);

            return newSession;
        } //addSession

    static async initSession(sessionName, options_req = {}) {
            var session = Sessions.getSession(sessionName);

            const client = await wppconnect.create({
                session: sessionName,
                catchQR: (base64Qrimg, asciiQR, attempts, urlCode) => {
                    session.state = "QRCODE";
                    session.qrcode = base64Qrimg;
                    session.CodeasciiQR = asciiQR;
                    session.CodeurlCode = urlCode;
                },
                statusFind: (statusSession, sessionName) => {
                    console.log(`${sessionName}:${statusSession}`);
                    if (["browserClose", 'serverClose', "autocloseCalled"].includes(statusSession)) {
                        session.state = "CLOSED";
                        session.client = false;
                        console.log("client.close - session.state: " + session.state);
                    }
                    sendEmail(StatusFind[statusSession])
                },
                headless: false, // Headless chrome
                useChrome: true, // If false will use Chromium instance
                logQR: true, // Logs QR automatically in terminal
                updatesLog: true, // Logs info updates automatically in terminal
                autoClose: 0, // Automatically closes the wppconnect only when scanning the QR code (default 60 seconds, if you want to turn it off, assign 0 or false)


            });
            wppconnect.defaultLogger.level = 'silly'
            session.state = "CONNECTED";
            return client;
        } //initSession
    static async setup(sessionName) {

            // update token and message
            var session = Sessions.getSession(sessionName);

            await session.client.then(client => {
                client.onStateChange(state => {
                    session.state = state;
                    sendEmail(SocketState[state])
                    if (state === "CONNECTED") {
                        //    ToDo: Update token
                    } //if CONNECTED

                    console.log(`${sessionName}:${state}`);
                });
                client.onMessage(async(message) => {
                    let msgs = await client.getMessages(message.from)
                    msgs = msgs.filter((r) => r.fromMe)
                    if (msgs.length === 0) {
                        zoho(message)
                    }
                });
            });
        } //setup
    static async getStatus(sessionName, options = []) {
            Sessions.options = Sessions.options || options;
            Sessions.sessions = Sessions.sessions || [];

            var session = Sessions.getSession(sessionName);
            return session;
        } //getStatus
    static async getQrcode(sessionName) {
            var session = Sessions.getSession(sessionName);
            if (session) {
                //if (["UNPAIRED", "UNPAIRED_IDLE"].includes(session.state)) {
                if (["UNPAIRED_IDLE"].includes(session.state)) {
                    //restart session
                    await Sessions.closeSession(sessionName);
                    Sessions.start(sessionName);
                    return { result: "error", message: session.state };
                } else if (["CLOSED"].includes(session.state)) {
                    Sessions.start(sessionName);
                    return { result: "error", message: session.state };
                } else { //CONNECTED
                    if (session.status != 'isLogged') {
                        return { result: "success", message: session.state, qrcode: session.qrcode };
                    } else {
                        return { result: "success", message: session.state };
                    }
                }
            } else {
                return { result: "error", message: "NOTFOUND" };
            }
        } //getQrcode
    static async closeSession(sessionName) {
            var session = Sessions.getSession(sessionName);
            if (session) {
                if (session.state !== "CLOSED") {
                    if (session.client)
                        await session.client.then(async client => {
                            try {
                                await client.close();
                            } catch (error) {
                                console.log("client.close(): " + error.message);
                            }
                            session.state = "CLOSED";
                            session.client = false;
                            console.log("client.close - session.state: " + session.state);
                        });
                    return { result: "success", message: "CLOSED" };
                } else { //close
                    return { result: "success", message: session.state };
                }
            } else {
                return { result: "error", message: "NOTFOUND" };
            }
        } //close

}

module.exports = Sessions


let StatusFind = {
    "autocloseCalled":{"text":"The browser was closed using the autoClose.", "send":true},
    "browserClose":{"text":"If the browser is closed this parameter is returned.", "send":true},
    "desconnectedMobile":{"text":"Client has disconnected in to mobile.", "send":true},
    "inChat":{"text":"Client is ready to send and receive messages.", "send":false},
    "isLogged":{"text":"When the user is already logged in to the browser.", "send":false},
    "notLogged":{"text":"When the user is not connected to the browser, it is necessary to scan the QR code through the cell phone in the option WhatsApp Web.", "send":true},
    "phoneNotConnected":{"text":"Client couldn't connect to phone.", "send":true},
    "qrReadError":{"text":"Failed to authenticate.", "send":true},
    "qrReadFail":{"text":"If the browser stops when the QR code scan is in progress, this parameter is returned.", "send":true},
    "qrReadSuccess":{"text":"If the user is not logged in, the QR code is passed on the terminal a callback is returned. After the correct reading by cell phone this parameter is returned.", "send":true},
    "serverClose":{"text":"Client has disconnected in to wss.", "send":true}
    }

let SocketState = {
    "CONFLICT":{"text":"Conflic page, when there are another whatsapp web openned.","send":true},
    "CONNECTED":{"text":"When the whatsapp web is ready.","send":false},
    "DEPRECATED_VERSION":{"text":"Deprecated page.","send":true},
    "OPENING":{"text":"When the whatsapp web page is loading.","send":false},
    "PAIRING":{"text":"When the whatsapp web is connecting to smartphone after QR code scan.","send":false},
    "PROXYBLOCK":{"text":"Blocked page, by proxy.","send":true},
    "SMB_TOS_BLOCK":{"text":"Blocked page.","send":true},
    "TIMEOUT":{"text":"When the whatsapp web couldn't connect to smartphone.","send":true},
    "TOS_BLOCK":{"text":"Blocked page.","send":true},
    "UNLAUNCHED":{"text":"When the whatsapp web page is initialized yet.","send":true},
    "UNPAIRED":{"text":"Disconnected page, waiting for QRCode scan","send":true},
    "UNPAIRED_IDLE":{"text":"Disconnected page with expired QRCode","send":true}
}