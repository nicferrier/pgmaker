const assert = require("assert");
const path = require("path");
const url = require("url");
const express = require("express");
const fetch = require("node-fetch");
const { Client } = require('pg');
const main = require("./main.js");

const app = express();

const test = async function () {
    const listener = app.listen(0);
    const thisPort = listener.address().port;

    // Set the environment variable the way initdb.sh sets it
    process.env.PG_HOME = path.join(__dirname, "pg-dist");
    process.env.PG_DATA = path.join(__dirname, "pg-data");
    process.env.PG_RUN = path.join(__dirname, "pg-data", "run");
    
    const mainObject = await main({
        keepieConfigFn: _ => { return Promise.resolve({
            [`http://localhost:${thisPort}/keepie/password`]: "nics_test_db"
        }) },
        keepieIntervalMs: 2*1000
    });

    const pgMakerPort = mainObject.getPort();

    const [error, resultParams] = await new Promise(async (resolve, reject) => {
        app.post("/keepie/password", async function (req, res) {
            let dataBuf="";
            req.on("data", chunk => dataBuf = dataBuf + new String(chunk, "utf8"));
            await new Promise((resolve, reject) => req.on("end", resolve));
            const postParams = new url.URLSearchParams(dataBuf);
            console.log("test postParams!", postParams);
            res.sendStatus(204);
            resolve(postParams);
        })

        const response = await fetch(`http://localhost:${pgMakerPort}/db/pg`, {
            method: "POST",
            body: new url.URLSearchParams({
                "receipt-url": `http://localhost:${thisPort}/keepie/password`,
                "database-name": "nics_test_db"
            })
        });
        console.log("test create db request status", response.status);
    }).then(r => [undefined, r]).catch(e => [e]);

    // Assertions
    try {
        assert.ok(resultParams.name = "nics_test_db")

        // Try and connect
        const dbConfig = {}
        for (const [name, value] of resultParams) {
            dbConfig[name]=value;
        }
        const client = new Client(dbConfig);
        const [clientErr] = await client.connect()
              .then(_ => [undefined, client.end()]) // This is like a finally
              .catch(e => [e]);
        assert.ok(clientErr === undefined);
    }
    finally {
        mainObject.close();
        listener.close();
    }
};

test().then();

// End
