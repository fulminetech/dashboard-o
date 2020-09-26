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
var startTime = + new Date();

const payloadURL = 'http://10.0.0.65:3128/api/payload';
const machineURL = 'http://10.0.0.65:3128/api/machine';
var i = 0

var payload = {}
var machine = {}

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
            payload = buffer
        } else {
            console.log(' PAYLOAD NOT RECEIVED ')
        }

        buffer1 = await res1.json();
        if (buffer1 !== undefined) {
            machine = buffer1
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
