const fs = require("fs");
const path = require("path");

// This should be configurable somehow, so we can set different
// locations for things

const READ = fs.constants.R_OK;

function access(p, m) {
    try {
        fs.accessSync(p, m);
        return p;
    }
    catch (e) {
        return false;
    }
}

const testEnv = function(environ=process.env) {
    // Candidate directories
    envPgHome_bin = path.join(environ.PG_HOME || "#", "bin");
    envPgHome_pgsql_bin = path.join(environ.PG_HOME || "#", "pgsql", "bin");
    envPgBin = path.join(environ.PG_BIN || "#");

    envPgHome_lib = path.join(environ.PG_HOME || "#", "lib");
    envPgHome_pgsql_lib = path.join(environ.PG_HOME || "#", "pgsql", "lib");
    envPgLib = path.join(environ.PG_LIB || "#");

    envPgHome_run = path.join(environ.PG_HOME || "#", "run");
    envPgHome_pgsql_run = path.join(environ.PG_HOME || "#", "pgsql", "run");
    envPgTemp = path.join(environ.PG_TEMP || "#");
    envPgRun = path.join(environ.PG_RUN || "#");

    envPgHome_datadir = path.join(environ.PG_HOME || "#", "datadir");
    envPgHome_pgsql_datadir = path.join(environ.PG_HOME || "#", "pgsql", "datadir");
    envPgHome_data = path.join(environ.PG_HOME || "#", "data");
    envPgHome_pgsql_data = path.join(environ.PG_HOME || "#", "pgsql", "data");

    envPgData = path.join(environ.PG_DATA || "#");
    envPgData_run = path.join(environ.PG_DATA || "#", "run");

    const postgresDist = {
        binDir: access(envPgBin, READ)
            || access(envPgHome_bin, READ)
            || access(envPgHome_pgsql_bin, READ)
            || undefined,
        libDir: access(envPgLib, READ)
            || access(envPgHome_lib, READ)
            || access(envPgHome_pgsql_lib, READ)
            || undefined,
        runDir: access(envPgTemp, READ)
            || access(envPgRun, READ)
            || access(envPgData_run, READ)
            || access(envPgHome_run, READ)
            || access(envPgHome_pgsql_run, READ)
            || undefined,
        dataDir: access(envPgData, READ)
            || access(envPgHome_datadir, READ)
            || access(envPgHome_pgsql_datadir, READ)
            || access(envPgHome_data, READ)
            || access(envPgHome_pgsql_data, READ)
    };
    return postgresDist;
};

module.exports = testEnv;

// End

