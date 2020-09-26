// Include Library
const fetch = require('cross-fetch');
const { exec } = require('child_process');
const CronJob = require('cron').CronJob;

const Gpio = require('onoff').Gpio;
const proxy = new Gpio(26, 'in', 'falling', { debounceTimeout: 10 });

const Influx = require('influxdb-nodejs');
const flux = new Influx('http://10.0.0.65:8086/new');

// Timestamp for which returns current date and time 
var noww = new Date().toLocaleString(undefined, { timeZone: 'Asia/Kolkata' });
console.log(`[ STARTING DATA: ${noww} ]`)

const payloadURL = 'http://10.0.0.65:3128/api/payload';
const machineURL = 'http://10.0.0.65:3128/api/machine';
var i = 0

var temp_recepie = "DEFAULT";
var temp_name = "DEFAULT";
var temp_productname = "DEFAULT"

var machine1 = {}

var payload1 = {}

// Data Structure
var machine = {
    operator_name: temp_name,
    machine_id: 1,
    maincompression_upperlimit: machine1.maincompression_upperlimit,
    maincompression_lowerlimit: machine1.maincompression_lowerlimit,
    precompression_upperlimit: machine1.precompression_upperlimit,
    precompression_lowerlimit: machine1.precompression_lowerlimit,
    ejection_upperlimit: machine1.ejection_upperlimit,
    product: {
        recipie_id: temp_recepie,
        name: temp_productname,
    },
    stats: {
        status: "OFFLINE",
        count: machine1.count,
        tablets_per_hour: machine1.tablets_per_hour,
        rpm: machine1.rpm,
        active_punches: machine1.active_punches,
        mainMotor_trip: machine1.mainMotorTrip,
        feederMotor_trip: machine1.feederMotor_trip,
        emergencyStop_pressed: machine1.emergencyStop_pressed,
        safetyguard_open: machine1.safetyguard_open,
        system_overload: machine1.system_overload,
        uptime: 0,
    },
    control: {
        inching: machine1.control.inching,
        machine_start: machine1.control.machine_start,
        machine_stop: machine1.control.machine_stop,
        turret_run: machine1.control.turret_run,
        turret_rpm: machine1.control.turret_rpm,
        forceFeeder_rpm: machine1.control.forceFeeder_rpm,
    },
    time: {
        date: machine1.time.date,
        month: machine1.time.month,
        year: machine1.time.year,
        hour: machine1.time.hour,
        minute: machine1.time.minute,
        second: machine1.time.second,
    }
};

var payload = {
    batch: 0,
    data_number: 0, // Rotation Number
    rotation_no: 0,
    present_punch: 0,
    punch1: {
        precompression: payload1.punch1.precompression,
        maincompression: payload1.punch1.maincompression,
        ejection: payload1.punch1.ejection,
        status: payload1.punch1.status
    },
    punch2: {
        precompression: payload1.punch2.precompression,
        maincompression: payload1.punch2.maincompression,
        ejection: payload1.punch2.ejection,
        status: payload1.punch2.status
    },
    punch3: {
        precompression: payload1.punch3.precompression,
        maincompression: payload1.punch3.maincompression,
        ejection: payload1.punch3.ejection,
        status: payload1.punch3.status
    },
    punch4: {
        precompression: payload1.punch4.precompression,
        maincompression: payload1.punch4.maincompression,
        ejection: payload1.punch4.ejection,
        status: payload1.punch4.status
    },
    punch5: {
        precompression: payload1.punch5.precompression,
        maincompression: payload1.punch5.maincompression,
        ejection: payload1.punch5.ejection,
        status: payload1.punch5.status
    },
    punch6: {
        precompression: payload1.punch6.precompression,
        maincompression: payload1.punch6.maincompression,
        ejection: payload1.punch6.ejection,
        status: payload1.punch6.status
    },
    punch7: {
        precompression: payload1.punch7.precompression,
        maincompression: payload1.punch7.maincompression,
        ejection: payload1.punch7.ejection,
        status: payload1.punch7.status
    },
    punch8: {
        precompression: payload1.punch8.precompression,
        maincompression: payload1.punch8.maincompression,
        ejection: payload1.punch8.ejection,
        status: payload1.punch8.status
    },
    precompression_avg: payload1.precompression_avg,
    maincompression_avg: payload1.maincompression_avg,
    ejection_avg: payload1.ejection_avg,
};

function startmodbus() {
    setInterval(() => {
        fetchpayload()
    }, 100);
}

async function fetchpayload() {
    const res = await fetch(payloadURL);
    const res1 = await fetch(machineURL);
    if (res.status >= 400 || res1.status >= 400) {
        throw new Error("Bad response from server");
    }
    i++;
    if (i >= 2) {
        buffer = await res.json();
        if (buffer !== undefined) {
            payload1 = buffer
        } else {
            console.log(' PAYLOAD NOT RECEIVED ')
        }

        buffer1 = await res1.json();
        if (buffer1 !== undefined) {
            machine1 = buffer1
        } else {
            console.log(' MACHINE NOT RECEIVED ')
        }
    }
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

module.exports = {
    machine, payload, watchproxy, startmodbus
}
