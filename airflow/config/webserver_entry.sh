#!/usr/bin/env bash

set -Eeuxo pipefail

env
sleep 5

airflow db init
sleep 5

airflow users create --username admin \
    --firstname krishna \
    --lastname prasad \
    --role Admin \
    --password ${ADMIN_PASS} \
    --email krishna.prasad.srinivasan@philips.com
sleep 5

airflow webserver