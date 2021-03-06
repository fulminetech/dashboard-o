// Express imports
const express = require("express");
const bodyParser = require("body-parser");
const fs = require('fs').promises;
var path = require('path');
const app = express();
const CronJob = require('cron').CronJob;
const { exec } = require('child_process');
const puppeteer = require('puppeteer');

const restartCommand = "pm2 restart prod-routes"
const restart1Command = "pm2 restart prod-modbus"

const rebootCommand = "sudo reboot -h now"

const host = "localhost"

// Influx Imports
const Influx = require('influxdb-nodejs');
const { query } = require("express");
const client = new Influx(`http://${host}:8086/new`);

const {
    payload, machine, watchproxy, startmodbus
} = require('./data.js')

// Serve NPM modules
app.use('/charts', express.static(__dirname + '/node_modules/chart.js/dist/'));
app.use('/charts/plugin', express.static(__dirname + '/node_modules/chartjs-plugin-zoom/'));
app.use('/plugin', express.static(__dirname + '/node_modules/hammerjs/'));
app.use('/css', express.static(__dirname + '/node_modules/tailwindcss/dist/'));
app.use('/font', express.static(__dirname + '/node_modules/@fortawesome/fontawesome-free/'));

function filterItems(arr, query) {
    return arr.filter(function (el) {
        return el.toLowerCase().indexOf(query.toLowerCase()) !== -1
    })
}

function removeWord(arr, word) {
    for (var i = 0; i < arr.length; i++) {
        arr[i] = arr[i].replace(word, '');
    }
}

// Returns Batch Count and names
var response = {
    batchcount: 0,
    batchnames: {
    }
}

var avg = {
    totalrotations: 0,
    data: {

    }
}

var report = {
    batch: 0,
    from: 0,
    to: 0,
}

const options = {
    inflate: true,
    limit: 1000,
    extended: true
};

app.use(bodyParser.urlencoded(options));

// Favicons 
app.get("/apple-touch-icon.png", (req, res) => {
    res.sendFile(path.join(__dirname + "/favicon_io/apple-touch-icon.png"));
});
app.get("/favicon-32x32.png", (req, res) => {
    res.sendFile(path.join(__dirname + "/favicon_io/favicon-32x32.png"));
});
app.get("/favicon-16x16.png", (req, res) => {
    res.sendFile(path.join(__dirname + "/favicon_io/favicon-16x16.png"));
});
app.get("/site.webmanifest", (req, res) => {
    res.sendFile(path.join(__dirname + "/favicon_io/site.webmanifest"));
});
app.get("/login/logo", (req, res) => {
    res.sendFile(path.join(__dirname + "/background.png"));
});
app.get("/login/image", (req, res) => {
    res.sendFile(path.join(__dirname + "/login.jpeg"));
});

// Routes
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname + "/html/login.html"));
});

app.get("/onboard", (req, res) => {
    res.sendFile(path.join(__dirname + "/html/onboard.html"));
});

app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname + "/html/index.html"));
});

app.get("/control", (req, res) => {
    res.sendFile(path.join(__dirname + "/html/control.html"));
});

app.get("/reports", (req, res) => {
    res.sendFile(path.join(__dirname + "/html/reports.html"));
});

app.use("/api/payload", (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.json(payload);
});

app.use("/api/machine", (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.json(machine);
});

app.get("/onboard/:namee/:machinee/:recepiee/:batchh", (req, res) => {
    const a = req.params.namee;
    const b = req.params.machinee;
    const c = req.params.recepiee;
    const d = req.params.batchh;

    machine.operator_name = a;
    machine.machine_id = b;
    machine.product.recipie_id = c;
    payload.batch = d;

    client.queryRaw(`select "rotation" from "${d}.payload" ORDER BY time DESC LIMIT 1`)
        .then(data => {
            var response = data.results[0].series[0].values[0];
            var previousrtn = parseInt(response[1]);
            console.log(previousrtn)
            if (previousrtn > 1) {
                payload.rotation_no = previousrtn;
            }
        })
        .catch(console.error);

    watchproxy();
    startmodbus();
    return res.json({ message: `[ ONBOARDED BATCH: ${d} ]` });
});

app.get("/api/search/rotation/:rotationn", (req, res) => {
    // select * from "payload" where "rotation" = 7
    const r = parseInt(req.params.rotationn)

    passbatch(r)

    async function passbatch(r) {
        client.query(`${payload.batch}.payload`)
            .where('rotation', r)
            .then(data => {
                let payload1 = Object.values(data.results[0].series[0].values[0]);
                console.log(`[ RESPONSE:  ${payload1} ]`);
                if (typeof payload1 === "object") {
                    res.send(payload1)
                }
            })
            .catch(console.error);
    };
});

app.get("/api/search/average/:batch", (req, res) => {
    // select * from "payload" where "rotation" = 7
    const r = req.params.batch

    async function passbatch(r) {
        client.queryRaw(`select "rotation", "preavg", "mainavg", "ejnavg" from "${r}.payload"`)
            .then(data => {
                var response = data.results[0].series[0].values
                avg.totalrotations = response.length - 1
                avg.data = response
                res.json(avg)
            })
            .catch(console.error);
    };

    passbatch(r)
});

app.get("/api/search/average/csv/:batch", (req, res) => {
    // select * from "payload" where "rotation" = 7
    const r = req.params.batch

    async function passbatch(r) {
        client.queryRaw(`select "rotation", "preavg", "mainavg", "ejnavg" from "${r}.payload"`)
            .then(data => {
                var response = data.results[0].series[0].values
                avg.totalrotations = response.length - 1
                avg.data = response

                res.json(avg.data)
            })
            .catch(console.error);
    };

    passbatch(r)
});

app.get("/api/search/batch", (req, res) => {
    client.showMeasurements()
        .then(data => {
            var originalList = Object.values(data)
            var filteredList = filterItems(originalList, 'machine')
            response.batchcount = filteredList.length;
            removeWord(filteredList, '.machine')
            response.batchnames = filteredList

            res.send(response)
        })
        .catch(console.error);
})

app.get("/report/template", (req, res) => {
    res.sendFile(path.join(__dirname + "/report/report.html"));
});

app.get("/report/average/:batch/:from/:to", (req, res) => {
    const b = req.params.batch
    const f = req.params.from
    const t = req.params.to

    report.batch = b;
    report.from = f;
    report.to = t;

    return res.json({ message: `[ READY TO EXPORT ]` });

})

app.get("/report/average/now", (req, res) => {
    res.send(report);
})

app.get("/report/average/generate", (req, res) => {
    (async () => {
        const browser = await puppeteer.launch({ product: 'chrome', executablePath: '/usr/bin/chromium-browser' });
        const page = await browser.newPage();
        await page.goto(`http://${host}:3000/report/template`, { waitUntil: 'networkidle0' });
        await page.pdf({ path: `batch_${report.batch}_from_${report.from}_to_${report.to}.pdf`, format: 'A4' });
        await browser.close();
    })();

    return res.json({ message: 'EXPORTED' });
})

app.get("/report/average/download", (req, res) => {
    var file = path.join(__dirname, `batch_${report.batch}_from_${report.from}_to_${report.to}.pdf`);
    res.download(file, function (err) {
        if (err) {
            console.log("Error");
            console.log(err);
        } else {
            console.log("Success");
        }
    });
})

app.get("/restart/:what", (req, res) => {

    const a = req.params.what;

    if (a == "pm2-0") {
        res.json({ message: `[ RESTARTING: ${a} ]` });
        exec(restartCommand, (err, stdout, stderr) => {
            // handle err if you like!
            console.log(`[ RESTARTING: prod-routes ]`);
            console.log(`${stdout}`);
        });
    } else if (a == "pm2-1") {
        res.json({ message: `[ RESTARTING: ${a} ]` });
        exec(restart1Command, (err, stdout, stderr) => {
            // handle err if you like!
            console.log(`${stdout}`);
        });
    }
    else if (a == "device") {
        res.json({ message: `[ RESTARTING: PI ]` });
        exec(rebootCommand, (err, stdout, stderr) => {
            // handle err if you like!
            console.log(`${stdout}`);
        });
    }

})

// Start Server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port} 🔥`));