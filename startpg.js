const fs = require("fs");
const os = require("os");
const path = require("path");
const {getFreePort} = require("./utils.js");
const {spawn} = require("child_process");
const { Client } = require('pg');
const env = require("./env.js");

const startIt = async function () {
    const postgresDist = env();

    const address = await getFreePort();
    const port = address.port;

    const password = "This is a Secret";

    const config = path.join(postgresDist.dataDir, "postgresql.conf");
    const configFile = await fs.promises.readFile(config, "utf-8");
    const portChanged = configFile.replace(
            /^[#]*port = .*/gm, `port = ${port}`
    ).replace(
            /^[#]*unix_socket_directories = .*/gm,
        `unix_socket_directories = '${postgresDist.runDir}'`
    ).replace(
            /^#listen_addresses.*/gm, "listen_addresses = '*'"
    );
    await fs.promises.writeFile(config, portChanged);

    const hba = path.join(postgresDist.dataDir, "pg_hba.conf");
    const hbaFile = await fs.promises.readFile(hba, "utf-8");
    const intialHbaHack = hbaFile.replace(
            /^host[ \t](.*)[ \t]::1\/128[ \t]+(.*)$/gm, "host $1 all trust"
    ).replace(
            /^host[ \t](.*)[ \t]127.0.0.1\/32[ \t]+(.*)$/gm, "host $1 all trust"
    );
    await fs.promises.writeFile(hba, intialHbaHack);


    const exePath = path.join(postgresDist.binDir, "postgres");

    let pgChild = spawn(exePath, ["-D", postgresDist.dataDir], {
        env: {
            "LD_LIBRARY_PATH": [process.env.LD_LIBRARY_PATH, postgresDist.libDir].join(":")
        }
    });
    pgChild.stdout.pipe(process.stdout);
    pgChild.stderr.pipe(process.stderr);

    const pgConfig = {
        user: "postgres",
        host: os.hostname(),
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

        const [pwErr, pwResult] = await client.query(
            `alter role postgres with password '${password}';`
        ).then(r => [undefined, r]).catch(e => [e]);
        
        // ... else we're all good!
        connectTested = true;
        await client.end().catch(e => console.log("error ending!", e));
    }
    
    if (connectTested === false) {
        console.log("couldn't start the postgresql server");
        process.exit(1);
    }

    // If it worked then set the pg_hba to allow password only
    const methodChanged = hbaFile.replace(
            /^host[ \t](.*)[ \t]::1\/128[ \t]+trust$/gm, `host $1 all password`
    ).replace(
            /^host[ \t](.*)[ \t]127.0.0.1\/32[ \t]+trust$/gm, `host $1 all password`
    );
    await fs.promises.writeFile(hba, methodChanged);

    return [pgChild, pgConfig];
};

module.exports = startIt;

if (require.main === module) {
    startIt()
        .then(async ([childProcess, password]) => { 
            const onExit = proc => childProcess.on("exit", proc);
            await new Promise((resolve, reject) => {
                onExit(resolve);
            });
            console.log("done!");
        });
}

// End
