const assert = require("assert");
const env = require("./env.js");
const path = require("path");

// For info this is the kind of thing we're expecting
const expected_postgresDist = {
    binDir: path.join(__dirname, "pg-dist", "pgsql", "bin"),
    libDir: path.join(__dirname, "pg-dist", "pgsql", "lib"),
    runDir: path.join(__dirname, "pg-data", "run"),
    dataDir: path.join(__dirname, "pg-data")
};


// And now we assert the env code works.

assert.deepStrictEqual(
    {
        binDir: path.join(__dirname, "testdirs", "pg_home_1", "bin"),
        libDir: path.join(__dirname, "testdirs", "pg_home_1", "lib"),
        runDir: path.join(__dirname, "testdirs", "pg_home_1", "run"),
        dataDir: path.join(__dirname, "testdirs", "pg_home_1", "datadir")
    },
    env({PG_HOME: path.join(__dirname, "testdirs", "pg_home_1")})
);

assert.deepStrictEqual(
    {
        binDir: path.join(__dirname, "testdirs", "pg_home_2", "pgsql", "bin"),
        libDir: path.join(__dirname, "testdirs", "pg_home_2", "pgsql", "lib"),
        runDir: path.join(__dirname, "testdirs", "pg_home_2", "pgsql", "run"),
        dataDir: path.join(__dirname, "testdirs", "pg_home_2", "pgsql", "datadir")
    },
    env({PG_HOME: path.join(__dirname, "testdirs", "pg_home_2")})
);

// More specific env vars have precedence
//
// In this case PG_BIN is used in preference PG_HOME/bin
assert.deepStrictEqual(
    {
        binDir: path.join(__dirname, "testdirs", "pg_home_3", "pgbin"),
        libDir: path.join(__dirname, "testdirs", "pg_home_3", "lib"),
        runDir: path.join(__dirname, "testdirs", "pg_home_3", "run"),
        dataDir: path.join(__dirname, "testdirs", "pg_home_3", "datadir")
    },
    env({PG_HOME: path.join(__dirname, "testdirs", "pg_home_3"),
         PG_BIN: path.join(__dirname, "testdirs", "pg_home_3", "pgbin")})
);

// This one shows specific datadir outside the pg folder structure
assert.deepStrictEqual(
    {
        binDir: path.join(__dirname, "testdirs", "testdir4", "pg_home", "bin"),
        libDir: path.join(__dirname, "testdirs", "testdir4", "pg_home", "lib"),
        runDir: path.join(__dirname, "testdirs", "testdir4", "pg_home", "run"),
        dataDir: path.join(__dirname, "testdirs", "testdir4", "pgdata")
    },
    env({PG_HOME: path.join(__dirname, "testdirs", "testdir4", "pg_home"),
         PG_DATA: path.join(__dirname, "testdirs", "testdir4", "pgdata")})
);

// End
