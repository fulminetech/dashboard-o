var ModbusRTU = require("modbus-serial");
const express = require("express");
const { exec } = require('child_process');
const restartCommand = "pm2 restart 0";

const app = express();

// Timestamp for which returns current date and time 
var noww = new Date().toLocaleString(undefined, { timeZone: 'Asia/Kolkata' });
console.log(`[ STARTING: ${noww} ]`)
var startTime = + new Date();

// Modbus configs
var client = new ModbusRTU();
const timeOut = 500;
console.log(`[ MODBUS TIMEOUT: ${timeOut} ]`);
const slaveID = 1;
const baudRate = 115200;
console.log(`[ BAUDRATE: ${baudRate} ]`);

// Modbus Addresses
const precompression_address = 6396;
const maincompression_address = 6196;
const ejection_address = 6296;
const avg_address = 6496;

const time_address = 4196;
const status_address = 2588;
const stats_address = 8096;

// Data Structure
var machine = {
    maincompression_upperlimit: 0,
    maincompression_lowerlimit: 0,
    precompression_upperlimit: 0,
    precompression_lowerlimit: 0,
    ejection_upperlimit: 0,
    stats: {
        count: 0,
        tablets_per_hour: 0,
        rpm: 0,
        active_punches: 0,
        mainMotor_trip: false,
        feederMotor_trip: false,
        emergencyStop_pressed: false,
        safetyguard_open: false,
        system_overload: false,
        uptime: 0,
    },
    control: {
        inching: false,
        machine_start: false,
        machine_stop: false,
        turret_run: false,
        turret_rpm: 0,
        forceFeeder_rpm: 0,
    },
    time: {
        date: 0,
        month: 0,
        year: 0,
        hour: 0,
        minute: 0,
        second: 0,
    }
};

var payload = {
    batch: 0,
    data_number: 0, // Rotation Number
    rotation_no: 0,
    present_punch: 0,
    punch1: {
        precompression: 0,
        maincompression: 0,
        ejection: 0,
        status: false
    },
    punch2: {
        precompression: 0,
        maincompression: 0,
        ejection: 0,
        status: false
    },
    punch3: {
        precompression: 0,
        maincompression: 0,
        ejection: 0,
        status: false
    },
    punch4: {
        precompression: 0,
        maincompression: 0,
        ejection: 0,
        status: false
    },
    punch5: {
        precompression: 0,
        maincompression: 0,
        ejection: 0,
        status: false
    },
    punch6: {
        precompression: 0,
        maincompression: 0,
        ejection: 0,
        status: false
    },
    punch7: {
        precompression: 0,
        maincompression: 0,
        ejection: 0,
        status: false
    },
    punch8: {
        precompression: 0,
        maincompression: 0,
        ejection: 0,
        status: false
    },
    precompression_avg: 0,
    maincompression_avg: 0,
    ejection_avg: 0,
};

// Modbus 'state' constants
var MBS_STATE_INIT = "State init";

var MBS_STATE_GOOD_READ_TIME = "State good time (read)";
var MBS_STATE_GOOD_READ_PRE = "State good pre (read)";
var MBS_STATE_GOOD_READ_MAIN = "State good main (read)";
var MBS_STATE_GOOD_READ_EJN = "State good ejn (read)";
var MBS_STATE_GOOD_READ_AVG = "State good avg (read)";
var MBS_STATE_GOOD_READ_STATUS = "State good status (read)";
var MBS_STATE_GOOD_READ_STATS = "State good stats (read)";

var MBS_STATE_FAIL_READ_TIME = "State fail time (read)";
var MBS_STATE_FAIL_READ_PRE = "State fail pre (read)";
var MBS_STATE_FAIL_READ_MAIN = "State fail main (read)";
var MBS_STATE_FAIL_READ_EJN = "State fail ejn (read)";
var MBS_STATE_FAIL_READ_AVG = "State fail avg (read)";
var MBS_STATE_FAIL_READ_STATUS = "State fail status (read)";
var MBS_STATE_FAIL_READ_STATS = "State fail stats (read)";

var MBS_STATE_GOOD_CONNECT = "State good (port)";
var MBS_STATE_FAIL_CONNECT = "State fail (port)";

var mbsState = MBS_STATE_INIT;

var mbsTimeout = 1000;
var mbsScan = 53;

let failedPreRead = 0;
let failcounter = 5;
let timecheck = 3;
let timetemp = 0;

//  Make physical connection
var connectClient = function () {
    client = new ModbusRTU();

    client.setID(slaveID);
    client.setTimeout(mbsTimeout);

    client.connectRTUBuffered("/dev/ttyUSB0", { baudRate: baudRate, parity: 'none' })
        .then(function () {
            mbsState = MBS_STATE_GOOD_CONNECT;
            
            console.log(`[ CONNECTED ]`)
        })
        .then(function () {
            runModbus()
        })
        .catch(function (e) {
            mbsState = MBS_STATE_FAIL_CONNECT;
            console.log(`[ FAILED TO CONNECT ]`)
            console.log(e);
        });
}

connectClient()



// Sync Time from PLC
var syncplctime = function () {
    client.readHoldingRegisters(time_address, 6)
        .then(function (plcTime) {
            exec(`sudo timedatectl set-time '20${plcTime.data[2]}-${plcTime.data[1]}-${plcTime.data[0]} ${plcTime.data[3]}:${plcTime.data[4]}:${plcTime.data[5]}'`, (err, stdout, stderr) => {
                console.log(`[ Time updated! ]`)
            })
        })
        .then(function () {
            mbsState = MBS_STATE_GOOD_READ_TIME;
        })
        .catch(function (e) {
            timetemp++
            if (timetemp < timecheck) {
                mbsState = MBS_STATE_GOOD_CONNECT;
                console.log(mbsState)
            } else {
                console.log(mbsState)
                mbsState = MBS_STATE_FAIL_READ_TIME;
            }
        })
}

// Run MODBUS
var runModbus = function () {
    var nextAction;
    switch (mbsState) {
        case MBS_STATE_INIT:
            nextAction = connectClient;
            break;

        case MBS_STATE_GOOD_CONNECT:
            nextAction = syncplctime;
            break;

        case MBS_STATE_GOOD_READ_TIME || MBS_STATE_FAIL_READ_TIME:
            nextAction = readpre;
            break;

        case MBS_STATE_GOOD_READ_PRE || MBS_STATE_FAIL_READ_PRE:
            nextAction = readmain;
            break;

        case MBS_STATE_GOOD_READ_MAIN || MBS_STATE_FAIL_READ_MAIN:
            nextAction = readejn;
            break;

        case MBS_STATE_GOOD_READ_EJN || MBS_STATE_FAIL_READ_EJN:
            nextAction = readavg;
            break;

        case MBS_STATE_GOOD_READ_AVG || MBS_STATE_FAIL_READ_AVG:
            nextAction = readstatus;
            break;

        case MBS_STATE_GOOD_READ_STATUS || MBS_STATE_FAIL_READ_STATUS:
            nextAction = readpre;
            break;

        case MBS_STATE_FAIL_CONNECT:
            nextAction = connectClient;
            break;

        default:
        // nothing to do, keep scanning until actionable case
    }

    //console.log();
    console.log(nextAction);

    machine.stats.status = "ONLINE";

    // execute "next action" function if defined
    if (nextAction !== undefined) {
        nextAction();
    } else {
        readpre();
    }

    // set for next run
    setTimeout(runModbus, mbsScan);
}

var readpre = function () {
    client.readHoldingRegisters(precompression_address, 8)
        .then(function (precompression) {
            payload.punch1.precompression = precompression.data[0] / 100;
            payload.punch2.precompression = precompression.data[1] / 100;
            payload.punch3.precompression = precompression.data[2] / 100;
            payload.punch4.precompression = precompression.data[3] / 100;
            payload.punch5.precompression = precompression.data[4] / 100;
            payload.punch6.precompression = precompression.data[5] / 100;
            payload.punch7.precompression = precompression.data[6] / 100;
            payload.punch8.precompression = precompression.data[7] / 100;

            mbsState = MBS_STATE_GOOD_READ_PRE;
            // console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
        .catch(function (e) {
            console.log('#1 Precompression Garbage')
            mbsState = MBS_STATE_FAIL_READ_PRE;

            failedPreRead++;
            if (failedPreRead > failcounter) {
                console.log("FAILED: " + failedPreRead)
                failedPreRead = 0;
                restartprodmodbus();
            }

            console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
}

var readmain = function () {
    client.readHoldingRegisters(maincompression_address, 8)
        .then(function (maincompression) {
            payload.punch1.maincompression = maincompression.data[0] / 100;
            payload.punch2.maincompression = maincompression.data[1] / 100;
            payload.punch3.maincompression = maincompression.data[2] / 100;
            payload.punch4.maincompression = maincompression.data[3] / 100;
            payload.punch5.maincompression = maincompression.data[4] / 100;
            payload.punch6.maincompression = maincompression.data[5] / 100;
            payload.punch7.maincompression = maincompression.data[6] / 100;
            payload.punch8.maincompression = maincompression.data[7] / 100;

            mbsState = MBS_STATE_GOOD_READ_MAIN;
            // console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
        .catch(function (e) {
            console.log('#2 Maincompression Garbage')
            mbsState = MBS_STATE_FAIL_READ_MAIN;

            failedPreRead++;
            if (failedPreRead > failcounter) {
                console.log("FAILED: " + failedPreRead)
                failedPreRead = 0;
                restartprodmodbus();
            }
            console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
}

var readejn = function () {
    client.readHoldingRegisters(ejection_address, 8)
        .then(function (ejection) {
            payload.punch1.ejection = ejection.data[0] / 1000;
            payload.punch2.ejection = ejection.data[1] / 1000;
            payload.punch3.ejection = ejection.data[2] / 1000;
            payload.punch4.ejection = ejection.data[3] / 1000;
            payload.punch5.ejection = ejection.data[4] / 1000;
            payload.punch6.ejection = ejection.data[5] / 1000;
            payload.punch7.ejection = ejection.data[6] / 1000;
            payload.punch8.ejection = ejection.data[7] / 1000;

            mbsState = MBS_STATE_GOOD_READ_EJN;
            // console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
        .catch(function (e) {
            console.log('#3 Ejection Garbage')
            mbsState = MBS_STATE_FAIL_READ_EJN;

            failedPreRead++;
            if (failedPreRead > failcounter) {
                console.log("FAILED: " + failedPreRead)
                failedPreRead = 0;
                restartprodmodbus();
            }
            console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
}

var readavg = function () {
    client.readHoldingRegisters(avg_address, 3)
        .then(function (avg) {
            payload.maincompression_avg = avg.data[0] / 100;
            payload.precompression_avg = avg.data[1] / 100;
            payload.ejection_avg = avg.data[2] / 100;

            mbsState = MBS_STATE_GOOD_READ_AVG;
            // console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
        .catch(function (e) {
            console.log('#4 Avg Garbage')
            mbsState = MBS_STATE_FAIL_READ_AVG;

            failedPreRead++;
            if (failedPreRead > failcounter) {
                console.log("FAILED: " + failedPreRead)
                failedPreRead = 0;
                restartprodmodbus();
            }
            console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
}

var readstatus = function () {
    client.readCoils(status_address, 8)
        .then(function (punch_status) {
            payload.punch1.status = punch_status.data[0];
            payload.punch2.status = punch_status.data[1];
            payload.punch3.status = punch_status.data[2];
            payload.punch4.status = punch_status.data[3];
            payload.punch5.status = punch_status.data[4];
            payload.punch6.status = punch_status.data[5];
            payload.punch7.status = punch_status.data[6];
            payload.punch8.status = punch_status.data[7];

            mbsState = MBS_STATE_GOOD_READ_STATUS;
            // console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
        .catch(function (e) {
            console.log('#6 Status Garbage')
            mbsState = MBS_STATE_FAIL_READ_STATUS;

            failedPreRead++;
            if (failedPreRead > failcounter) {
                console.log("FAILED: " + failedPreRead)
                failedPreRead = 0;
                restartprodmodbus();
            }
            console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
}

var readstats = function () {
    client.readHoldingRegisters(stats_address, 11)
        .then(function (stats_data) {
            // machine.stats.active_punches = stats_data.data[0];
            // payload.data_number = stats_data.data[1];
            // payload.present_punch = stats_data.data[2];
            // machine.stats.count = stats_data.data[3];
            // machine.stats.tablets_per_hour = stats_data.data[4];
            // machine.control.turret_rpm = stats.data[5];
            // machine.maincompression_upperlimit = stats_data.data[6];
            // machine.maincompression_lowerlimit = stats_data.data[7];
            // machine.precompression_upperlimit = stats_data.data[8];
            // machine.precompression_lowerlimit = stats_data.data[9];
            // machine.ejection_upperlimit = stats_data.data[10];

            mbsState = MBS_STATE_GOOD_READ_STATS;
            console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
        .catch(function (e) {
            console.log('#7 Stats Garbage')
            mbsState = MBS_STATE_FAIL_READ_STATS;

            failedPreRead++;
            if (failedPreRead > failcounter) {
                console.log("FAILED: " + failedPreRead)
                failedPreRead = 0;
                restartprodmodbus();
            }
            console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
}

function restartprodmodbus() {
    exec(restartCommand, (err, stdout, stderr) => {
        if (!err && !stderr) {
            console.log(new Date().toLocaleString(undefined, { timeZone: 'Asia/Kolkata' }), `App restarted!!!`);
        }
        else if (err || stderr) {
            console.log(new Date().toLocaleString(undefined, { timeZone: 'Asia/Kolkata' }), `Error in executing ${restartCommand}`, err || stderr);
        }
    });
}

app.use("/api/payload", (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.json(payload);
});

app.use("/api/machine", (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.json(machine);
});

// Start Server
const port = 3128;
app.listen(port, () => console.log(`Server running on port ${port} 🔥`));