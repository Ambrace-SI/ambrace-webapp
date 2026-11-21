#!/usr/bin/env bash
# Stops a deployment that is signed in to the wrong AWS account.
#
#   scripts/confirm-aws-account.sh dev
#
# The account each environment belongs to is written in one place,
# infra/<env>.tfvars. This compares it with the account the current credentials
# belong to. It catches a GitHub Environment that was given another
# environment's role, before anything is uploaded.
set -euo pipefail

ENVIRONMENT="${1:?Usage: confirm-aws-account.sh <dev|prod>}"
VAR_FILE="infra/${ENVIRONMENT}.tfvars"

EXPECTED=$(sed -nE 's/^aws_account_id[[:space:]]*=[[:space:]]*"([0-9]{12})".*/\1/p' "${VAR_FILE}")
if [ -z "${EXPECTED}" ]; then
  echo "::error::${VAR_FILE} does not name a 12-digit aws_account_id."
  exit 1
fi

ACTUAL=$(aws sts get-caller-identity --query Account --output text)
if [ "${ACTUAL}" != "${EXPECTED}" ]; then
  echo "::error::${ENVIRONMENT} belongs in AWS account ${EXPECTED}, but these credentials are for ${ACTUAL}."
  exit 1
fi

echo "Signed in to AWS account ${ACTUAL}, as ${VAR_FILE} expects."
