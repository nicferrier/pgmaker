#!/bin/bash

## Initialize the postgres db for the system
##
## You need to do something like this

export PG_HOME=${PG_HOME:-./pg-dist}
export PG_BIN=${PG_BIN:-$PG_HOME/pgsql/bin}

export PG_DATA=${PG_DATA:-./pg-data}
mkdir -p $PG_DATA/run

$PG_BIN/pgsql/bin/initdb -D $PG_DATA -E=UTF8 --locale=C -U postgres

# End
