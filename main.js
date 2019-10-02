const fs = require("fs");
const url = require("url");
const express = require("express");
const startPg = require("./startpg.js");
const { Pool } = require("pg");
const fetch = require("node-fetch");

const dbNameRegex = new RegExp("^[a-zA-Z][a-zA-Z0-9_]+$");
const encodingRegex = new RegExp("^[a-zA-Z][a-zA-Z0-9._-]+$");

const keepieConfigFileMaker = function (fileName) {
    return _ => {
        return fs.promises.readFile(fileName, "utf8")
            .then(configText => JSON.parse(configText))
    };
};

const fileBasedKeepie = keepieConfigFileMaker("keepie-config.json");

const boot = async function (opts = {}) {
    const {
        keepieConfigFn = fileBasedKeepie,
        keepieIntervalMs = 60 * 1000,
        apiPort = 0
    } = opts;

    // Start the postgres
    const [pgProcess, pgConfig] = await startPg();
    const pool = new Pool(pgConfig);

    // Read in the keepie config file a lot
    let keepieConfig;
    const readConfig = async _ => {
        const cfgData = await keepieConfigFn();
        keepieConfig = cfgData;
    };
    await readConfig();
    const keepieConfigInterval = setInterval(readConfig, keepieIntervalMs);

    const app = express();
    const createQueue = [];
    const databases = [];    

    app.post("/db/pg", async function (req, res) {
        let dataBuf="";
        req.on("data", chunk => dataBuf = dataBuf + new String(chunk, "utf8"));
        await new Promise((resolve, reject) => req.on("end", resolve));
        const postParams = new url.URLSearchParams(dataBuf);

        const createParams = {
            receiptUrl: postParams.get("receipt-url"),
            name: postParams.get("database-name"),
            encoding: postParams.get("encoding") || "UTF8",
            ctype: postParams.get("ctype") || "C", // What initdb.sh makes the default
            collate: postParams.get("collate")
        };

        // Protect things getting into the config
        if (keepieConfig[createParams.receiptUrl] !== createParams.name) {
            return res
                .status(400)
                .send(`Your receipt-url '${createParams.receiptUrl}' is not registered.`);
        }

        if (!dbNameRegex.test(createParams.name)
            || !encodingRegex.test(createParams.encoding)) {
            return res
                .status(400)
                .send(`Bad Parameters: ${JSON.stringify(createParams)}`);
        }

        const status = databases[createParams.name] === undefined ? 202 : 204;
        
        console.log("database created", createParams.name, status);

        createQueue.push(createParams);
        return res.sendStatus(status);
    });

    const keepieProcessor = async _ => {
        while (createQueue.length > 0) {
            const {receiptUrl, name, encoding, ctype, collate} = createQueue.pop();

            let password;
            if (databases[name] !== undefined) {
                password = databases[name];
            }
            else {
                const [createUserError, createUserResult] = await pool.query(
                    `create user ${name};`
                ).then(r => [undefined, r]).catch(e => [e]);

                if (createUserError !== undefined) {
                    console.log(`error creating user ${name}: ${createUserError}`);
                    //return 800;
                }

                const [createDbError, createDbResult] = await pool.query(
                    `create database ${name} owner ${name} encoding ${encoding};`
                ).then(r => [undefined, r]).catch(e => [e]);

                if (createDbError !== undefined) {
                    console.log(`error creating db ${name}: ${createDbError}`);
                    //return 800;
                }

                // Generate and set the password
                password = Math.random().toString(36).slice(2)
                    + Math.random().toString(36).slice(2);

                const [pwError, pwResult] = await pool.query(
                    `alter role ${name} with password '${password}';`
                ).then(r => [undefined, r]).catch(e => [e]);

                if (pwError !== undefined) {
                    console.log(`error setting password on ${name}: ${pwError}`);
                    return 800;
                }
            }

            const receiptData = new url.URLSearchParams({
                host: pgConfig.host,
                port: pgConfig.port,
                database: name,
                user: name,
                password
            });

            const receiptResponse = await fetch(receiptUrl, {
                method: "POST",
                body: receiptData
            });

            databases[name] = password;
            return receiptResponse.status;
        }
    };

    const keepieInterval = setInterval(keepieProcessor, keepieIntervalMs);
    const listener = (
        (opts.pfx !== undefined && opts.passphrase !== undefined)
            || (opts.key !== undefined && opts.cert !== undefined)
    )
          ? https.createServer(opts, app).listen(apiPort)
          : app.listen(apiPort);
    
    return {
        getPort: function () {
            return listener.address().port;
        },

        getDatabases: function () {
            return databases;
        },

        post: async function() {
            const result = await app.post.apply(app, arguments);
            return result;
        },

        get: async function() {
            const result = await app.get.apply(app, arguments);
            return result;
        },

        delete: async function() {
            const result = await app.post.apply(app, arguments);
            return result;
        },

        head: async function() {
            const result = await app.post.apply(app, arguments);
            return result;
        },



        close: function () {
            // Stop accepting new requests
            listener.close();
            // Stop processing the queue - we should probably clear the queue
            clearInterval(keepieInterval);
            // Kill the postgres
            pgProcess.kill();
            // Kill the keepie interval
            clearInterval(keepieConfigInterval);
        },

        promise: async function () {
            // Wait for the process to exit
            const onExit = proc => pgProcess.on("exit", proc);
            await new Promise((resolve, reject) => {
                onExit(resolve);
            });
        }
    };
};


module.exports = boot;

boot.keepieConfigFileMaker = keepieConfigFileMaker;
boot.fileBasedKeepie = fileBasedKeepie;

if (require.main === module) {
    boot(); // Starts with defaults
}

// End
