#!/bin/bash

## Initialize the postgres db for the system
##
## You need to do something like this

export PG_HOME=${PG_HOME:-./pg-dist}
export PG_BIN=${PG_BIN:-$PG_HOME/pgsql/bin}

export PG_DATA=${PG_DATA:-./pg-data}

[ -d $PG_DATA ] || $PG_BIN/initdb -D $PG_DATA -E=UTF8 --locale=C -U postgres
mkdir -p $PG_DATA/run

# End
