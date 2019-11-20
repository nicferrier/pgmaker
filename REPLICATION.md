# How can pgmaker have a safe replica?

If we had another node which was requesting WAL from Postgres on the
PgMaker node it might work.


Here is the process for doing a hydrate on another server via WAL,
presuming you can get to the network of primary.

```shell-script
origin_server_hostname=localhost
origin_server_port=55432

new_server_port=55433
new_server_backup_dir=/home/nicferrier/pg-backups/nicpg


## Take a backup of the remote primary
rm -rf $new_server_backup_dir
pg_basebackup -h $origin_server_hostname -p $origin_server_port -D $new_server_backup_dir

file=$new_server_backup_dir/postgresql.conf
new_archive=$new_server_backup_dir/../pg-archive-$new_server_port
mkdir -p $new_archive


# Not sure we need this ... the primary needs a WAL archive of course but we don't seem to need recovery via wal, it just streams
src_archive=$new_server_backup_dir/../pg-archive


## Change the conf of the backed up dir

sed -ibk -re "s/port = .*/port = $new_server_port/" $file

# This is not normally in postgresql.conf till version 12
sed -ibk -re "s|#*primary_conninfo = .*|primary_conninfo = 'host=$origin_server_hostname port=$origin_server_port options=''-c wal_sender_timeout=5000'''|" $file

sed -ibk -re 's/logging_collector = .*/logging_collector = off/' $file

sed -ibk -re "s|unix_socket_directories = .*|unix_socket_directories = '$new_server_backup_dir/run'| " $file

sed -ibk -re "s|archive_command = .*|archive_command = 'cp %p $new_archive/%f'|" $file

# Not sure we need this .... see $src_archive
sed -ibk -re "s|#*archive_cleanup_command = .*|archive_cleanup_command = 'pg_archivecleanup $src_archive %r'|" $file

# Set this one to standby
touch $backup/standby.signal

# Start it up
/usr/pgsql-12/bin/postgres -D $backup
```

## Automating this

It seems we need a pgmaker code path, or a completely different
service, to be a keepie client of pgmaker for the purposes of
replication.

PgMaker needs to know that a remote is a replication authentication I
think. But the exchange of the secret could be the same.

