#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const inquirer = require('inquirer')

const ROOT_CA_CRT = './rootCA.crt'
const ROOT_CA_KEY = './rootCA.key'
const ROOT_CA_CSR = './rootCA.csr'

const question = [];

if (!fs.existsSync(ROOT_CA_CRT) || !fs.existsSync(ROOT_CA_KEY) || !fs.existsSync(ROOT_CA_CSR)) {
    question.push({
        type: 'input',
        name: 'root_ca_common_name',
        message: 'RootCA Common Name:',
    })
}

question.push({
    type: 'input',
    name: 'domain',
    message: 'Domain:',
})

const local_domain_cnf = (o, ou, cn) => `[req]\n\
distinguished_name = req_distinguished_name\n\
prompt = no\n\
[req_distinguished_name]\n\
C = VN\n\
O = ${o}\n\
OU = ${ou}\n\
CN = ${cn}`

const local_domain_ext = (domain) => `authorityKeyIdentifier = keyid,issuer\n\
basicConstraints = CA:FALSE\n\
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment\n\
subjectAltName = @alt_names\n\
[alt_names]\n\
DNS.1 = ${domain}`

const settup_root_ca_command = `openssl ecparam -out ${ROOT_CA_KEY} -name prime256v1 -genkey
openssl req -new -sha256 -key ${ROOT_CA_KEY} -out ${ROOT_CA_CSR} -config ./local_domain_root.cnf
openssl x509 -req -sha256 -days 365 -in ${ROOT_CA_CSR} -signkey ${ROOT_CA_KEY} -out ${ROOT_CA_CRT}`;

const setup_ssl_command = (domain) => `openssl genrsa -out ./${domain}.key 4096
openssl req -new -key ./${domain}.key \
-out ./${domain}.csr \
-config ./local_domain.cnf
openssl x509 -req -in ./${domain}.csr \
-CA ${ROOT_CA_CRT} \
-CAkey ${ROOT_CA_KEY} \
-CAcreateserial \
-out ./${domain}.crt \
-days 3658 -sha256 \
-extfile ./local_domain.ext;`;

(async () => {
    const answers = await inquirer.prompt(question)

    // Create RootCA
    if (answers.root_ca_common_name) {
        fs.writeFileSync('./local_domain_root.cnf', local_domain_cnf('Kyle', 'Kyle', answers.root_ca_common_name))
        execSync(settup_root_ca_command);
    }

    // Create SSL
    fs.writeFileSync('./local_domain.cnf', local_domain_cnf(answers.domain, answers.domain, answers.domain))
    fs.writeFileSync('./local_domain.ext', local_domain_ext(answers.domain))

    execSync(setup_ssl_command(answers.domain));
})()
