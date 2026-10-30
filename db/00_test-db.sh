#!/bin/bash
# Calls mysql directly instead of docker_process_sql, which only exists when the entrypoint sources this file.
# Docker Desktop (macOS/Windows) reports mounted files as executable, so the entrypoint runs it instead; this works both ways.
# Runs only on an empty volume.
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket -uroot <<<"CREATE DATABASE IF NOT EXISTS kongarthur_test; GRANT ALL ON kongarthur_test.* TO '$MYSQL_USER'@'%';"
