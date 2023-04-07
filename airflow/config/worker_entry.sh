#!/usr/bin/env bash

set -Eeuxo pipefail
sleep 30
env
airflow celery worker