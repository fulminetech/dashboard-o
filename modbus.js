var ModbusRTU = require("modbus-serial");
const express = require("express");
const { exec } = require('child_process');
const restart1Command = "pm2 restart prod-modbus"

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
    main_forceline: 0,
    pre_forceline: 0,
    ejn_forceline: 0,
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
var mbsScan = 35;

let readfailed = 0;
let failcounter = 15;

let timecheck = 3;
let timetemp = 0;

// Write Registers
var tablets_per_hour = 0;

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
            nextAction = readstats;
            break;

        case MBS_STATE_GOOD_READ_STATS || MBS_STATE_FAIL_READ_STATS:
            nextAction = readpre;
            break;

        case MBS_STATE_FAIL_CONNECT:
            nextAction = connectClient;
            break;

        default:
        // nothing to do, keep scanning until actionable case

    }

    //console.log();
    // console.log(nextAction);

    machine.stats.status = "ONLINE";

    if (readfailed > failcounter) {
        readfailed = 0;
        restartprodmodbus();
    }

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
            console.error('[ #1 Precompression Garbage ]')
            mbsState = MBS_STATE_FAIL_READ_PRE;
            readfailed++;
            //console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
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
            console.error('[ #2 Maincompression Garbage ]')
            mbsState = MBS_STATE_FAIL_READ_MAIN;
            readfailed++;
            //console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
}

var readejn = function () {
    client.readHoldingRegisters(ejection_address, 8)
        .then(function (ejection) {
            payload.punch1.ejection = ejection.data[0] / 100;
            payload.punch2.ejection = ejection.data[1] / 100;
            payload.punch3.ejection = ejection.data[2] / 100;
            payload.punch4.ejection = ejection.data[3] / 100;
            payload.punch5.ejection = ejection.data[4] / 100;
            payload.punch6.ejection = ejection.data[5] / 100;
            payload.punch7.ejection = ejection.data[6] / 100;
            payload.punch8.ejection = ejection.data[7] / 100;

            mbsState = MBS_STATE_GOOD_READ_EJN;
            // console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
        .catch(function (e) {
            console.error('[ #3 Ejection Garbage ]')
            mbsState = MBS_STATE_FAIL_READ_EJN;
            readfailed++;
            // console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
}

var readavg = function () {
    client.readHoldingRegisters(avg_address, 3)
        .then(function (avg) {
            console.log(avg.data)
            payload.maincompression_avg = avg.data[0] / 100;
            payload.ejection_avg = avg.data[1] / 100;
            payload.precompression_avg = avg.data[2] / 100;

            mbsState = MBS_STATE_GOOD_READ_AVG;
            // console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
        .catch(function (e) {
            console.error('[ #4 Avg Garbage ]')
            mbsState = MBS_STATE_FAIL_READ_AVG;
            readfailed++;
            // console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
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
            console.error('[ #6 Status Garbage ]')
            mbsState = MBS_STATE_FAIL_READ_STATUS;
            readfailed++;
            // console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
}

var readstats = function () {
    client.readHoldingRegisters(stats_address, 25)
        .then(function (stats_data) {
            console.log(stats_data.data)
            // // Active Punches
            // machine.stats.active_punches = ((active_punches + 1) / 32); // if 0-255
            var active_punches = stats_data.data[0]; 
            machine.stats.active_punches = active_punches;

            // // Current rotation
            // var data_number = stats_data.data[1]; // 32-bit 
            // var data_number_mul = stats_data.data[2]; // Multiplier
            // if (data_number_mul == 0) {
            //     payload.data_number = data_number;
            // }
            // else {
            //     payload.data_number = ((2 ^ 16 * data_number_mul) + data_number);
            // }

            // // // Present Punch
            payload.present_punch = stats_data.data[5];

            // // // Production count
            // // // Formula: [ punch count x rpm x time ]

            var reg1 = stats_data.data[6];
            var reg2 = stats_data.data[7];

            if (reg2 == 0) {
                machine.stats.count = reg1;
            } else {
                machine.stats.count = (((2 ** 16) * reg2) + reg1);
            }

            // // // Tablet per hour [ Max: 8x60x60=28800 ]
            tablets_per_hour = (machine.stats.active_punches * machine.control.turret_rpm * 60);
            machine.stats.tablets_per_hour = tablets_per_hour;
            
            machine.control.turret_rpm = stats_data.data[14] / 10;
            
            // // Compression Limits
            machine.maincompression_upperlimit = stats_data.data[15]/100;
            machine.maincompression_lowerlimit = stats_data.data[16]/100;
            machine.precompression_upperlimit = stats_data.data[17]/100;
            machine.precompression_lowerlimit = stats_data.data[18]/100;
            machine.ejection_upperlimit = stats_data.data[19]/100;

            machine.main_forceline = stats_data.data[22] / 100;
            machine.pre_forceline = stats_data.data[23] / 100;
            machine.ejn_forceline = stats_data.data[24] / 100;

            mbsState = MBS_STATE_GOOD_READ_STATS;
            // console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
        .catch(function (e) {
            console.error('[ #7 Stats Garbage ]')
            mbsState = MBS_STATE_FAIL_READ_STATS;
            readfailed++;
            // console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })

    // client.writeRegisters(8146, tablets_per_hour)
    //     .catch(function (e) {
    //         console.error('[ #8 Tablet per hour Write Failed ]')
    //         mbsState = MBS_STATE_FAIL_READ_STATS;
    //         readfailed++;
    //         // console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
    //     })
}

function restartprodmodbus() {
    exec(restart1Command, (err, stdout, stderr) => {
        // handle err if you like!
        console.log(`[ RESTARTING: prod-modbus ]`);
        console.log(`${stdout}`);
    });
}

app.use("/api/payload", (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.json(payload);
});

app.use("/api/machine", (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.json(machine);
});

// Start Server
const port = 3128;
app.listen(port, () => console.log(`Server running on port ${port} 🔥`));