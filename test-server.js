const assert = require("assert");
const url = require("url");
const express = require("express");
const fetch = require("node-fetch");
const { Client } = require('pg');
const main = require("./main.js");

const app = express();

const test = async function () {
    const mainObject = await main({
        keepieConfigFn: _ => { return Promise.resolve({}) },
        keepieIntervalMs: 2*1000
    });

    let listener;
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

        const pgMakerPort = mainObject.getPort();
        listener = app.listen(0);
        const thisPort = listener.address().port;
        
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
        const dbConfig = {}
        for (const [name, value] of resultParams) {
            dbConfig[name]=value;
        }
        const client = new Client(dbConfig);
        assert.doesNotThrow(async function () {
            client.connect();
            client.end;
        try {
            await client.connect();
            client.end();
        }
        catch (e) {
            assert.ok(false, `failed to connect with ${resultParams}`);
        }
    }
    finally {
        mainObject.close();
        listener.close();
    }
};

test().then();

// End
