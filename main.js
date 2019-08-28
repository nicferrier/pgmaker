const fs = require("fs");
const url = require("url");
const express = require("express");
const startPg = require("./startpg.js");
const { Pool } = require("pg");
const fetch = require("node-fetch");

const dbNameRegex = new RegExp("^[a-zA-Z][a-zA-Z0-9_-]+$");
const encodingRegex = new RegExp("^[a-zA-Z][a-zA-Z0-9._-]+$");

exports.fileBasedKeepie = _ => {
    return fs.promises.readFile("keepie-config.json", "utf8")
        .then(configText => JSON.parse(configData))
};

const boot = async function (opts = {}) {
    const {
        keepieConfigFn=exports.fileBasedKeepie,
        keepieIntervalMs=60 * 1000
    } = opts;
    const [pgProcess, pgConfig] = await startPg();
    const pool = new Pool(pgConfig);

    // Read in the keepie config file a lot
    let config;
    const readConfig = _ => {
        keepieConfigFn().then(configData => config = configData);
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

    const listener = app.listen(0);

    return {
        getPort: function () {
            return listener.address().port;
        },

        getDatabases: function () {
            return databases;
        },

        close: function () {
            pgProcess.kill();
            clearInterval(keepieInterval);
            listener.close();
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

if (require.main === module) {
    boot(); // Starts with defaults
}

// End
