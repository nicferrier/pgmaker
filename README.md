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
   "http://some-server-that-wants-a-db.example.com:8000/password": "the_db_it_wants"
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
