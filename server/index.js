const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { connected } = require('process');
const { type } = require('os');
const { timeStamp, count } = require('console');

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
    //read role from query param:?role=driver or ?role=passenger
    const url=new URL(req.url,'http://localhost:${PORT}');
    const role=url.searchParams.get('role') || 'passenger';
    const busId=url.searchParams.get('busId') || 'BUS-001';

    ws.role=role;
    ws.busId=busId;
    ws.isAlive=true;

    console.log('[WS] ${role.toUpperCase()} connected (total clients: ${wss.clients.size})');

    if(role==='driver'){
        driverConnected=true;
        sessionStart=sessionStart || new Date().toISOString();
        fixHistory.length=0; //fresh trail for new session
        fixCount=0;

        //tell driver their connection is confirmed
        safeSend(ws,{type:'driver_ack',message:'connected to server. GPS broadcast active.',busId});

        //tell all passengers driver come online
        borascast({type:'driver_online',busId},'passenger');
        updatePassengerCount();
    }
    if(roll === 'passenger'){
        passengerCount = CountRole('passenger');

        //send lartest know fix immediately so map isnt blank
        if(latestFix){
            safeSend(ws,{type:'location',...lartestFix,trail:fixHistory.slice(-50)});
        }
        safeSend(ws,{
            type:'server_info',
            driverConnected,
            passengerCount,
            fixCount
        });

        //tell driver passenger count updated
        broadcastToDrivers({type:'passenger_count',count:CountRole('passenger')+1});
    }

//message handler
ws.on('message',(raw)=>{
    let msg;
    try{msg = JSON.parse(raw);}catch{return;}

    if(ws.role === 'driver' && msg.type === 'location'){
        //core driver send GPS fix
        fixCount++;
        latestFix={
            lat:msg.lat,
            lng:msg.lng,
            speed:msg.speed,
            heading:msg.heading,
            accuracy:msg.accuracy,
            altitude:msg.altitude,
            timeStamp:msg.timeStamp || Date.now(),
            fixCount,
            busId:ws.busId
        };
        //state in trail(keep last 500)
        fixHistory.push({lat:msg.lat,lng:msg.lng,t:Date.now()});
        if(fixHistory.length>500)fixHistory.shift();

        //broadcast to all passegers
        const payload = {type:'location',...latestFix};
        broadcast(payload,'passenger');

        //ack back to driver
        safeSend(ws,{type:'ack',fixCount,passengers:CountRole('passenger')});

        if(fixCount %10 ===0){
            console.log(`[GPS Fix #${fixCount} lat:${msg.lat.toFixed(5)} lng:${msg.lng.toFixed(5)} passengers:${countRole('passengers')}]`);
        }
    }
    if(msg.type === 'ping'){
        safeSend(ws,{type:'pong',ts:Date.now()});
    }
});
    //disconnect
    ws.on('close',()=>{
        console.log(`[WS] ${ws.role.toUpperCase()}disconnected`);
        if(ws.role === 'driver'){
            driverConnected= false
            broadcast({type:'driver_offline'},'passenger');
        }
        if(ws.role === 'passenger'){
            broadcastToDrivers({type:'passenger_count',count:countRole('passenger')});
        }
    });
    ws.on('error',(err)=>console.error('[WS Error]',err.message));

    //heatbeat pong
    ws.on('pong',()=>{ws.isAlive=true;});
});

//heatbeat drop dead connections every 30s
setInterval(()=>{
    wss.clients.forEach(ws=>{
        if(!ws.isAlive){ws.terminate();return;}
        ws.isAlive=false;
        ws.ping();
    });
},30000);

//helper
function safeSend(ws,data){
    if(ws.readyState === WebSocket.OPEN){
        ws.send(JSON.stringify(data));
    }
}

function broadcast(data,toRole){
    wss.clients.forEach(ws=>{
        if(!toRole || ws.role === toRole)safeSend(ws,data);
    });
}

function broadcastToDrivers(data){
    broadcast(data,'driver');
}

function countRole(role){
    let n = 0;
    wss.clients.forEach(ws=>{
        if(ws.role === role)n++;
    });
    return n;
}

function updatePassengerCount(){
    broadcastToDrivers({type:'passenger_count',count:countRole('passenger')});
}

//clean URL routes
app.get('/driver',(req,res)=> res.sendFile(path.join(__dirname,'../public/driver.html')));
app.get('/passenger',(req,res)=> res.sendFile(path.join(__dirname,'../pblic/passenger.html')));

// 404 fallback -> index.html
app.get('*',(req,res)=>{
    res.sendFile(path.join(__dirname,'../public/index.html'));
});

//start
server.listen(PORT,()=>{
    console.log('\n------------------------------------------------');
    console.log('          BusTrack GPS Tracking Server            ');
    console.log('\n------------------------------------------------');
    console.log(`  Web UI  →  http://localhost:${PORT}             `);
    console.log(`  Driver  →  http://localhost:${PORT}/driver      `);
    console.log(`  Passenger→ http://localhost:${PORT}/passenger   `);
    console.log(`  API     →  http://localhost:${PORT}/api/status  `);
    console.log('\n------------------------------------------------');
})
