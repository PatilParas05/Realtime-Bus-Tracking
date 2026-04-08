const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

//serve static frontend files
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

//in memory state
let latestFix = null; //most recent GPS fix from driver
let driverConnected = false; //true if driver is connected
let fixCount = 0; //number of GPS fixes sent by driver
let passengerCount = 0; //number of passengers connected
let sessionStart = null; //start time of current session
const fixHistory = []; //last 200 fixes for trail

//REST API
app.get('/api/status', (req, res) => {
    res.json({
        driverConnected,
        latestFix,
        fixCount,
        passengerCount,
        sessionStart,
        trail: fixHistory.slice(-50) //last 50 points
    });
});

//get full trail
app.get('/api/trail',(req,res)=>{
    res.json({trail:fixHistory});
});

//websocket handler
wss.on('conection',(ws,req)=>{
    const url=new URL(req.url,'http://localhost:${PORT}');
    const role=url.searchParams.get('role') || 'passenger';
    const busId=url.searchParams.get('busId') || 'BUS-001';
})
