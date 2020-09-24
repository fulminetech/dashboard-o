// Include Library
var ModbusRTU = require("modbus-serial");
const { Stats } = require("fs");
const { time } = require("console");
const { config } = require("process");
const { now } = require("moment");

const { exec } = require('child_process');
const CronJob = require('cron').CronJob;
const Gpio = require('onoff').Gpio;
const proxy = new Gpio(26, 'in', 'falling', { debounceTimeout: 10 });

const Influx = require('influxdb-nodejs');
const flux = new Influx('http://10.0.0.65:8086/new');

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
client.setID(slaveID);
client.setTimeout(100);

// Modbus Addresses
// 1.1. Payload
const precompression_address = 6396;
const maincompression_address = 6196;
const ejection_address = 6296;
const avg_address = 6496;

const time_address = 4196;
const status_address = 2588;
const stats_address = 8096;

//console.log('Modbus configured.');
var temp_recepie = "DEFAULT";
var temp_name = "DEFAULT";
var temp_productname = "DEFAULT"

var machine = {
    operator_name: temp_name,
    machine_id: 1,
    maincompression_upperlimit: 0,
    maincompression_lowerlimit: 0,
    precompression_upperlimit: 0,
    precompression_lowerlimit: 0,
    ejection_upperlimit: 0,
    product: {
        recipie_id: temp_recepie,
        name: temp_productname,
    },
    stats: {
        status: "OFFLINE",
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

// High Frequency data from the PLC
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
var mbsScan = 65;

//  Make physical connection
var connectClient = function () {
    client.connectRTUBuffered("/dev/ttyUSB0", { baudRate: baudRate, parity: 'none' })
        .then(function () {
            mbsState = MBS_STATE_GOOD_CONNECT;
            console.log(`[ CONNECTED ]`)
        })
        .catch(function (e) {
            mbsState = MBS_STATE_FAIL_CONNECT;
            console.log(`[ FAILED TO CONNECT ]`)
            console.log(e);
        });
}

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
            mbsState = MBS_STATE_FAIL_READ_TIME;
            console.log('#6 Time Garbage')
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

        case MBS_STATE_GOOD_READ_PRE:
            nextAction = readmain;
            break;

        case MBS_STATE_FAIL_READ_PRE:
            nextAction = readmain;
            break;

        case MBS_STATE_GOOD_READ_MAIN:
            nextAction = readejn;
            break;

        case MBS_STATE_FAIL_READ_MAIN:
            nextAction = readejn;
            break;

        case MBS_STATE_GOOD_READ_EJN:
            nextAction = readavg;
            break;

        case MBS_STATE_FAIL_READ_EJN:
            nextAction = readavg;
            break;

        case MBS_STATE_GOOD_READ_AVG:
            nextAction = readstatus;
            break;

        case MBS_STATE_FAIL_READ_AVG:
            nextAction = readstatus;
            break;

        case MBS_STATE_GOOD_READ_STATUS:
            nextAction = readpre;
            break;

        case MBS_STATE_FAIL_READ_STATUS:
            nextAction = readpre;
            break;

        default:
        // nothing to do, keep scanning until actionable case
    }

    //console.log();
    //console.log(nextAction);

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
            console.log(`${(+ new Date() - startTime) / 1000} : ${mbsState}`)
        })
}

// --+++=== DATABASE WRITE ===+++-- //

// Initialise Rotation 
var rotation = -1;

// Field and tag schema for Influx write
const payloadFieldSchema = {
    rotation: 'i',
    p1pre: 'f',
    p2pre: 'f',
    p3pre: 'f',
    p4pre: 'f',
    p5pre: 'f',
    p6pre: 'f',
    p7pre: 'f',
    p8pre: 'f',
    p8pre: 'f',
    p1main: 'f',
    p2main: 'f',
    p3main: 'f',
    p4main: 'f',
    p5main: 'f',
    p6main: 'f',
    p7main: 'f',
    p8main: 'f',
    p8main: 'f',
    p1ejn: 'f',
    p2ejn: 'f',
    p3ejn: 'f',
    p4ejn: 'f',
    p5ejn: 'f',
    p6ejn: 'f',
    p7ejn: 'f',
    p8ejn: 'f',
    p8ejn: 'f',
    preavg: 'f',
    mainavg: 'f',
    ejnavg: 'f',
    p1status: 'b',
    p2status: 'b',
    p3status: 'b',
    p4status: 'b',
    p5status: 'b',
    p6status: 'b',
    p7status: 'b',
    p8status: 'b',
    p8status: 'b',
};

const payloadTagSchema = {

};

const machineFieldSchema = {
    productionCount: 'i',
    productionPerHour: 'i',
    operatorname: 's',
    machineID: 's',
    mcUpperLimit: 'f',
    mcLowerLimit: 'f',
    pcUpperLimit: 'f',
    pcLowerLimit: 'f',
    ejnUpperLimit: 'f',
    recipieID: 's',
    status: 's',
    rpm: 'i',
    activePunches: 'i',
    mainMotorTrip: 'b',
    feederMotorTrip: 'b',
    emergencyStop: 'b',
}

const machineTagsSchema = {

}

// Updated with each rotation
writePayload = () => {
    flux.write(`${payload.batch}.payload`)
        .tag({
        })
        .field({
            batch: payload.batch,
            ejnavg: payload.ejection_avg,
            mainavg: payload.maincompression_avg,

            p1ejn: payload.punch1.precompression,
            p1main: payload.punch1.maincompression,
            p1pre: payload.punch1.ejection,
            p1status: payload.punch1.status,

            p2ejn: payload.punch2.precompression,
            p2main: payload.punch2.maincompression,
            p2pre: payload.punch2.ejection,
            p2status: payload.punch2.status,

            p3ejn: payload.punch3.precompression,
            p3main: payload.punch3.maincompression,
            p3pre: payload.punch3.ejection,
            p3status: payload.punch3.status,

            p4ejn: payload.punch4.precompression,
            p4main: payload.punch4.maincompression,
            p4pre: payload.punch4.ejection,
            p4status: payload.punch4.status,

            p5ejn: payload.punch5.precompression,
            p5main: payload.punch5.maincompression,
            p5pre: payload.punch5.ejection,
            p5status: payload.punch5.status,

            p6ejn: payload.punch6.precompression,
            p6main: payload.punch6.maincompression,
            p6pre: payload.punch6.ejection,
            p6status: payload.punch6.status,

            p7ejn: payload.punch7.precompression,
            p7main: payload.punch7.maincompression,
            p7pre: payload.punch7.ejection,
            p7status: payload.punch7.status,

            p8ejn: payload.punch8.precompression,
            p8main: payload.punch8.maincompression,
            p8pre: payload.punch8.ejection,
            p8status: payload.punch8.status,

            preavg: payload.precompression_avg,
            rotation: payload.rotation_no,
        })
        .then(() => console.info(`[ PAYLOAD WRITE SUCESSFUL ${payload.rotation_no} ]`))
        .catch(console.error);
}

// write every 10 mins
writemachine = () => {
    setTimeout(() => {
        fluxmachine();
    }, 2000);
    setInterval(() => {
        fluxmachine();
    }, 600000);
};

fluxmachine = () => {
    flux.write(`${payload.batch}.machine`)
        .tag({
        })
        .field({
            operatorname: machine.operator_name,
            machineID: machine.machine_id,
            mcUpperLimit: machine.maincompression_upperlimit,
            mcLowerLimit: machine.maincompression_lowerlimit,
            pcUpperLimit: machine.precompression_upperlimit,
            pcLowerLimit: machine.precompression_lowerlimit,
            ejnUpperLimit: machine.ejection_upperlimit,
            recipieID: machine.product.recipie_id,
            productionCount: machine.stats.count,
            productionPerHour: machine.stats.tablets_per_hour,
            rpm: machine.stats.rpm,
        })
        .then(() => console.info(`[ MACHINE WRITE SUCESSFUL ${noww} ]`))
        .catch(console.error);
};

var watchproxy = function () {
    rotation = -1;
    writemachine();
    proxy.watch((err, value) => {
        if (err) {
            throw err;
        }
        rotation++;
        payload.rotation_no = rotation;
        writePayload();
    });
}

// process.on('SIGINT', _ => {
//     Gpio.unexport();
//     console.log(`[ Exiting ${noww} ]`);
// });

module.exports = {
    machine, payload, runModbus, watchproxy
}
