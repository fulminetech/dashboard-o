// Include Library
const fetch = require('cross-fetch');
const { exec } = require('child_process');
const CronJob = require('cron').CronJob;

const Gpio = require('onoff').Gpio;
const proxy = new Gpio(26, 'in', 'falling', { debounceTimeout: 10 });

const Influx = require('influxdb-nodejs');
const flux = new Influx('http://localhost:8086/new');

// Timestamp for which returns current date and time 
var noww = new Date().toLocaleString(undefined, { timeZone: 'Asia/Kolkata' });
console.log(`[ STARTING INFLUX : ${noww} ]`)

const payloadURL = 'http://10.0.0.65:3128/api/payload';
const machineURL = 'http://10.0.0.65:3128/api/machine';
var i = 0

var temp_recepie = "DEFAULT";
var temp_name = "DEFAULT";
var temp_productname = "DEFAULT"

// Data Structure
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

function startmodbus() {
    setInterval(() => {
        fetchpayload()
    }, 100);
}

async function fetchpayload() {
    // const res = await fetch(payloadURL);
    // const res1 = await fetch(machineURL);

    fetch(payloadURL)
        .then((resp) => resp.json()) // Transform the data into json
        .then(function (data) {
            // Here you get the data to modify as you please
            payload1 = data

            payload.punch1.precompression = payload1.punch1.precompression;
            payload.punch1.maincompression = payload1.punch1.maincompression;
            payload.punch1.ejection = payload1.punch1.ejection;
            payload.punch1.status = payload1.punch1.status;

            payload.punch2.precompression = payload1.punch2.precompression;
            payload.punch2.maincompression = payload1.punch2.maincompression;
            payload.punch2.ejection = payload1.punch2.ejection;
            payload.punch2.status = payload1.punch2.status;

            payload.punch3.precompression = payload1.punch3.precompression;
            payload.punch3.maincompression = payload1.punch3.maincompression;
            payload.punch3.ejection = payload1.punch3.ejection;
            payload.punch3.status = payload1.punch3.status;

            payload.punch4.precompression = payload1.punch4.precompression;
            payload.punch4.maincompression = payload1.punch4.maincompression;
            payload.punch4.ejection = payload1.punch4.ejection;
            payload.punch4.status = payload1.punch4.status;

            payload.punch5.precompression = payload1.punch5.precompression;
            payload.punch5.maincompression = payload1.punch5.maincompression;
            payload.punch5.ejection = payload1.punch5.ejection;
            payload.punch5.status = payload1.punch5.status;

            payload.punch6.precompression = payload1.punch6.precompression;
            payload.punch6.maincompression = payload1.punch6.maincompression;
            payload.punch6.ejection = payload1.punch6.ejection;
            payload.punch6.status = payload1.punch6.status

            payload.punch7.precompression = payload1.punch7.precompression;
            payload.punch7.maincompression = payload1.punch7.maincompression;
            payload.punch7.ejection = payload1.punch7.ejection;
            payload.punch7.status = payload1.punch7.status;

            payload.punch8.precompression = payload1.punch8.precompression;
            payload.punch8.maincompression = payload1.punch8.maincompression;
            payload.punch8.ejection = payload1.punch8.ejection;
            payload.punch8.status = payload1.punch8.status;

            payload.precompression_avg = payload1.precompression_avg;
            payload.maincompression_avg = payload1.maincompression_avg;
            payload.ejection_avg = payload1.ejection_avg;
        })
        .catch(function (error) {
            // If there is any error you will catch them here
            console.log("[ PAYLOAD FETCH ERROR ]")
        });

    fetch(machineURL)
        .then((resp) => resp.json()) // Transform the data into json
        .then(function (data) {
            // Here you get the data to modify as you please
            machine1 = data
            
            machine.maincompression_upperlimit = machine1.maincompression_upperlimit;
            machine.maincompression_lowerlimit = machine1.maincompression_lowerlimit;
            machine.precompression_upperlimit = machine1.precompression_upperlimit;
            machine.precompression_lowerlimit = machine1.precompression_lowerlimit;
            machine.ejection_upperlimit = machine1.ejection_upperlimit;

            //machine.stats.count = machine1.count;
            //machine.stats.tablets_per_hour = machine1.tablets_per_hour;
            //machine.stats.rpm = machine1.rpm;
            //machine.stats.active_punches = machine1.active_punches;
            //machine.stats.mainMotor_trip = machine1.mainMotorTrip;
            //machine.stats.feederMotor_trip = machine1.feederMotor_trip;
            //machine.stats.emergencyStop_pressed = machine1.emergencyStop_pressed;
            //machine.stats.safetyguard_open = machine1.safetyguard_open;
            //machine.stats.system_overload = machine1.system_overload;

            // machine.control.inching = machine1.control.inching;
            // machine.control.machine_start = machine1.control.machine_start;
            // machine.control.machine_stop = machine1.control.machine_stop;
            // machine.control.turret_run = machine1.control.turret_run;
            // machine.control.turret_rpm = machine1.control.turret_rpm;
            // machine.control.forceFeeder_rpm = machine1.control.forceFeeder_rpm;

            machine.time.date = machine1.time.date;
            machine.time.month = machine1.time.month;
            machine.time.year = machine1.time.year;
            machine.time.hou = machine1.time.hour;
            machine.time.minute = machine1.time.minute;
            machine.time.second = machine1.time.second;

        })
        .catch(function (error) {
            // If there is any error you will catch them here
            console.log("[ MACHINE FETCH ERROR ]")
        });

};

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
        machine.stats.status = "ONLINE";
        payload.rotation_no = rotation;
        writePayload();
    });
}

module.exports = {
    machine, payload, watchproxy, startmodbus
}
