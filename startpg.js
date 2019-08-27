const fs = require("fs");
const path = require("path");
const {getFreePort} = require("./utils.js");
const {spawn} = require("child_process");
const { Client } = require('pg');

// This should be configurable somehow, so we can set different
// locations for things
const postgresDist = {
    binDir: path.join(__dirname, "pg-dist", "pgsql", "bin"),
    libDir: path.join(__dirname, "pg-dist", "pgsql", "lib"),
    runDir: path.join(__dirname, "pg-data", "run"),
    dataDir: path.join(__dirname, "pg-data")
};


const startPg = async function () {
    const address = await getFreePort();
    const port = address.port;

    const password = "This is a Secret";

    const config = path.join(postgresDist.dataDir, "postgresql.conf");
    const file = await fs.promises.readFile(config, "utf-8");

    const portChanged = file.replace(
            /^[#]*port = .*/gm, `port = ${port}`
    ).replace(
            /^[#]*unix_socket_directories = .*/gm,
        `unix_socket_directories = '${postgresDist.runDir}'`
    );

    await fs.promises.writeFile(config, portChanged);

    const exePath = path.join(postgresDist.binDir, "postgres");

    let pgChild = spawn(exePath, ["-D", postgresDist.dataDir], {
        env: {
            "LD_LIBRARY_PATH": postgresDist.libDir
        }
    });
    pgChild.stdout.pipe(process.stdout);
    pgChild.stderr.pipe(process.stderr);

    const pgConfig = {
        user: "postgres",
        host: "localhost",
        port: port,
        database: "postgres",
        password: password
    };

    // Test that the server came up
    let connectTested = false;
    for (let tries = 0; tries<10; tries++) {
        const client = new Client(pgConfig);

        // Do we get a connection?
        let [error, connection] = await client.connect()
            .then(c => [undefined, true])
            .catch(e => [e]);

        // ... otherwise end and go round again
        if (error !== undefined) {
            await client.end().catch(e => e);
            await new Promise((resolve, reject) => {
                setTimeout(_ => resolve([]), 500);
            });
            continue;
        }

        // ... we got a connection do test it
        const [queryErr, queryRes] = await client.query("select 1")
              .then(r => [undefined, r])
              .catch(e => [e]);
        if (queryErr !== undefined) {
            await client.end().catch(e => e);
            await new Promise((resolve, reject) => {
                setTimeout(_ => resolve([]), 500);
            });
        }

        // ... else we're all good!
        connectTested = true;
        await client.end().catch(e => console.log("error ending!", e));
    }
    
    if (connectTested === false) {
        console.log("couldn't start the postgresql server");
        process.exit(1);
    }

    return pgChild;
};


startPg().then(async pgChild => {
    const onExit = proc => pgChild.on("exit", proc);
    await new Promise((resolve, reject) => {
        onExit(resolve);
    });
    console.log("done!");
});

// End

