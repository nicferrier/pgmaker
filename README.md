# Making Postgres Databases for fun and storage

Postgres is such a neat database, everybody wants one.

But you don't want to end up with a mad mess of databases
everywhere. Instead, you can build some centralization of your
databases with this tool.

PgMaker is some js to help you build such a service. It runs a single
Postgresql server and provides an HTTP API for creating databases on
that server.

Consumers wishing to make a database must be pre-registered with
PgMaker for that database.

A consumer receives the resulting databases connection details in a
callback to the url it has pre-registered with PgMaker.


## How to make a PgMaker service

Mostly all you have to do to provide this as a service is provide a
keepie configuration reading implementation.

Therefore the minimum service would be a repostory with a package.json:

```javascript
{
  "name": "pgmaker-service",
  "version": "1.0.0",
  "description": "Just a pgmaker service.",
  "main": "my-pgmaker-service.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 0"
  },
  "author": "me",
  "license": "ISC",
  "dependencies": {
    "@nicferrier/pgmaker": "1.0.0"
  }
}
```

And the file `my-pgmaker-service.js` would be:

```javascript
const pgmaker = require("@nicferrier/pgmaker");
const fs = require("fs");
const path = require("path");

if (require.main === module) {
  const keepieConfigFileName = path.join(__dirname, "database-authorizations.json");
  pgmaker({
     keepieConfigFn: pgmaker.keepieConfigFileMaker(keepieConfigFileName)
  })
}
```

where the file called `database-authorizations.json` does exist in the
root of that repository and it's a JSON file that looks like this:

```database-authorizations.json
{
   "http://some-server-that-wants-a-db.example.com:8000/password": "the_db_it_wants",
   "http://server-needs-people-db.example.com:6001/receive": "people_db",
   "http://another-server-needs-people-db.example.com:6002/password": "people_db"
}
```

This would allow `some-server-that-wants-a-db.example.com` to request
`the_db_it_wants` and receive the password on it's port 8000 on the
path `/password` and for `server-needs-people-db.example.com` and
`another-server-needs-people-db.example.com` to request `people_db`
and receive it's connection details, including the secret, on their
ports `6001` and `6002` respectively and their respective paths
`/receive` and `/password`.

### How to start a TLS server

You can start a TLS server for PgMaker by supplying either of the
options you need to start a tls server, either `pfx`:

```javascript
const pkcs12 = ... ;         // Presumably read it from a file or something
const pkcs12password = ... ; // likewise
pgmaker({
   keepieConfigFn: pgmaker.keepieConfigFileMaker(keepieConfigFileName),
   pfx: Buffer.from(pkcs12, "base64"), 
   passphrase: pkcs12password
})
```

or a private key and a cert:

```javascript
const tlsOpts = {          // Presumably all come from a file
  key: privateKeyInPem,
  cert, 
  ca
};
pgmaker(Object.assign({
   keepieConfigFn: pgmaker.keepieConfigFileMaker(keepieConfigFileName)
}, tlsOpts));
```

By preference this uses `pfx` certs if it finds the options for them.

If you do not specify tls options then an `http` server is made.

### How to add routes to your PgMaker service

PgMaker provides pass through functions for it's internal express
app's `get`, `post`, `delete` and `head` so you can write code like
this:

```javascript
const pkcs12 = ... ;         // Presumably read it from a file or something
const pkcs12password = ... ; // likewise
pgmaker({
   keepieConfigFn: pgmaker.keepieConfigFileMaker(keepieConfigFileName),
   pfx: Buffer.from(pkcs12, "base64"), 
   passphrase: pkcs12password
}).then(pgMakerService => {
   pgMakerService.get("/", function (req,res) {
      res.send("<h1>PgMaker!</h1><p>Create databases easily!</p>");
   });
});
```

See [Express documentation](https://expressjs.com/en/4x) for more
details on how to write express handlers.


## How PgMaker finds your postgres

Postgres might be installed in all sorts of ways. PgMaker expects the
following things:

* the postgres binaries are installed somewhere, we execute `postgres` from there 
  * we try the `$PG_BIN` path
  * we try the `$PG_HOME/bin` path
  * we try the `$PG_HOME/pgsql/bin` path
* the postgres libraries are installed somewhere, we set the `LD_LIBRARY_PATH` to that
  * we try the `$PG_LIB` path
  * we try the `$PG_HOME/lib` path
  * we try the `$PG_HOME/pgsql/lib` path
* a `run` directory for containing the temporary unix socket must exist
  * we try the `$PG_TEMP` path
  * we try the `$PG_RUN` path
  * we try the `$PG_DATA/run` path
  * we try the `$PG_HOME/run` path
* a `data` directory where we will create the postgres instance
  * we try the `$PG_DATA` path
  * we try the `$PG_HOME/datadir` path
  * we try the `$PG_HOME/pgsql/datadir` path
  * we try the `$PG_HOME/data` path
  * we try the `$PG_HOME/pgsql/data` path

Notice that more specific environment variables take precedence over
less specific ones.


We don't need a permanent tcp port for postgres, we just allocate one
dynamically.


## What's the ideal setup for Postgres?

To do any of this you need to have Postgres installed. So first, how
do you do that?


### Installing a PostgreSQL distribution

In this repository there is a script `initdb.sh` which creates a
Postgres installation for PgMaker from the official PostgreSQL
project's tarball available for download
[here](https://www.postgresql.org/ftp/source/).

This might also work on Windows with a Windows distribution of
Postgres.

Another way is to use a yum or apt distribution and unpack the
packaged RPM or DPKG file somewhere.

Advantages of these two ways of installing Postgres are:

* you don't need root to do it
* you can choose to install it anywhere
* you can easily run multiple different versions

Another way is to install Postgresql on your operating system. This
might sometimes be easier but:

* usually requires root privilege
* sometimes doesn't allow multiple versions

For development purposes, when running outside secure environments, I
recommend running a tarball distribution.

For production or inside secure environments (like large enterprises)
I recommend downloading an RPM and unpacking it to a location.

Postgres usually does not need any installation time scripts to make
it work, so this is the best approach.


### And then how to set it up?

The initdb.sh in this repository depends on the structure of the
postgresql tar file which unwraps with a `pgsql` directory containing
all the binaries, so we have this:

```shell-script
export PG_HOME=${PG_HOME:-./pg-dist}
export PG_DATA=${PG_DATA:-./pg-data}

$PG_HOME/pgsql/bin/initdb -D $PG_DATA -E=UTF8 --locale=C -U postgres
mkdir -p $PG_DATA/run
```

The run directory needs to be present and it is not normally. 

Often `$TEMP` is used for the run directory by default by
Postgres. However, because postgres creates important files that have
security risks (like unix socket endpoints) in the directory I've
chosen to make it specific.

So, in summary:

* get a postgresql distribution from a tar or RPM
* set `PG_HOME` to the base directory of that
* choose a location to install a postgres instance
* set `PG_DATA` to the base directory of that
* run postgres `initdb -D $PG_DATA postgres` to create the instance
* `mkdir $PG_DATA/run` to make the run directory
* start PgMaker

