const express = require('express');
const morgan = require('morgan');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));
const Sessions = require("./sessions");

app.get("/", async(req, res, next) => {
    var result = { "result": "ok" };
    res.json(result);
}); //

app.get('/start', async(req, res, next) => {
    console.log("starting..." + req.query.sessionName + ', port: ' + req.query.port);
    options_req = {
        port: req.query.port,
        width: req.query.width,
        height: req.query.height,
        browserWS: req.query.browserWS,
    }
    var session = await Sessions.start(req.query.sessionName, options_req);
    if (["CONNECTED", "QRCODE", "STARTING"].includes(session.state)) {
        res.status(200).json({ result: 'success', message: session.state });
    } else {
        res.status(200).json({ result: 'error', message: session.state });
    }
});

app.get("/status", async(req, res, next) => {
    var session = await Sessions.getStatus(req.query.sessionName);
    console.log(session);
    res.status(200).json({
        result: (!session.state) ? 'NOT_FOUND' : session.state
    });
}); //status


app.get("/qrcode", async(req, res, next) => {
    console.log("qrcode..." + req.query.sessionName);
    var session = Sessions.getSession(req.query.sessionName);

    if (session != false) {
        if (session.status != 'isLogged') {
            if (req.query.image && session.qrcode) {
                const imageBuffer = Buffer.from(session.qrcode)
                res.send(`<img src="${imageBuffer}" />`);

            } else {
                res.status(200).json({ result: "success", message: session.state, qrcode: session.qrcode });
            }
        } else {
            res.status(200).json({ result: "error", message: session.state });
        }
    } else {
        res.status(200).json({ result: "error", message: "NOTFOUND" });
    }
}); //qrcode


app.get("/close", async(req, res, next) => {
    var result = await Sessions.closeSession(req.query.sessionName);
    res.json(result);
}); //close




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
// nodemon app


process.stdin.resume(); //so the program will not close instantly
async function exitHandler(options, exitCode) {
    if (options.cleanup) {
        console.log('cleanup');
        await Sessions.getSessions().forEach(async session => {
            await Sessions.closeSession(session.sessionName);
        });
    }
    if (exitCode || exitCode === 0) {
        console.log(exitCode);
    }

    if (options.exit) {
        process.exit();
    }
} //exitHandler 
//do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }));
//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }));
// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));
//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: false }));

// process.on('uncaughtException', (error) => {
//     console.log(error);
// });
// pkg . --targets node16-win-x64 --compress GZip